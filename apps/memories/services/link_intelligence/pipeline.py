import json
import logging
import hashlib
from django.utils import timezone
from datetime import timedelta
from apps.memories.models import Memory, LinkMetadataCache
from apps.memories.services.link_intelligence.platform_service import PlatformDetectionService
from apps.memories.services.ai.factory import get_llm_provider
from apps.memories.services.ai.base import LLMProviderError
from apps.memories.services.ai.validator import ResponseValidator, ResponseValidatorError

logger = logging.getLogger(__name__)

class LinkIntelligencePipeline:
    """
    Orchestrates the Link Intelligence pipeline:
    Platform Detection -> Metadata Extraction -> Cache Check -> AI Enrichment
    """

    @classmethod
    def process_link(cls, memory: Memory) -> bool:
        """
        Processes a single LINK memory through the pipeline.
        Returns True if successful, False if failed.
        """
        logger.info(f"Starting LinkIntelligencePipeline for memory {memory.pk}")
        
        memory.ai_status = Memory.AIStatus.PLATFORM_DETECTION
        memory.save(update_fields=["ai_status"])
        
        try:
            result = cls.analyze_url(memory.url, memory.domain)
            
            # Update Memory with deterministic fields
            memory.platform = result.get("platform", "")
            memory.content_type = result.get("content_type", "")
            memory.canonical_url = result.get("canonical_url", "")
            memory.page_title = result.get("page_title", "")
            memory.page_description = result.get("page_description", "")
            memory.favicon_url = result.get("favicon_url", "")
            memory.thumbnail_url = result.get("thumbnail_url", "")
            memory.site_name = result.get("site_name", "")
            memory.author = result.get("author", "")
            memory.reading_time = result.get("reading_time", "")
            memory.metadata_json = result.get("metadata_json", {})
            
            # If user has already modified these fields manually, don't overwrite them
            if not memory.title_user_modified:
                memory.ai_title = result.get("title", memory.page_title)
                memory.title_confidence = result.get("title_confidence")
                
            if not memory.summary_user_modified and result.get("summary"):
                memory.ai_summary = result.get("summary")
                memory.summary_confidence = result.get("summary_confidence")
                
            if not memory.tags_user_modified and result.get("tags"):
                memory.tags = result.get("tags", [])
                memory.tags_confidence = result.get("tags_confidence")

            memory.ai_status = Memory.AIStatus.COMPLETED
            memory.ai_processed_at = timezone.now()
            memory.ai_last_error = ""
            memory.save()
            return True
            
        except Exception as exc:
            logger.error(f"LLM link enrichment failed for memory {memory.pk}: {str(exc)}")
            memory.ai_status = Memory.AIStatus.FAILED
            memory.ai_last_error = str(exc)
            memory.save(update_fields=["ai_status", "ai_last_error", "updated_at"])
            return False

    @classmethod
    def analyze_url(cls, url: str, domain: str) -> dict:
        """
        Runs the Link Intelligence pipeline for a given URL.
        Returns a dictionary containing the fully enriched data.
        """
        import time
        start = time.perf_counter()

        logger.info("[Pipeline] ===== START url=%s domain=%s =====", url, domain)

        # 1. Platform Detection
        enricher = PlatformDetectionService.get_enricher(domain)
        logger.info("[Pipeline] Enricher selected: %s", enricher.__class__.__name__)

        # 2. Check Cache
        url_hash = hashlib.sha256(url.encode('utf-8')).hexdigest()
        cache = LinkMetadataCache.objects.filter(url_hash=url_hash, expires_at__gt=timezone.now()).first()

        if cache:
            logger.info("[Pipeline] Cache HIT — url_hash=%s url=%s", url_hash[:16], url)
            metadata = cache.metadata_json
            cache_hit = True
        else:
            logger.info("[Pipeline] Cache MISS — fetching metadata for %s", url)
            metadata = enricher.fetch_and_extract(url, domain)
            cache_hit = False
            logger.info(
                "[Pipeline] Metadata extracted — title=%r platform=%s",
                metadata.get("page_title", ""), metadata.get("platform", ""),
            )

            # Save to cache if we got at least something
            if metadata.get("page_title"):
                LinkMetadataCache.objects.update_or_create(
                    url_hash=url_hash,
                    defaults={
                        "normalized_url": url,
                        "metadata_json": metadata,
                        "expires_at": timezone.now() + timedelta(hours=24)
                    }
                )
                logger.info("[Pipeline] Cache saved for url_hash=%s", url_hash[:16])

        result = {
            "platform": metadata.get("platform", ""),
            "content_type": metadata.get("content_type", ""),
            "canonical_url": metadata.get("canonical_url", ""),
            "page_title": metadata.get("page_title", ""),
            "page_description": metadata.get("page_description", ""),
            "favicon_url": metadata.get("favicon_url", ""),
            "thumbnail_url": metadata.get("thumbnail_url", ""),
            "site_name": metadata.get("site_name", ""),
            "author": metadata.get("author", ""),
            "reading_time": metadata.get("reading_time", ""),
            "metadata_json": metadata,
            "title": metadata.get("page_title", ""),
            "summary": "",
            "tags": [],
            "title_confidence": None,
            "summary_confidence": None,
            "tags_confidence": None
        }

        # 3. AI Invocation Check
        if enricher.is_metadata_sufficient(metadata):
            elapsed = time.perf_counter() - start
            logger.info(
                "[Pipeline] ===== DONE url=%s cache_hit=%s ai_used=False duration=%.2fs =====",
                url, cache_hit, elapsed,
            )
            return result

        # Guard: if we have no useful data at all, skip AI entirely.
        # Sending empty content to the AI causes hallucinations.
        has_useful_input = bool(
            metadata.get("page_title") or
            metadata.get("page_description") or
            (metadata.get("raw_text") and len(metadata.get("raw_text", "")) > 50)
        )
        if not has_useful_input:
            elapsed = time.perf_counter() - start
            logger.warning(
                "[Pipeline] No usable metadata — skipping AI to avoid hallucination. url=%s duration=%.2fs",
                url, elapsed,
            )
            return result

        # 4. AI Enrichment
        logger.info("[Pipeline] Running AI enrichment for %s", url)
        enriched_data = cls._run_ai_enrichment(metadata, url)
        result.update(enriched_data)

        elapsed = time.perf_counter() - start
        logger.info(
            "[Pipeline] ===== DONE url=%s cache_hit=%s ai_used=True duration=%.2fs =====",
            url, cache_hit, elapsed,
        )
        return result

    @classmethod
    def _run_ai_enrichment(cls, metadata: dict, url: str = "") -> dict:
        """
        Invoke LLM to generate title, summary, and tags.
        """
        result = {}
        try:
            provider = get_llm_provider()

            prompt = cls._build_prompt(metadata, url)
            response_text = provider.generate_enrichment(prompt)
            
            # Use JSON extraction or standard response validator
            import re
            
            json_match = re.search(r'\{.*\}', response_text.replace('\n', ''))
            if json_match:
                response_text = json_match.group(0)
                
            try:
                data = json.loads(response_text)
            except json.JSONDecodeError:
                # Fallback to existing validator
                data = ResponseValidator.validate_enrichment(response_text)
            
            raw_title = data.get("title", "")
            if raw_title:
                from apps.memories.services.memory_enrichment_service import sanitize_title
                result["title"] = sanitize_title(raw_title)
                result["title_confidence"] = 0.9
                
            raw_summary = data.get("summary", "")
            if raw_summary:
                result["summary"] = raw_summary.strip()
                result["summary_confidence"] = 0.9
                
            raw_tags = data.get("tags", [])
            if isinstance(raw_tags, list):
                result["tags"] = raw_tags[:6]
                result["tags_confidence"] = 0.9

            return result
            
        except Exception as exc:
            logger.error(f"LLM link enrichment failed: {str(exc)}")
            return result

    @classmethod
    def _build_prompt(cls, metadata: dict, url: str = "") -> str:
        raw_text = metadata.get("raw_text", "")
        title = metadata.get("page_title", "")
        desc = metadata.get("page_description", "")
        author = metadata.get("author", "")

        return f"""You are organizing a user's personal memory from a web link.

The URL being analyzed is: {url}

Generate based ONLY on the metadata and content below. Do NOT invent information.

1. A concise, human-readable title (3 to 8 words).
2. A brief factual summary (maximum 3-4 sentences). Answer: What is this? Why is it useful? What is the main topic?
3. Up to 6 relevant tags as a JSON array of strings.

Rules for Title:
- Must be 3 to 8 words long.
- Use sentence case or title case.
- Do NOT use quotation marks, quotes, emojis, or Markdown formatting.
- Do NOT use generic titles.
- The title MUST describe the content at this specific URL, not a generic topic.

Return ONLY valid JSON with keys "title", "summary", and "tags".

Metadata:
URL: {url}
Title: {title}
Author: {author}
Description: {desc}
Page Content excerpt: {raw_text[:3000]}
"""

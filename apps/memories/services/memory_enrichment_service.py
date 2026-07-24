"""
Memory Enrichment Service — AI enrichment for memories.

Responsibilities:
    - Route enrichment by memory_type.
    - TEXT memories: invoke LLM to generate title and summary.
    - LINK memories: title was already set by MetadataService at capture time.
                     Mark as READY immediately. No LLM call needed.

AI must NEVER perform deterministic work.
Deterministic work (domain lookup, URL validation) belongs in
ContentClassifier and MetadataService.
"""

import re
import logging
from django.utils import timezone
from apps.memories.models import Memory
from apps.memories.services.ai.factory import get_llm_provider
from apps.memories.services.ai.base import LLMProviderError
from apps.memories.services.ai.validator import ResponseValidator, ResponseValidatorError

logger = logging.getLogger(__name__)

TEXT_PROMPT_TEMPLATE = """You are organizing a user's personal memory.

Generate:
1. A concise, human-readable title (3 to 8 words).
2. A brief factual summary (maximum 2-3 sentences).

Rules for Title:
- Must be 3 to 8 words long.
- Use sentence case or title case.
- Do NOT use quotation marks, quotes, emojis, or Markdown formatting.
- Do NOT use generic titles such as "Memory", "Untitled", "New Memory", "Note", "Summary", "AI Title", or "AI Analysis".
- If a suitable title cannot be generated, return empty string "".

Rules for Summary:
- Maximum 2-3 sentences.
- If the original memory is already short or concise, return empty string "".

Return ONLY valid JSON with keys "title" and "summary".

Memory:
{raw_memory}
"""

GENERIC_TITLES = {
    "memory", "untitled", "new memory", "note", "summary",
    "ai analysis", "ai title", "text", "new note", "untitled note",
    "untitled memory", "analyzing memory...", "analyzing memory",
    "saved link", "link saved"
}


def sanitize_title(title: str) -> str:
    """
    Sanitize and normalize generated title.
    Trims whitespace, strips quotes, removes trailing punctuation,
    collapses multiple spaces, and rejects generic titles.
    """
    if not title:
        return ""

    # Strip whitespace & quotes
    clean = title.strip().strip('"\'`“”‘’')

    # Remove trailing punctuation like . , : ;
    clean = re.sub(r'[\.,:;]+$', '', clean).strip()

    # Collapse multiple spaces
    clean = re.sub(r'\s+', ' ', clean)

    # Check if generic title
    if clean.lower() in GENERIC_TITLES:
        return ""

    # Enforce word length limit (max 10 words cutoff)
    words = clean.split()
    if len(words) > 10:
        clean = " ".join(words[:10])

    return clean


class MemoryEnrichmentService:
    """
    Handles AI enrichment (titles, summaries) for memories.

    Routes enrichment by memory_type:
        TEXT → LLM generates title and summary.
        LINK → Already has a display title from MetadataService.
               Summary is set to the raw URL. Marked READY immediately.
    """

    @staticmethod
    def enrich_memory(memory_id: int) -> bool:
        """
        Enrich a specific memory.

        Args:
            memory_id: The primary key of the Memory to enrich.

        Returns:
            True if enrichment succeeded or was skipped gracefully.
            False if processing failed.
        """
        try:
            memory = Memory.objects.get(pk=memory_id)
        except Memory.DoesNotExist:
            logger.error("Enrichment failed: Memory %s does not exist", memory_id)
            return False

        if memory.ai_status == Memory.AIStatus.READY:
            logger.info("Memory %s is already enriched", memory_id)
            return True

        # Route by content type
        if memory.memory_type == Memory.MemoryType.LINK:
            return MemoryEnrichmentService._enrich_link(memory)

        return MemoryEnrichmentService._enrich_text(memory)

    # -------------------------------------------------------------------------
    # Private — per-type enrichment
    # -------------------------------------------------------------------------

    @staticmethod
    def _enrich_link(memory: Memory) -> bool:
        """
        Finalize enrichment for a LINK memory.

        The display title was already set at capture time by MetadataService.
        The summary is the raw URL — honest, accurate, no hallucination risk.
        No LLM call is made.
        """
        logger.info("Enriching LINK memory %s (no LLM required)", memory.pk)

        summary = memory.url or memory.raw_content

        memory.ai_summary = summary
        memory.ai_status = Memory.AIStatus.READY
        memory.ai_processed_at = timezone.now()
        memory.ai_last_error = ""
        memory.save(update_fields=[
            "ai_summary", "ai_status", "ai_processed_at", "ai_last_error", "updated_at",
        ])

        logger.info("LINK memory %s marked READY", memory.pk)
        return True

    @staticmethod
    def _enrich_text(memory: Memory) -> bool:
        """
        Enrich a TEXT memory using the LLM.
        """
        logger.info("Enriching TEXT memory %s via LLM", memory.pk)

        memory.ai_status = Memory.AIStatus.PROCESSING
        memory.save(update_fields=["ai_status", "updated_at"])

        try:
            provider = get_llm_provider()
            logger.info("Provider selected: %s", provider.__class__.__name__)

            prompt = TEXT_PROMPT_TEMPLATE.format(raw_memory=memory.raw_content)
            response_text = provider.generate_enrichment(prompt)
            logger.info("LLM response received for memory %s", memory.pk)

            data = ResponseValidator.validate_enrichment(response_text)

            raw_title = data.get("title", "")
            raw_summary = data.get("summary", "")

            sanitized_title = sanitize_title(raw_title)
            clean_summary = raw_summary.strip()

            memory.ai_title = sanitized_title
            memory.ai_summary = clean_summary
            memory.ai_status = Memory.AIStatus.READY
            memory.ai_processed_at = timezone.now()
            memory.ai_last_error = ""
            memory.save(update_fields=[
                "ai_title", "ai_summary", "ai_status",
                "ai_processed_at", "ai_last_error", "updated_at",
            ])

            logger.info("TEXT memory %s enriched successfully with title '%s'", memory.pk, sanitized_title)
            return True

        except (LLMProviderError, ResponseValidatorError, Exception) as exc:
            logger.error("LLM enrichment failed for memory %s: %s", memory.pk, str(exc))

            memory.ai_status = Memory.AIStatus.FAILED
            memory.ai_last_error = str(exc)
            memory.save(update_fields=["ai_status", "ai_last_error", "updated_at"])

            return False

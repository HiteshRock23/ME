"""
Capture Service — Orchestrates the Capture pipeline.

This is the entry point for creating memories. It:
    1. Classifies the raw input (ContentClassifier)
    2. Extracts deterministic metadata (MetadataService)
    3. Saves the memory immediately with ai_status=PENDING
    4. Synchronizes with Supermemory
    5. Handles failures gracefully — never loses user data

CaptureService contains ZERO content-specific logic.
It does not know how links work. It does not know how text works.
It only orchestrates. Content intelligence lives in its dedicated services.

AI processing is strictly handled asynchronously by the background worker.
The raw_content is NEVER modified.
"""

import logging

from django.utils import timezone

from apps.memories.models import Memory
from apps.memories.services.content_classifier import ContentClassifier
from apps.memories.services.exceptions import SupermemoryError
from apps.memories.services.metadata.metadata_service import MetadataService
from apps.memories.services.supermemory_service import SupermemoryService

logger = logging.getLogger(__name__)


from django.db import transaction
from rest_framework.exceptions import ValidationError


def capture_memory(
    user,
    raw_content: str,
    link_title: str = "",
    force_save: bool = False,
    preview_id=None,
    is_pinned: bool = False,
    capture_source: str = Memory.CaptureSource.MANUAL,
) -> Memory:
    """
    Capture a new memory for the given user.

    Pipeline:
        1. Classify the raw input (text, link, ...)
        2. Extract deterministic metadata
        3. Save raw content immediately with ai_status=PENDING
        4. Synchronize with Supermemory
        5. Return the saved Memory instance

    The user's data is never lost, even if synchronization fails.
    AI enrichment is fully decoupled and handled by a background worker.

    Args:
        user:           The authenticated user.
        raw_content:    The user's unprocessed input (text, URL, etc.).
        link_title:     User-provided title.
        force_save:     Skip duplicate check if True.
        preview_id:     Optional PendingCapture UUID.
        is_pinned:      Whether to pin this memory immediately.
        capture_source: Originating capture source (MANUAL, WEB_SHARE, etc.).

    Returns:
        The saved Memory instance.
    """
    if not capture_source:
        capture_source = Memory.CaptureSource.MANUAL

    # Step 1: Classify — what did the user paste?
    classification = ContentClassifier.classify(raw_content)
    logger.info(
        "Input classified as %s for user %s (source=%s)",
        classification.memory_type, user.pk, capture_source
    )

    # Step 2: Normalise URL and Check for Duplicates
    url = classification.url
    if classification.memory_type == "link" and url:
        from apps.memories.services.link_intelligence.url_normalizer import URLNormalizer
        url = URLNormalizer.normalize(url)
        
        if not force_save:
            from apps.memories.services.exceptions import DuplicateMemoryError
            existing = Memory.objects.filter(user=user, url=url).first()
            if existing:
                logger.info("Duplicate link detected for user %s: %s", user.pk, url)
                raise DuplicateMemoryError(existing)

    # Step 3: Extract deterministic metadata (domain title, display name, etc.)
    metadata = MetadataService.extract(
        memory_type=classification.memory_type,
        url=url,
        domain=classification.domain,
    )

    # Step 4: Validate Pin Limit if is_pinned is True
    pinned_at_time = None
    if is_pinned:
        with transaction.atomic():
            current_pinned_count = Memory.objects.filter(user=user, pinned_at__isnull=False).select_for_update().count()
            if current_pinned_count >= 5:
                raise ValidationError("You can pin up to 5 memories. Unpin one to pin another.")
            pinned_at_time = timezone.now()

    # Save immediately — source of truth is always PostgreSQL
    memory = Memory.objects.create(
        user=user,
        memory_type=classification.memory_type,
        raw_content=raw_content,
        url=url,
        domain=classification.domain or "",
        link_url=url if classification.memory_type == "link" else None,
        link_title=link_title if classification.memory_type == "link" else "",
        ai_title=metadata.display_title,
        ai_status=Memory.AIStatus.PENDING,
        sync_status=Memory.SyncStatus.PENDING,
        pinned_at=pinned_at_time,
        capture_source=capture_source,
    )

    if preview_id and classification.memory_type == "link":
        from apps.memories.models import PendingCapture
        try:
            pending = PendingCapture.objects.get(id=preview_id, capture_type="link")
            payload = pending.payload_json
            
            memory.platform = payload.get("platform", "")
            memory.content_type = payload.get("content_type", "")
            memory.canonical_url = payload.get("canonical_url", "")
            memory.page_title = payload.get("page_title", "")
            memory.page_description = payload.get("page_description", "")
            memory.favicon_url = payload.get("favicon_url", "")
            memory.thumbnail_url = payload.get("thumbnail_url", "")
            memory.site_name = payload.get("site_name", "")
            memory.author = payload.get("author", "")
            memory.reading_time = payload.get("reading_time", "")
            memory.metadata_json = payload.get("metadata_json", {})
            memory.ai_title = payload.get("title", metadata.display_title)
            memory.ai_summary = payload.get("summary", "")
            memory.tags = payload.get("tags", [])
            memory.title_confidence = payload.get("title_confidence")
            memory.summary_confidence = payload.get("summary_confidence")
            memory.tags_confidence = payload.get("tags_confidence")
            
            memory.ai_status = Memory.AIStatus.COMPLETED
            memory.ai_processed_at = timezone.now()
            memory.save()
            
            pending.delete()
            logger.info(f"Applied PendingCapture {preview_id} to Memory {memory.pk}")
        except PendingCapture.DoesNotExist:
            logger.warning(f"PendingCapture {preview_id} not found. Proceeding with standard background enrichment.")

    logger.info("Memory %s captured (type=%s) for user %s", memory.pk, memory.memory_type, user.pk)

    # Trigger Link Intelligence enrichment for fresh link captures.
    # preview_id captures are already fully enriched — skip them.
    # Uses transaction.on_commit() so the DB row is committed and visible
    # before the background thread begins. Passes only memory_id (not the ORM
    # object) so the thread always works with a fresh database state.
    if memory.memory_type == "link" and not preview_id:
        from apps.memories.services.link_intelligence.enrichment_service import LinkEnrichmentService
        LinkEnrichmentService.schedule(memory.pk)

    # Step 5: Synchronize with Supermemory
    try:
        sm_service = SupermemoryService()
        memory.last_sync_attempt = timezone.now()

        logger.info("Starting Supermemory synchronization for memory %s", memory.pk)
        doc_id = sm_service.store_memory(
            content=memory.raw_content,
            memory_id=memory.pk,
            user_id=memory.user_id,
            link_title=link_title,
        )

        memory.supermemory_document_id = doc_id
        memory.sync_status = Memory.SyncStatus.SYNCED
        memory.synced_at = timezone.now()
        memory.last_sync_error = None
        memory.save(update_fields=[
            "supermemory_document_id", "sync_status", "synced_at",
            "last_sync_attempt", "last_sync_error", "updated_at",
        ])
        logger.info("Synchronization successful for memory %s (doc: %s)", memory.pk, doc_id)

    except SupermemoryError as exc:
        memory.sync_status = Memory.SyncStatus.FAILED
        memory.last_sync_error = str(exc)
        memory.save(update_fields=["sync_status", "last_sync_attempt", "last_sync_error", "updated_at"])
        logger.error("Synchronization failed for memory %s: %s", memory.pk, exc)
    except Exception as exc:
        memory.sync_status = Memory.SyncStatus.FAILED
        memory.last_sync_error = f"Unexpected error: {exc}"
        memory.save(update_fields=["sync_status", "last_sync_attempt", "last_sync_error", "updated_at"])
        logger.error("Synchronization failed unexpectedly for memory %s: %s", memory.pk, exc)

    return memory

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


def capture_memory(user, raw_content: str, link_title: str = "") -> Memory:
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
        user:        The authenticated user.
        raw_content: The user's unprocessed input (text, URL, etc.).

    Returns:
        The saved Memory instance.
    """
    # Step 1: Classify — what did the user paste?
    classification = ContentClassifier.classify(raw_content)
    logger.info(
        "Input classified as %s for user %s",
        classification.memory_type, user.pk,
    )

    # Step 2: Extract deterministic metadata (domain title, display name, etc.)
    metadata = MetadataService.extract(
        memory_type=classification.memory_type,
        url=classification.url,
        domain=classification.domain,
    )

    # Step 3: Save immediately — source of truth is always PostgreSQL
    memory = Memory.objects.create(
        user=user,
        memory_type=classification.memory_type,
        raw_content=raw_content,
        url=classification.url,
        domain=classification.domain or "",
        link_url=classification.url if classification.memory_type == "link" else None,
        link_title=link_title if classification.memory_type == "link" else "",
        # Pre-populate the title from metadata for link memories.
        # AI enrichment will refine text memories; links get their
        # display title here so the card shows something useful immediately.
        ai_title=metadata.display_title,
        ai_status=Memory.AIStatus.PENDING,
        sync_status=Memory.SyncStatus.PENDING,
    )
    logger.info("Memory %s captured (type=%s) for user %s", memory.pk, memory.memory_type, user.pk)

    # Step 4: Synchronize with Supermemory
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

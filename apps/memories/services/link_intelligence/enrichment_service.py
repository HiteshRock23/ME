"""
LinkEnrichmentService — Single, safe entry point for link memory enrichment.

Responsibilities:
    - Guard against duplicate enrichment (COMPLETED / PROCESSING already running)
    - Mark ai_status = PROCESSING immediately so the UI shows feedback
    - Delegate to LinkIntelligencePipeline using only memory_id (never ORM objects)
    - Log every stage with timing for debugging
    - Handle failures gracefully — never lose the saved memory

Design:
    This service is the ONLY place that calls LinkIntelligencePipeline.process_link().
    capture_service calls this.
    MemoryEnrichmentService._enrich_link() calls this.

    Future Celery migration: replace schedule() body with task.delay(memory_id).
    Nothing else changes.
"""

import logging
import time
import threading

from django.db import transaction

logger = logging.getLogger(__name__)


class LinkEnrichmentService:
    """
    Coordinates link enrichment after a memory has been saved.

    All methods are classmethods — this is a stateless service.
    Never instantiate it.
    """

    @classmethod
    def schedule(cls, memory_id: int) -> None:
        """
        Schedule enrichment to run after the current database transaction commits.

        Uses transaction.on_commit() to guarantee the Memory row is visible
        to the background thread before enrichment begins.

        This is the method capture_service should call.

        Args:
            memory_id: The primary key of the Memory to enrich.
        """
        logger.info("[LinkEnrichmentService] Scheduling enrichment for memory %s", memory_id)
        transaction.on_commit(lambda: cls._run_in_thread(memory_id))

    @classmethod
    def _run_in_thread(cls, memory_id: int) -> None:
        """
        Spawns a daemon thread to run enrichment without blocking the HTTP response.

        The thread is a daemon so it won't block server shutdown.
        Each thread loads its own fresh database connection.
        """
        thread = threading.Thread(
            target=cls.enrich,
            args=(memory_id,),
            daemon=True,
            name=f"link-enrichment-{memory_id}",
        )
        thread.start()
        logger.info(
            "[LinkEnrichmentService] Enrichment thread started for memory %s", memory_id
        )

    @classmethod
    def enrich(cls, memory_id: int) -> bool:
        """
        Main enrichment entry point. Loads a fresh Memory instance,
        guards against duplicate runs, and delegates to the pipeline.

        Args:
            memory_id: The primary key of the Memory to enrich.

        Returns:
            True if enrichment succeeded or was skipped cleanly.
            False if an error occurred (memory is marked FAILED).
        """
        start_time = time.perf_counter()

        logger.info(
            "[LinkEnrichmentService] ========== START memory_id=%s ==========", memory_id
        )

        # --- Load a fresh copy of the memory from the database ---
        from apps.memories.models import Memory

        try:
            memory = Memory.objects.get(pk=memory_id)
        except Memory.DoesNotExist:
            logger.error(
                "[LinkEnrichmentService] Memory %s does not exist — aborting", memory_id
            )
            return False

        logger.info(
            "[LinkEnrichmentService] memory_id=%s url=%s current_status=%s",
            memory_id, memory.url, memory.ai_status,
        )

        # --- Duplicate protection ---
        # If enrichment already completed or is currently running, skip.
        if memory.ai_status in (Memory.AIStatus.COMPLETED, Memory.AIStatus.AI_ENRICHMENT):
            logger.info(
                "[LinkEnrichmentService] Skipping memory %s — already %s",
                memory_id, memory.ai_status,
            )
            return True

        if memory.memory_type != Memory.MemoryType.LINK:
            logger.warning(
                "[LinkEnrichmentService] Memory %s is not a LINK (%s) — aborting",
                memory_id, memory.memory_type,
            )
            return False

        # --- Mark PROCESSING immediately so the UI sees feedback ---
        memory.ai_status = Memory.AIStatus.AI_ENRICHMENT
        memory.save(update_fields=["ai_status", "updated_at"])
        logger.info(
            "[LinkEnrichmentService] memory %s → ai_status=AI_ENRICHMENT", memory_id
        )

        # --- Delegate to the pipeline ---
        try:
            from apps.memories.services.link_intelligence.pipeline import (
                LinkIntelligencePipeline,
            )
            success = LinkIntelligencePipeline.process_link(memory)
        except Exception as exc:
            logger.error(
                "[LinkEnrichmentService] Pipeline raised unexpected exception for memory %s: %s",
                memory_id, exc, exc_info=True,
            )
            # Reload memory to make sure we don't overwrite other changes
            try:
                memory = Memory.objects.get(pk=memory_id)
                memory.ai_status = Memory.AIStatus.FAILED
                memory.ai_last_error = f"Unexpected error: {exc}"
                memory.save(update_fields=["ai_status", "ai_last_error", "updated_at"])
            except Exception:
                pass
            success = False

        elapsed = time.perf_counter() - start_time
        logger.info(
            "[LinkEnrichmentService] ========== DONE memory_id=%s success=%s duration=%.2fs ==========",
            memory_id, success, elapsed,
        )
        return success

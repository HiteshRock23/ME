import logging
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.memories.models import Memory
from apps.memories.services.supermemory_service import SupermemoryService
from apps.memories.services.exceptions import SupermemoryError

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = "Retries synchronization of memories that failed to sync with Supermemory Local."

    def handle(self, *args, **options):
        self.stdout.write("Starting Supermemory synchronization retry process...")
        logger.info("Retry Started: sync_memories management command invoked.")

        # Find all memories where sync_status != SYNCED
        pending_memories = Memory.objects.exclude(sync_status=Memory.SyncStatus.SYNCED)
        
        total_processed = 0
        total_synced = 0
        total_failed = 0

        sm_service = SupermemoryService()

        # Perform a health check first
        if not sm_service.health_check():
            msg = "Health check failed: Supermemory Local is not available."
            self.stderr.write(self.style.ERROR(msg))
            logger.error(f"Retry Failed: {msg}")
            return

        for memory in pending_memories:
            total_processed += 1
            memory.last_sync_attempt = timezone.now()
            
            try:
                # Store the memory in Supermemory
                doc_id = sm_service.store_memory(content=memory.raw_content, memory_id=memory.pk, user_id=memory.user_id)
                
                # Update memory
                memory.supermemory_document_id = doc_id
                memory.sync_status = Memory.SyncStatus.SYNCED
                memory.synced_at = timezone.now()
                memory.last_sync_error = None
                memory.save(update_fields=[
                    "supermemory_document_id", "sync_status", "synced_at", 
                    "last_sync_attempt", "last_sync_error", "updated_at"
                ])
                
                total_synced += 1
                logger.info(f"Retry Successful: Memory {memory.pk} synchronized. Document ID: {doc_id}")
                
            except SupermemoryError as exc:
                memory.sync_status = Memory.SyncStatus.FAILED
                memory.last_sync_error = str(exc)
                memory.save(update_fields=["sync_status", "last_sync_attempt", "last_sync_error", "updated_at"])
                
                total_failed += 1
                logger.error(f"Synchronization Failed for memory {memory.pk} during retry: {exc}")
                
            except Exception as exc:
                memory.sync_status = Memory.SyncStatus.FAILED
                memory.last_sync_error = f"Unexpected error: {exc}"
                memory.save(update_fields=["sync_status", "last_sync_attempt", "last_sync_error", "updated_at"])
                
                total_failed += 1
                logger.error(f"Unexpected Synchronization Failed for memory {memory.pk} during retry: {exc}")

        # Summary
        summary = (
            f"\nSynchronization Summary:\n"
            f"Processed: {total_processed}\n"
            f"Synced: {total_synced}\n"
            f"Failed: {total_failed}"
        )
        self.stdout.write(summary)
        logger.info(f"Retry Complete. {summary.replace(chr(10), ' ')}")

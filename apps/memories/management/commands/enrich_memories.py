import logging
from django.core.management.base import BaseCommand
from apps.memories.models import Memory
from apps.memories.services.memory_enrichment_service import MemoryEnrichmentService

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = "Retry AI enrichment for all memories that are not READY."

    def handle(self, *args, **options):
        self.stdout.write("Starting bulk enrichment retry...")
        
        memories = Memory.objects.exclude(ai_status=Memory.AIStatus.READY)
        total = memories.count()
        
        if total == 0:
            self.stdout.write(self.style.SUCCESS("No pending or failed memories found. Exiting."))
            return
            
        self.stdout.write(f"Found {total} memories to process.")
        
        successful = 0
        failed = 0
        
        for memory in memories:
            self.stdout.write(f"Processing memory {memory.pk} (current status: {memory.ai_status})...")
            # We explicitly revert it to PENDING if we are forcing a retry so the service can pick it up
            # Actually, the service doesn't require it to be PENDING, it just returns if it's READY.
            # But the service checks if it's READY. We excluded READY.
            success = MemoryEnrichmentService.enrich_memory(memory.pk)
            if success:
                successful += 1
            else:
                failed += 1
                
        self.stdout.write("\nEnrichment Retry Completed:")
        self.stdout.write(f"Processed: {total}")
        self.stdout.write(self.style.SUCCESS(f"Successful: {successful}"))
        if failed > 0:
            self.stdout.write(self.style.ERROR(f"Failed: {failed}"))
        else:
            self.stdout.write(f"Failed: {failed}")

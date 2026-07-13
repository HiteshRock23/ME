import time
import logging
from django.core.management.base import BaseCommand
from apps.memories.models import Memory
from apps.memories.services.memory_enrichment_service import MemoryEnrichmentService

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = "Run the AI Enrichment worker loop in the background."

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Starting enrichment worker..."))
        logger.info("Enrichment worker started.")
        
        while True:
            # Find oldest pending memory
            memory = Memory.objects.filter(ai_status=Memory.AIStatus.PENDING).order_by("created_at").first()
            
            if memory:
                try:
                    MemoryEnrichmentService.enrich_memory(memory.pk)
                except Exception as e:
                    logger.error("Unexpected error in worker loop for memory %s: %s", memory.pk, str(e))
            else:
                # No pending memories, sleep briefly to avoid high CPU usage
                time.sleep(3)

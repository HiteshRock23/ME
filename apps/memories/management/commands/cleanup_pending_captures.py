from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.memories.models import PendingCapture

class Command(BaseCommand):
    help = "Deletes expired PendingCapture records."

    def handle(self, *args, **options):
        now = timezone.now()
        expired_captures = PendingCapture.objects.filter(expires_at__lt=now)
        count = expired_captures.count()
        
        if count > 0:
            expired_captures.delete()
            self.stdout.write(self.style.SUCCESS(f"Successfully deleted {count} expired PendingCapture records."))
        else:
            self.stdout.write(self.style.SUCCESS("No expired PendingCapture records found."))

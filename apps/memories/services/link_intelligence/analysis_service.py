import logging
from urllib.parse import urlparse
from django.utils import timezone
from datetime import timedelta
from rest_framework.exceptions import ValidationError
from apps.memories.models import PendingCapture
from apps.memories.services.link_intelligence.pipeline import LinkIntelligencePipeline
from apps.memories.services.link_intelligence.url_normalizer import URLNormalizer
from apps.memories.services.link_intelligence.platform_service import PlatformDetectionService

logger = logging.getLogger(__name__)

class LinkAnalysisService:
    """
    Coordinates public URL analysis for features like "Save Link".
    It validates URLs, calls the LinkIntelligencePipeline, and creates a generic PendingCapture.
    """

    @classmethod
    def analyze_public_link(cls, url: str) -> dict:
        """
        Validates the URL, normalizes it, runs the extraction/enrichment pipeline,
        and saves a PendingCapture for 24 hours.
        Returns the parsed output dict including the preview_id.
        """
        if not url:
            raise ValidationError("URL is required.")

        if len(url) > 2000:
            raise ValidationError("URL is too long.")

        parsed = urlparse(url)
        if parsed.scheme not in ('http', 'https'):
            raise ValidationError("Only HTTP and HTTPS URLs are supported.")

        normalized_url = URLNormalizer.normalize(url)
        domain = PlatformDetectionService.extract_domain(normalized_url)

        logger.info(f"Analyzing public link: {normalized_url}")

        try:
            # 1. Run Pipeline
            enriched_data = LinkIntelligencePipeline.analyze_url(normalized_url, domain)

            # 2. Add extra fields
            enriched_data["url"] = normalized_url

            # 3. Create PendingCapture
            expires_at = timezone.now() + timedelta(hours=24)
            capture = PendingCapture.objects.create(
                capture_type="link",
                payload_json=enriched_data,
                expires_at=expires_at
            )

            # 4. Return DTO
            return {
                "preview_id": str(capture.id),
                **enriched_data
            }

        except Exception as e:
            logger.error(f"Error analyzing public link {normalized_url}: {e}")
            raise ValidationError("We couldn't fully understand this link. You can still save it inside ME.")

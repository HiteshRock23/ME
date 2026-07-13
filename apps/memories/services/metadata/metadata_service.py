"""
Metadata Service — Routes metadata extraction by memory type.

This is the single entry point for the metadata extraction pipeline.
It knows which extractor to use for each content type, but it
delegates all content-specific logic to the extractor.

CaptureService calls this service. CaptureService does not know
about LinkMetadataExtractor. It only knows about MetadataService.

Design: Single Responsibility
    - Routing only. Zero extraction logic lives here.
    - Adding a new memory type requires registering one new extractor.
      No other code changes.
"""

import logging
from typing import Optional

from apps.memories.services.metadata.base import ExtractedMetadata
from apps.memories.services.metadata.link_extractor import LinkMetadataExtractor

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Extractor registry
# To add a new memory type: instantiate its extractor and add it here.
# ---------------------------------------------------------------------------
_EXTRACTORS = {
    "link": LinkMetadataExtractor(),
    # "image": ImageMetadataExtractor(),   # Future
    # "pdf":   PDFMetadataExtractor(),     # Future
}

_EMPTY_METADATA = ExtractedMetadata(display_title="", display_name="")


class MetadataService:
    """
    Dispatches metadata extraction to the appropriate extractor.

    This service is stateless. All methods are static.
    """

    @staticmethod
    def extract(
        memory_type: str,
        url: Optional[str] = None,
        domain: Optional[str] = None,
    ) -> ExtractedMetadata:
        """
        Extract metadata for the given memory type.

        Args:
            memory_type: The classified type ("text", "link", etc.).
            url:         The URL for LINK memories. None for others.
            domain:      The domain for LINK memories. None for others.

        Returns:
            ExtractedMetadata. Returns empty metadata for TEXT memories
            (AI enrichment generates their title and summary instead).
        """
        extractor = _EXTRACTORS.get(memory_type)

        if extractor is None:
            # TEXT memories and unknown types return empty metadata.
            # AI enrichment handles their titles.
            logger.debug("No metadata extractor for memory_type=%s", memory_type)
            return _EMPTY_METADATA

        try:
            return extractor.extract(domain=domain or "", url=url or "")
        except Exception as exc:
            # Never let a metadata extraction failure block capture.
            logger.error(
                "Metadata extraction failed for type=%s domain=%s: %s",
                memory_type, domain, exc,
            )
            return _EMPTY_METADATA

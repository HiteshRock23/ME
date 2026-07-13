"""
Base Metadata Extractor — Abstract contract for all metadata extractors.

Every content type (LINK, IMAGE, PDF, etc.) must implement this interface.
The MetadataService uses this contract to dispatch extraction without
knowing anything about the content-specific logic.

Design: Open/Closed Principle
    Open for extension (new extractor per content type).
    Closed for modification (MetadataService never changes when types are added).
"""

import abc
from dataclasses import dataclass


@dataclass(frozen=True)
class ExtractedMetadata:
    """
    Structured metadata returned by any extractor.

    Attributes:
        display_title:  A human-readable title for the memory card.
                        For links: "GitHub Link", "YouTube Video", etc.
                        For text: empty string (AI generates the title).
        display_name:   A short human-readable label for the source.
                        For links: the domain name (e.g. "github.com").
                        For text: empty string.
    """

    display_title: str
    display_name: str


class BaseMetadataExtractor(abc.ABC):
    """
    Abstract base for all metadata extractors.

    Implementors must be stateless and side-effect free.
    No database access. No external API calls. No AI.
    """

    @abc.abstractmethod
    def extract(self, **kwargs) -> ExtractedMetadata:
        """
        Extract metadata from the provided fields.

        Subclasses define their own keyword arguments based on
        the fields available for their content type.

        Returns:
            A frozen ExtractedMetadata dataclass.
        """
        raise NotImplementedError

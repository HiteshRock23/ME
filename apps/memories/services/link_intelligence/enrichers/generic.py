from apps.memories.services.link_intelligence.enrichers.base import BaseEnricher

class GenericWebsiteEnricher(BaseEnricher):
    """
    Fallback enricher for domains without a specific implementation.
    """
    platform_name = "Website"
    content_type = "Article"
    
    def is_metadata_sufficient(self, metadata: dict) -> bool:
        # For generic websites, we almost always want AI to summarize the article,
        # unless it's extremely short or both title and description are perfect.
        # But generally, we rely on AI to generate a good summary.
        # Let's say it's sufficient if we have a very long description.
        desc = metadata.get("page_description", "")
        if len(desc) > 150 and metadata.get("page_title"):
            return True
        return False

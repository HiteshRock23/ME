from apps.memories.services.link_intelligence.enrichers.generic import GenericWebsiteEnricher
from apps.memories.services.link_intelligence.enrichers.github import GitHubEnricher
from apps.memories.services.link_intelligence.enrichers.youtube import YouTubeEnricher

class PlatformDetectionService:
    """
    Deterministically detects the platform and returns the correct enricher.
    """
    
    _ENRICHERS = {
        "github.com": GitHubEnricher,
        "youtube.com": YouTubeEnricher,
        "youtu.be": YouTubeEnricher,
    }

    @classmethod
    def get_enricher(cls, domain: str):
        """
        Returns the instantiated enricher for the domain, or GenericWebsiteEnricher.
        """
        enricher_class = cls._ENRICHERS.get(domain, GenericWebsiteEnricher)
        return enricher_class()

    @classmethod
    def extract_domain(cls, url: str) -> str:
        """
        Extracts the domain from a URL.
        """
        import urllib.parse
        try:
            domain = urllib.parse.urlparse(url).netloc.lower()
            if domain.startswith("www."):
                domain = domain[4:]
            return domain
        except Exception:
            return ""

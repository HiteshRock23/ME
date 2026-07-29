from apps.memories.services.link_intelligence.enrichers.base import BaseEnricher
from bs4 import BeautifulSoup

class GitHubEnricher(BaseEnricher):
    platform_name = "GitHub"
    content_type = "Repository"

    def extract_metadata(self, soup: BeautifulSoup, metadata: dict):
        super().extract_metadata(soup, metadata)
        
        # GitHub's OpenGraph is usually very good.
        # title: owner/repo: description
        # We can extract owner and repo from canonical URL
        url = metadata.get("canonical_url", "")
        parts = url.rstrip('/').split('/')
        if len(parts) >= 5 and "github.com" in parts[2]:
            owner = parts[3]
            repo = parts[4]
            metadata["author"] = owner
            metadata["page_title"] = f"{owner}/{repo}"

    def is_metadata_sufficient(self, metadata: dict) -> bool:
        # GitHub OpenGraph descriptions are usually the exact repo description.
        # It's highly sufficient, AI is rarely needed.
        return bool(metadata.get("page_title") and metadata.get("page_description"))

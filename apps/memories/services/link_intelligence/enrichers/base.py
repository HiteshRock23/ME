import json
import logging
import urllib.parse
from bs4 import BeautifulSoup
from bs4 import BeautifulSoup
from apps.memories.services.link_intelligence.http_client import SafeHTTPClient, SecurityError

logger = logging.getLogger(__name__)

class BaseEnricher:
    """
    Base class for all platform-specific enrichers.
    Defines the contract for extracting metadata and determining if AI is needed.
    """
    platform_name = "Unknown"
    content_type = "Website"

    def __init__(self):
        self.http_client = SafeHTTPClient()

    def fetch_and_extract(self, url: str, domain: str) -> dict:
        """
        Main entry point for extracting metadata.
        """
        metadata = {
            "platform": self.platform_name,
            "content_type": self.content_type,
            "page_title": "",
            "page_description": "",
            "favicon_url": "",
            "thumbnail_url": "",
            "site_name": "",
            "author": "",
            "reading_time": "",
            "canonical_url": url,
            "raw_text": ""
        }
        
        try:
            html = self.http_client.fetch_html(url)
            soup = BeautifulSoup(html, 'html.parser')
            
            # Allow subclasses to extract specific fields
            self.extract_metadata(soup, metadata)
            
            # Extract raw text for AI enrichment if needed
            metadata["raw_text"] = self._extract_text(soup)
            
        except SecurityError as e:
            logger.warning(f"Security error fetching {url}: {e}")
        except Exception as e:
            logger.error(f"Error fetching {url}: {e}")
            
        return metadata

    def extract_metadata(self, soup: BeautifulSoup, metadata: dict):
        """
        Extract Open Graph and standard HTML metadata.
        Subclasses can override this for platform-specific logic.
        """
        # Generic Open Graph Extraction
        og_title = soup.find("meta", property="og:title")
        og_desc = soup.find("meta", property="og:description")
        og_image = soup.find("meta", property="og:image")
        og_site_name = soup.find("meta", property="og:site_name")
        og_url = soup.find("meta", property="og:url")

        # HTML Standard Extraction
        title_tag = soup.find("title")
        meta_desc = soup.find("meta", attrs={"name": "description"})
        author_tag = soup.find("meta", attrs={"name": "author"})
        
        # Favicon Extraction
        icon_tag = soup.find("link", rel=lambda x: x and 'icon' in x.lower())
        
        metadata["page_title"] = (og_title["content"] if og_title else "") or (title_tag.text if title_tag else "")
        metadata["page_description"] = (og_desc["content"] if og_desc else "") or (meta_desc["content"] if meta_desc else "")
        metadata["thumbnail_url"] = og_image["content"] if og_image else ""
        metadata["site_name"] = og_site_name["content"] if og_site_name else ""
        metadata["author"] = author_tag["content"] if author_tag else ""
        metadata["canonical_url"] = (og_url["content"] if og_url else "") or metadata["canonical_url"]
        
        if icon_tag and icon_tag.get("href"):
            href = icon_tag["href"]
            if href.startswith("//"):
                href = "https:" + href
            elif href.startswith("/"):
                # Simplistic absolute URL resolution
                parsed = urllib.parse.urlparse(metadata["canonical_url"])
                href = f"{parsed.scheme}://{parsed.netloc}{href}"
            metadata["favicon_url"] = href
            
        # Clean up strings
        metadata["page_title"] = metadata["page_title"].strip()
        metadata["page_description"] = metadata["page_description"].strip()

    def _extract_text(self, soup: BeautifulSoup) -> str:
        """
        Extract plain text for AI enrichment, stripping scripts and styles.
        """
        for script in soup(["script", "style", "noscript", "header", "footer", "nav"]):
            script.decompose()
        
        text = soup.get_text(separator=' ')
        # Collapse whitespace
        text = ' '.join(text.split())
        return text[:4000] # Limit context size for AI

    def is_metadata_sufficient(self, metadata: dict) -> bool:
        """
        Determine if the extracted metadata is good enough to skip AI enrichment.
        Subclasses can override this based on platform characteristics.
        """
        return bool(metadata.get("page_title") and metadata.get("page_description"))

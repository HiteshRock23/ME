import socket
import urllib.parse
from ipaddress import ip_address, IPv4Address, IPv6Address
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import logging

logger = logging.getLogger(__name__)

class SecurityError(Exception):
    pass

def is_safe_url(url: str) -> bool:
    """
    Validates URL to prevent SSRF attacks.
    Rejects localhost, loopback, private, and reserved IP ranges.
    """
    try:
        parsed = urllib.parse.urlparse(url)
        hostname = parsed.hostname
        if not hostname:
            return False

        # Resolve hostname to IP
        try:
            ip = socket.gethostbyname(hostname)
        except socket.gaierror:
            return False

        parsed_ip = ip_address(ip)
        
        # Reject private, loopback, link-local, multicast, etc.
        if (
            parsed_ip.is_private or
            parsed_ip.is_loopback or
            parsed_ip.is_link_local or
            parsed_ip.is_multicast or
            parsed_ip.is_reserved or
            parsed_ip.is_unspecified
        ):
            return False
            
        return True
    except Exception:
        return False

class SafeHTTPClient:
    """
    A secure HTTP client for fetching webpage metadata.
    Includes SSRF protection, size limits, timeouts, and safe headers.
    """
    MAX_DOWNLOAD_SIZE = 512 * 1024  # 512 KB
    TIMEOUT = 5  # seconds
    MAX_REDIRECTS = 5

    def __init__(self):
        self.session = requests.Session()
        
        # Setup retries for transient failures (e.g., 500, 502, 503, 504)
        retries = Retry(
            total=3,
            backoff_factor=0.5,
            status_forcelist=[500, 502, 503, 504],
            allowed_methods=["GET", "HEAD"]
        )
        adapter = HTTPAdapter(max_retries=retries)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        })

    def fetch_html(self, url: str) -> str:
        """
        Securely fetches HTML content from a URL.
        """
        if not is_safe_url(url):
            raise SecurityError(f"URL failed security validation: {url}")

        try:
            # We use stream=True to enforce size limits before downloading everything
            response = self.session.get(
                url, 
                timeout=self.TIMEOUT, 
                stream=True,
                allow_redirects=True
            )
            
            # Check redirect limit (requests handles this mostly, but we can verify history)
            if len(response.history) > self.MAX_REDIRECTS:
                raise SecurityError("Too many redirects")
                
            response.raise_for_status()

            # Validate Content-Type
            content_type = response.headers.get("Content-Type", "").lower()
            if not content_type.startswith("text/html") and not content_type.startswith("text/xml"):
                raise SecurityError(f"Invalid Content-Type: {content_type}")

            # Enforce size limit while reading
            content = b""
            for chunk in response.iter_content(chunk_size=8192):
                content += chunk
                if len(content) > self.MAX_DOWNLOAD_SIZE:
                    logger.warning("Response exceeded 512KB limit, truncating.")
                    break

            # Try to decode the content
            encoding = response.encoding or 'utf-8'
            try:
                return content.decode(encoding)
            except UnicodeDecodeError:
                return content.decode('utf-8', errors='replace')
                
        except requests.RequestException as e:
            logger.error(f"HTTP request failed for {url}: {e}")
            raise

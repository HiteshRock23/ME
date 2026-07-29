import urllib.parse

class URLNormalizer:
    """
    Normalizes URLs to improve caching and duplicate detection.
    Strips tracking parameters and normalizes schemes.
    """
    TRACKING_PARAMS = {
        "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
        "fbclid", "gclid", "ref", "igshid", "_gl"
    }

    @classmethod
    def normalize(cls, raw_url: str) -> str:
        """
        Normalize the URL by removing common tracking parameters.
        Returns the clean URL.
        """
        if not raw_url:
            return ""

        # Normalize scheme
        url = raw_url.strip()
        if url.lower().startswith("www."):
            url = "https://" + url
        elif not url.lower().startswith(("http://", "https://")):
            url = "https://" + url

        try:
            parsed = urllib.parse.urlparse(url)
            query_params = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
            
            # Filter out tracking parameters
            clean_params = [(k, v) for k, v in query_params if k.lower() not in cls.TRACKING_PARAMS]
            
            # Reconstruct the query string
            clean_query = urllib.parse.urlencode(clean_params)
            
            # Reconstruct the URL
            clean_url = urllib.parse.urlunparse((
                parsed.scheme,
                parsed.netloc,
                parsed.path,
                parsed.params,
                clean_query,
                parsed.fragment
            ))
            return clean_url
        except Exception:
            # If parsing fails, return original
            return url

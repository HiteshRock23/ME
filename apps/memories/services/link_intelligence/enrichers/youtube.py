import re
import logging
import requests

from apps.memories.services.link_intelligence.enrichers.base import BaseEnricher

logger = logging.getLogger(__name__)

# YouTube's official oEmbed endpoint. Free, no auth required, always accurate.
YOUTUBE_OEMBED_URL = "https://www.youtube.com/oembed?url={url}&format=json"

# Matches youtube.com/watch?v=ID  and  youtu.be/ID
_VIDEO_ID_RE = re.compile(
    r'(?:youtube\.com/watch\?.*?v=|youtu\.be/)([A-Za-z0-9_-]{11})'
)


class YouTubeEnricher(BaseEnricher):
    """
    Enricher for YouTube video URLs.

    YouTube is a JavaScript-rendered SPA — plain HTML scraping yields no
    useful Open Graph tags.  We use YouTube's official oEmbed API instead,
    which is free, requires no credentials, and returns the exact title,
    author, and thumbnail for any public video.
    """

    platform_name = "YouTube"
    content_type = "Video"

    def fetch_and_extract(self, url: str, domain: str) -> dict:
        metadata = {
            "platform": self.platform_name,
            "content_type": self.content_type,
            "page_title": "",
            "page_description": "",
            "favicon_url": "https://www.youtube.com/favicon.ico",
            "thumbnail_url": "",
            "site_name": "YouTube",
            "author": "",
            "reading_time": "",
            "canonical_url": url,
            "raw_text": "",
        }

        # Extract video ID from the URL
        match = _VIDEO_ID_RE.search(url)
        if not match:
            logger.warning(f"[YouTubeEnricher] Could not extract video ID from: {url}")
            return metadata

        video_id = match.group(1)

        # Canonical URL is always the /watch?v= form
        canonical = f"https://www.youtube.com/watch?v={video_id}"
        metadata["canonical_url"] = canonical

        # Thumbnail: YouTube provides standard URLs for each quality tier.
        # maxresdefault is the best, with hqdefault as a reliable fallback.
        metadata["thumbnail_url"] = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"

        # Call oEmbed — this is the official, supported, no-auth YouTube API
        oembed_url = YOUTUBE_OEMBED_URL.format(url=canonical)
        try:
            response = requests.get(
                oembed_url,
                timeout=8,
                headers={
                    "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
                },
            )
            if response.ok:
                data = response.json()
                title = data.get("title", "")
                author = data.get("author_name", "")
                thumb = data.get("thumbnail_url", "")

                metadata["page_title"] = title
                metadata["page_description"] = f"{title} — YouTube video by {author}" if author else title
                metadata["author"] = author
                if thumb:
                    metadata["thumbnail_url"] = thumb
                metadata["raw_text"] = f"YouTube video: {title}. Channel: {author}."

                logger.info(f"[YouTubeEnricher] oEmbed success — title: {title!r}, author: {author!r}")
            else:
                logger.warning(
                    f"[YouTubeEnricher] oEmbed returned {response.status_code} for video {video_id}"
                )
        except Exception as e:
            logger.error(f"[YouTubeEnricher] oEmbed request failed for {video_id}: {e}")

        return metadata

    def is_metadata_sufficient(self, metadata: dict) -> bool:
        # oEmbed always gives us a clean title and author when it succeeds.
        # No AI enrichment needed.
        return bool(metadata.get("page_title"))

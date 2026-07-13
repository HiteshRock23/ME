"""
Link Metadata Extractor — Deterministic metadata extraction for LINK memories.

Responsibilities:
    - Map known domains to human-readable display names and titles.
    - Fall back gracefully to "Saved Link" for unknown domains.

This extractor must NOT:
    - Fetch the URL
    - Scrape website content
    - Call OpenGraph APIs
    - Call any AI
    - Make any network request

V1.1 is intentionally simple: domain → display name.
V2 can replace or extend this with real metadata fetching
without changing any other layer.
"""

from apps.memories.services.metadata.base import BaseMetadataExtractor, ExtractedMetadata


# ---------------------------------------------------------------------------
# Domain mapping table
# Maps cleaned domain strings (as returned by ContentClassifier) to
# (display_title, display_name) tuples.
# ---------------------------------------------------------------------------
_DOMAIN_MAP: dict[str, tuple[str, str]] = {
    # Code & Development
    "github.com":           ("GitHub Link",           "GitHub"),
    "gitlab.com":           ("GitLab Link",            "GitLab"),
    "stackoverflow.com":    ("Stack Overflow Answer",  "Stack Overflow"),
    "gist.github.com":      ("GitHub Gist",            "GitHub Gist"),

    # Video
    "youtube.com":          ("YouTube Video",          "YouTube"),
    "youtu.be":             ("YouTube Video",          "YouTube"),
    "vimeo.com":            ("Vimeo Video",            "Vimeo"),

    # Social & Discussion
    "reddit.com":           ("Reddit Discussion",      "Reddit"),
    "twitter.com":          ("Tweet",                  "Twitter"),
    "x.com":                ("Tweet",                  "X"),
    "linkedin.com":         ("LinkedIn Post",          "LinkedIn"),
    "news.ycombinator.com": ("Hacker News",            "Hacker News"),

    # Reading & Writing
    "medium.com":           ("Medium Article",         "Medium"),
    "substack.com":         ("Substack Post",          "Substack"),
    "dev.to":               ("Dev.to Article",         "Dev.to"),
    "hashnode.com":         ("Hashnode Article",       "Hashnode"),

    # Research & Academia
    "arxiv.org":            ("Research Paper",         "arXiv"),
    "scholar.google.com":   ("Google Scholar Article", "Google Scholar"),
    "semanticscholar.org":  ("Research Paper",         "Semantic Scholar"),

    # Google Workspace
    "docs.google.com":      ("Google Document",        "Google Docs"),
    "drive.google.com":     ("Google Drive File",      "Google Drive"),
    "sheets.google.com":    ("Google Sheet",           "Google Sheets"),
    "slides.google.com":    ("Google Slides",          "Google Slides"),

    # Productivity
    "notion.so":            ("Notion Page",            "Notion"),
    "obsidian.md":          ("Obsidian Note",          "Obsidian"),
    "roamresearch.com":     ("Roam Research Note",     "Roam Research"),

    # News
    "nytimes.com":          ("New York Times Article", "NYT"),
    "theguardian.com":      ("The Guardian Article",   "The Guardian"),
    "bbc.com":              ("BBC Article",            "BBC"),
    "reuters.com":          ("Reuters Article",        "Reuters"),
    "techcrunch.com":       ("TechCrunch Article",     "TechCrunch"),
    "wired.com":            ("Wired Article",          "Wired"),
    "theverge.com":         ("The Verge Article",      "The Verge"),

    # AI & ML
    "huggingface.co":       ("Hugging Face",           "Hugging Face"),
    "openai.com":           ("OpenAI",                 "OpenAI"),
    "anthropic.com":        ("Anthropic",              "Anthropic"),
    "deepmind.google":      ("DeepMind",               "DeepMind"),
}

_DEFAULT_TITLE = "Saved Link"
_DEFAULT_NAME = "Web Link"


class LinkMetadataExtractor(BaseMetadataExtractor):
    """
    Extracts metadata for LINK memories using a domain lookup table.

    Usage:
        extractor = LinkMetadataExtractor()
        metadata = extractor.extract(domain="github.com", url="https://...")
    """

    def extract(self, domain: str = "", url: str = "") -> ExtractedMetadata:
        """
        Extract display metadata for a link memory.

        Args:
            domain: The cleaned domain string (e.g. "github.com").
                    As returned by ContentClassifier._extract_domain().
            url:    The full normalized URL (unused in V1.1, reserved for V2).

        Returns:
            ExtractedMetadata with display_title and display_name.
        """
        title, name = _DOMAIN_MAP.get(domain, (_DEFAULT_TITLE, _DEFAULT_NAME))
        return ExtractedMetadata(display_title=title, display_name=name)

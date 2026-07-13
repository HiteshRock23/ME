"""
Content Classifier — Deterministic input classification.

This service is the entry point for ME's Intelligent Capture Pipeline.
It inspects the raw user input and determines what type of content it is.

Responsibilities:
    - Trim whitespace
    - Detect valid URLs (https://, http://, www.)
    - Normalize URLs (www. → https://www.)
    - Extract the domain
    - Return a structured ContentClassification result

This service must NOT:
    - Call AI or any LLM
    - Communicate with external APIs
    - Access the database
    - Modify any state

It only classifies. Nothing else.
"""

from dataclasses import dataclass
from typing import Optional
import urllib.parse


@dataclass(frozen=True)
class ContentClassification:
    """
    The structured result of classifying a raw input string.

    Attributes:
        memory_type: The determined type ("text" | "link").
        url:         The normalized URL, or None for text memories.
        domain:      The extracted hostname (e.g. "github.com"), or None.
    """

    memory_type: str
    url: Optional[str]
    domain: Optional[str]


class ContentClassifier:
    """
    Classifies raw user input into a structured ContentClassification.

    Detection strategy (deterministic, stdlib only, no regex):
        1. Strip whitespace.
        2. If the input contains a space or newline → TEXT immediately.
           (Valid URLs never contain spaces.)
        3. Normalise bare "www." prefixes by prepending "https://".
        4. Parse with urllib.parse.urlparse.
        5. Accept as LINK if:
               - scheme is "http" or "https"
               - netloc is non-empty
               - netloc contains at least one "." (has a TLD)
        6. Extract domain from netloc (strip leading "www.").
        7. Otherwise → TEXT.

    Why this approach:
        - Zero false positives: sentences like "u.s. policy" are never
          misclassified because they contain spaces.
        - Covers all common URL patterns pasted from a browser.
        - Bare hostnames (e.g. "github.com" with no scheme) are treated
          as TEXT. Browsers always include the scheme when copying URLs.
    """

    _VALID_SCHEMES = frozenset({"http", "https"})

    @classmethod
    def classify(cls, raw_input: str) -> ContentClassification:
        """
        Classify the raw input and return a ContentClassification.

        Args:
            raw_input: The user's unprocessed input string.

        Returns:
            A frozen ContentClassification dataclass.
        """
        text = raw_input.strip()

        if not text:
            return cls._as_text()

        # URLs never contain whitespace — fast exit for plain text
        if " " in text or "\n" in text or "\t" in text:
            return cls._as_text()

        # Normalise bare www. prefix so urlparse can handle it
        normalized = text
        if text.lower().startswith("www."):
            normalized = "https://" + text

        parsed = urllib.parse.urlparse(normalized)

        if cls._is_valid_url(parsed):
            domain = cls._extract_domain(parsed.netloc)
            return ContentClassification(
                memory_type="link",
                url=normalized,
                domain=domain,
            )

        return cls._as_text()

    # -------------------------------------------------------------------------
    # Private helpers
    # -------------------------------------------------------------------------

    @classmethod
    def _is_valid_url(cls, parsed: urllib.parse.ParseResult) -> bool:
        """Return True if the parsed URL has a valid scheme and host."""
        return (
            parsed.scheme in cls._VALID_SCHEMES
            and bool(parsed.netloc)
            and "." in parsed.netloc
        )

    @staticmethod
    def _extract_domain(netloc: str) -> str:
        """
        Extract the clean domain from a netloc string.

        Strips port number and leading "www." prefix.
        Examples:
            "www.github.com"  → "github.com"
            "github.com:443"  → "github.com"
            "docs.google.com" → "docs.google.com"  (subdomain preserved)
        """
        # Remove port if present
        host = netloc.split(":")[0].lower()
        # Strip leading www. only (preserve meaningful subdomains like docs.)
        if host.startswith("www."):
            host = host[4:]
        return host

    @staticmethod
    def _as_text() -> ContentClassification:
        """Return a TEXT classification with empty URL fields."""
        return ContentClassification(memory_type="text", url=None, domain=None)

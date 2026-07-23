import logging
from typing import List, Dict, Any, Optional
from apps.memories.services.retrieval_pipeline import RetrievalPipeline, RetrievalConfig, ReferencedMemory
from apps.memories.services.exceptions import SupermemoryError

logger = logging.getLogger(__name__)


class SearchServiceError(Exception):
    pass


def perform_search(user, query: str, config: Optional[RetrievalConfig] = None) -> List[Dict[str, Any]]:
    """
    Perform a semantic search for memories belonging to the given user.

    Uses RetrievalPipeline to execute confidence-based filtering, deduplication,
    ownership verification, ranking, and DTO serialization.

    Args:
        user: The authenticated user making the request.
        query: The natural language search string.
        config: Optional RetrievalConfig settings.

    Returns:
        List of serialized ReferencedMemory dictionaries (similarity scores kept internal).
    """
    if not query or not query.strip():
        raise SearchServiceError("Search query cannot be empty.")

    query = query.strip()

    try:
        referenced_memories: List[ReferencedMemory] = RetrievalPipeline.execute(user, query, config=config)
        # Serialize DTOs for public API response (omitting internal similarity score)
        return [mem.to_dict() for mem in referenced_memories]
    except SupermemoryError:
        raise
    except Exception as exc:
        logger.exception("SearchService: Unexpected error during search for user %s: %s", user.pk, exc)
        raise SearchServiceError("Failed to execute search query.")

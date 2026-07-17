import logging
from typing import List, Dict, Any
from apps.memories.models import Memory
from apps.memories.services.supermemory_service import SupermemoryService
from apps.memories.services.exceptions import SupermemoryError

logger = logging.getLogger(__name__)

class SearchServiceError(Exception):
    pass

def perform_search(user, query: str) -> List[Dict[str, Any]]:
    """
    Perform a semantic search for memories belonging to the given user.

    Pipeline:
        1. Validate the query.
        2. Query Supermemory Local for ranked semantic results.
        3. Parse the local PostgreSQL IDs from the Supermemory document IDs.
        4. Query PostgreSQL for those memories, ensuring they belong to the user.
        5. Re-sort the PostgreSQL results to match the semantic ranking from Supermemory.

    Args:
        user: The authenticated user making the request.
        query: The natural language search string.

    Returns:
        A list of dictionaries containing memory data, ordered by relevance.

    Raises:
        SearchServiceError: For validation or internal errors.
        SupermemoryError: For downstream connectivity/API issues.
    """
    if not query or not query.strip():
        raise SearchServiceError("Search query cannot be empty.")

    query = query.strip()
    logger.info("Search Started: user=%s, query='%s'", user.pk, query)

    # 1. Fetch semantic ranking from Supermemory
    sm_service = SupermemoryService()
    sm_results = sm_service.search(query)

    if not sm_results:
        logger.info("Search Completed: 0 results from Supermemory")
        return []

    # 2. Extract database primary keys and map scores
    pk_to_score = {}
    ranked_pks = []
    
    for item in sm_results:
        # v4 uses 'similarity' instead of 'score'
        score = item.get("similarity", item.get("score", 0.0))
        
        # In v4, we store 'memory_id' in metadata.
        # Fallback to parsing the string ID for backwards compatibility with v3 data.
        metadata = item.get("metadata") or {}
        pk = metadata.get("memory_id")
        
        if pk is None:
            # Fallback for old documents that had customId = "me_memory_<pk>"
            # In v4, this might be returned as 'id' instead of 'documentId'.
            doc_id = item.get("id", item.get("documentId", ""))
            if isinstance(doc_id, str) and doc_id.startswith("me_memory_"):
                try:
                    pk = int(doc_id.split("_")[-1])
                except (ValueError, TypeError):
                    continue
                    
        if pk is not None:
            try:
                pk = int(pk)
                pk_to_score[pk] = score
                ranked_pks.append(pk)
            except (ValueError, TypeError):
                continue

    if not ranked_pks:
        return []

    # 3. Fetch from PostgreSQL and verify ownership
    # We only retrieve memories that belong to this exact user.
    memories = Memory.objects.filter(pk__in=ranked_pks, user=user)
    
    # 4. Map back to application response format and preserve semantic ranking
    memory_map = {m.pk: m for m in memories}
    results = []
    
    for pk in ranked_pks:
        if pk in memory_map:
            mem = memory_map[pk]
            results.append({
                "id": mem.id,
                "raw_content": mem.raw_content,
                "ai_title": mem.ai_title,
                "ai_summary": mem.ai_summary,
                "created_at": mem.created_at.isoformat(),
                "score": pk_to_score[pk]  # Preserve for future AI use, not strictly needed for frontend right now
            })

    logger.info("Search Completed: returning %d verified results", len(results))
    return results

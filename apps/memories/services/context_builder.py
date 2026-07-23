from typing import List, Union, Dict, Any
from apps.memories.services.retrieval_pipeline import ReferencedMemory

class ContextBuilder:
    """
    Builds the context string for the LLM using retrieved memories.
    Maintains a consistent, deterministic format to improve reasoning.
    """

    @staticmethod
    def build_context(memories: List[Union[ReferencedMemory, Dict[str, Any]]], max_memories: int = 5) -> str:
        """
        Formats a list of memory DTOs or dictionaries into a single context string.
        Limits the number of memories to prevent exceeding context window.
        """
        formatted_blocks = []
        for item in memories[:max_memories]:
            if isinstance(item, ReferencedMemory):
                mem_id = item.id
                title = item.title
                preview = item.preview
                created_at = item.created_at.split('T')[0] if 'T' in item.created_at else item.created_at
            else:
                mem_id = item.get("id", "N/A")
                title = item.get("title") or item.get("ai_title") or "Untitled"
                preview = item.get("preview") or item.get("ai_summary") or item.get("raw_content", "")
                created_at = str(item.get("created_at", "")).split('T')[0]

            block = [
                f"Memory ID: {mem_id}",
                f"Title:\n{title}",
                f"Content/Summary:\n{preview}",
                f"Created:\n{created_at}"
            ]
            formatted_blocks.append("\n".join(block))

        return "\n---\n".join(formatted_blocks)

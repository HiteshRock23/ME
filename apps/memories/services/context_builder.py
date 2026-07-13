from typing import List, Dict, Any

class ContextBuilder:
    """
    Builds the context string for the LLM using retrieved memories.
    Maintains a consistent, deterministic format to improve reasoning.
    """
    
    @staticmethod
    def build_context(memories: List[Dict[str, Any]], max_memories: int = 5) -> str:
        """
        Formats a list of memory dictionaries into a single context string.
        Limits the number of memories to prevent exceeding context window.
        """
        formatted_blocks = []
        for memory in memories[:max_memories]:
            block = [
                f"Memory ID: {memory['id']}",
                f"Title:\n{memory.get('ai_title') or 'Untitled'}",
                f"Summary:\n{memory.get('ai_summary') or 'N/A'}",
                f"Original Memory:\n{memory['raw_content']}",
                f"Created:\n{memory['created_at'].split('T')[0]}"
            ]
            formatted_blocks.append("\n".join(block))
            
        return "\n---\n".join(formatted_blocks)

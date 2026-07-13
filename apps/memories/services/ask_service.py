import logging
from typing import Dict, Any

from apps.memories.services.search_service import perform_search, SearchServiceError
from apps.memories.services.context_builder import ContextBuilder
from apps.memories.services.ai.factory import get_llm_provider
from apps.memories.services.ai.base import LLMProviderError
from apps.memories.services.ai.validator import ResponseValidator, ResponseValidatorError

logger = logging.getLogger(__name__)

PROMPT_TEMPLATE = """You are ME. You are a personal memory assistant.
You answer ONLY using the supplied memories.

Rules:
* Never invent information.
* Never use outside knowledge.
* Never guess.
* If the memories do not contain enough information, explicitly say so.
* Answer clearly and concisely.

Return valid JSON only.
Example:
{{
  "answer": "...",
  "confidence": "high"
}}

Question: {question}
Context:
{formatted_memories}
"""

class AskServiceError(Exception):
    pass

class AskService:
    """
    Orchestrates the RAG pipeline for the Ask ME feature.
    """
    
    # Minimum semantic similarity score to include a memory in the context
    RELEVANCE_THRESHOLD = 0.60
    
    @classmethod
    def ask_question(cls, user, question: str) -> Dict[str, Any]:
        """
        Processes a user's question, retrieves relevant memories, and generates a grounded answer.
        
        Returns:
            Dict containing the answer and the sources used.
        """
        if not question or not question.strip():
            raise AskServiceError("Question cannot be empty.")
            
        logger.info("AskService: Received question from user %s", user.pk)
        
        # 1. Retrieve ranked memories
        try:
            results = perform_search(user, question)
        except SearchServiceError as e:
            raise AskServiceError(str(e))
            
        # 2. Filter by relevance threshold
        relevant_memories = [m for m in results if m.get("score", 0.0) >= cls.RELEVANCE_THRESHOLD]
        
        logger.info("AskService: Found %d memories above threshold %s", len(relevant_memories), cls.RELEVANCE_THRESHOLD)
        
        # 3. Handle empty state
        if not relevant_memories:
            return {
                "question": question,
                "answer": "I couldn't find enough relevant memories to answer this question.",
                "retrieved_count": 0,
                "sources": []
            }
            
        # 4. Build Context
        context_string = ContextBuilder.build_context(relevant_memories, max_memories=5)
        
        # 5. Prepare Prompt
        prompt = PROMPT_TEMPLATE.format(
            question=question,
            formatted_memories=context_string
        )
        
        # 6. Generate Answer
        provider = get_llm_provider()
        try:
            response_text = provider.generate_answer(prompt)
        except LLMProviderError as e:
            logger.error("AskService LLM Error: %s", str(e))
            raise AskServiceError("Failed to generate an answer due to an AI service error.")
            
        # 7. Validate JSON Response
        try:
            data = ResponseValidator.validate_answer(response_text)
        except ResponseValidatorError as e:
            logger.error("AskService Validation Error: %s", str(e))
            raise AskServiceError("Received an invalid response format from the AI.")
            
        answer = data["answer"]
            
        # 8. Source Attribution & Formatting
        sources = []
        for mem in relevant_memories[:5]:
            sources.append({
                "memory_id": mem["id"],
                "title": mem.get("ai_title") or "Untitled",
                "summary": mem.get("ai_summary") or mem["raw_content"][:100] + "..."
            })
            
        return {
            "question": question,
            "answer": answer.strip(),
            "retrieved_count": len(sources),
            "sources": sources
        }

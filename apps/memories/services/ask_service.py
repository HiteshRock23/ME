import logging
from typing import Dict, Any, List, Optional

from apps.memories.services.retrieval_pipeline import RetrievalPipeline, RetrievalConfig, ReferencedMemory
from apps.memories.services.context_builder import ContextBuilder
from apps.memories.services.ai.factory import get_llm_provider
from apps.memories.services.ai.base import LLMProviderError
from apps.memories.services.ai.validator import ResponseValidator, ResponseValidatorError
from apps.memories.services.exceptions import SupermemoryError

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

    @classmethod
    def ask_question(cls, user, question: str, config: Optional[RetrievalConfig] = None) -> Dict[str, Any]:
        """
        Processes a user's question, retrieves relevant memories via RetrievalPipeline,
        and generates a grounded answer.

        Returns:
            Dict containing the answer and referenced_memories list.
        """
        if not question or not question.strip():
            raise AskServiceError("Question cannot be empty.")

        clean_question = question.strip()
        logger.info("AskService: Received question from user %s: '%s'", user.pk, clean_question)

        # 1. Retrieve ranked referenced memories via RetrievalPipeline
        try:
            referenced_memories: List[ReferencedMemory] = RetrievalPipeline.execute(user, clean_question, config=config)
        except SupermemoryError:
            raise
        except Exception as exc:
            logger.exception("AskService: Error executing retrieval pipeline for user %s: %s", user.pk, exc)
            raise AskServiceError("Failed to retrieve memories.")

        logger.info("AskService: %d high-confidence memories retrieved", len(referenced_memories))

        # 2. Handle empty retrieval state
        if not referenced_memories:
            return {
                "question": clean_question,
                "answer": f"I couldn't find any relevant memories related to '{clean_question}'.",
                "retrieved_count": 0,
                "referenced_memories": [],
                "sources": []  # Backward compatibility alias
            }

        # 3. Build Context
        context_string = ContextBuilder.build_context(referenced_memories, max_memories=5)

        # 4. Prepare Prompt
        prompt = PROMPT_TEMPLATE.format(
            question=clean_question,
            formatted_memories=context_string
        )

        # 5. Generate Answer
        provider = get_llm_provider()
        try:
            response_text = provider.generate_answer(prompt)
        except LLMProviderError as e:
            logger.error("AskService LLM Error: %s", str(e))
            raise AskServiceError("Failed to generate an answer due to an AI service error.")

        # 6. Validate JSON Response
        try:
            data = ResponseValidator.validate_answer(response_text)
        except ResponseValidatorError as e:
            logger.error("AskService Validation Error: %s", str(e))
            raise AskServiceError("Received an invalid response format from the AI.")

        answer = data["answer"]

        # 7. Serialize DTOs for public API response (internal scores excluded)
        serialized_references = [mem.to_dict() for mem in referenced_memories]

        return {
            "question": clean_question,
            "answer": answer.strip(),
            "retrieved_count": len(serialized_references),
            "referenced_memories": serialized_references,
            "sources": serialized_references  # Alias for backward compatibility
        }

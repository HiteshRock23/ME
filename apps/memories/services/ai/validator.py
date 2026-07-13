import json
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class ResponseValidatorError(Exception):
    """Raised when an LLM response cannot be parsed or fails schema validation."""
    pass


class ResponseValidator:
    """
    Dedicated layer for validating and parsing raw text responses from LLM Providers.
    Ensures that business services only ever receive guaranteed valid dictionaries.
    """

    @staticmethod
    def _parse_json(response_text: str) -> Dict[str, Any]:
        """Attempt to extract and parse JSON from the raw LLM string."""
        if not response_text:
            raise ResponseValidatorError("LLM returned an empty response.")
            
        text = response_text.strip()
        
        # Clean markdown code blocks if the LLM hallucinated them
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
            
        if text.endswith("```"):
            text = text[:-3]
            
        text = text.strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            logger.error("Failed to decode JSON. Raw response: %s", response_text)
            raise ResponseValidatorError(f"Invalid JSON returned by LLM: {str(e)}")

    @staticmethod
    def validate_enrichment(response_text: str) -> Dict[str, str]:
        """
        Validates the enrichment response.
        Expects: {"title": "...", "summary": "..."}
        """
        data = ResponseValidator._parse_json(response_text)
        
        title = data.get("title")
        summary = data.get("summary")
        
        if not isinstance(title, str) or not isinstance(summary, str):
            raise ResponseValidatorError("Enrichment JSON must contain 'title' and 'summary' as strings.")
            
        return {
            "title": title.strip(),
            "summary": summary.strip()
        }

    @staticmethod
    def validate_answer(response_text: str) -> Dict[str, str]:
        """
        Validates the Ask ME response.
        Expects: {"answer": "..."} (and optionally "confidence", but only "answer" is strictly required by the business logic)
        """
        data = ResponseValidator._parse_json(response_text)
        
        answer = data.get("answer")
        
        if not isinstance(answer, str):
            raise ResponseValidatorError("Ask ME JSON must contain 'answer' as a string.")
            
        return {
            "answer": answer.strip()
        }

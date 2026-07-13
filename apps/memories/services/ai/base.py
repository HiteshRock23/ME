import abc
from typing import Dict

class LLMProviderError(Exception):
    """Raised when the LLM provider fails to generate an enrichment."""
    pass

class LLMProvider(abc.ABC):
    @abc.abstractmethod
    def generate_enrichment(self, raw_memory: str) -> str:
        """
        Generate an enrichment for the given memory.
        
        Args:
            raw_memory: The original raw memory text.
            
        Returns:
            A raw string containing the JSON response from the LLM.
            Validation happens in the EnrichmentService.
            
        Raises:
            LLMProviderError: If the API call fails or times out.
        """
        pass

    @abc.abstractmethod
    def generate_answer(self, prompt: str) -> str:
        """
        Generate an answer to a user's question using the provided context.
        
        Args:
            prompt: The fully constructed prompt containing context and question.
            
        Returns:
            A raw string containing the JSON response from the LLM.
            
        Raises:
            LLMProviderError: If the API call fails or times out.
        """
        pass

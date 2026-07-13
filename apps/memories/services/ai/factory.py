import os
from django.conf import settings
from .base import LLMProvider
from .providers.nvidia import NvidiaProvider

def get_llm_provider() -> LLMProvider:
    """
    Factory function to return the configured LLM provider.
    Currently routes all requests to NvidiaProvider.
    """
    provider_name = getattr(settings, "LLM_PROVIDER", "nvidia").lower()
    
    if provider_name == "nvidia":
        return NvidiaProvider()
    else:
        # Fallback to nvidia for now since it is the only configured production provider
        return NvidiaProvider()


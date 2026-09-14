import os
from django.conf import settings
from .base import LLMProvider
from .providers.nvidia import NvidiaProvider
from .providers.google import GeminiProvider

def get_llm_provider() -> LLMProvider:
    """
    Factory function to return the configured LLM provider.
    Supports 'nvidia' and 'google' (or 'gemini').
    """
    provider_name = getattr(settings, "LLM_PROVIDER", "nvidia").lower().strip()
    
    if provider_name in ["google", "gemini"]:
        return GeminiProvider()
    elif provider_name == "nvidia":
        return NvidiaProvider()
    else:
        return NvidiaProvider()



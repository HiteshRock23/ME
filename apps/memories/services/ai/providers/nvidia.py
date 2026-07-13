import json
import urllib.request
import urllib.error
from django.conf import settings
from apps.memories.services.ai.base import LLMProvider, LLMProviderError

class NvidiaProvider(LLMProvider):
    """
    Provider implementation for NVIDIA AI endpoints.
    Communicates with https://integrate.api.nvidia.com/v1/chat/completions
    """

    def __init__(self):
        self.api_key = getattr(settings, "AI_API", "")
        self.model = getattr(settings, "AI_MODEL", "meta/llama-3.1-8b-instruct")
        self.url = "https://integrate.api.nvidia.com/v1/chat/completions"

        if not self.api_key:
            raise LLMProviderError("NvidiaProvider initialized without AI_API key in settings.")

    def _call_api(self, prompt: str, system_prompt: str = "") -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        data = {
            "model": self.model,
            "messages": messages,
            "max_tokens": 1024,
            "temperature": 0.3
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

        req = urllib.request.Request(
            self.url,
            data=json.dumps(data).encode("utf-8"),
            headers=headers,
            method="POST"
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                response_data = response.read().decode("utf-8")
                parsed = json.loads(response_data)
                
                choices = parsed.get("choices", [])
                if not choices:
                    raise LLMProviderError("No choices returned from Nvidia API.")
                
                content = choices[0].get("message", {}).get("content", "")
                
                # LLM can sometimes return markdown wrapped JSON like ```json\n{...}\n```
                # We do a basic strip if it does that, though validation is handled in business logic
                content = content.strip()
                if content.startswith("```json"):
                    content = content[7:]
                if content.startswith("```"):
                    content = content[3:]
                if content.endswith("```"):
                    content = content[:-3]
                    
                return content.strip()
                
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8")
            raise LLMProviderError(f"HTTPError {e.code} from Nvidia API: {error_body}")
        except urllib.error.URLError as e:
            raise LLMProviderError(f"URLError connecting to Nvidia API: {e.reason}")
        except Exception as e:
            raise LLMProviderError(f"Unexpected error communicating with Nvidia API: {str(e)}")

    def generate_enrichment(self, raw_memory: str) -> str:
        """
        Generate an enrichment for the given memory.
        """
        return self._call_api(prompt=raw_memory)

    def generate_answer(self, prompt: str) -> str:
        """
        Generate an answer to a user's question.
        """
        return self._call_api(prompt=prompt)

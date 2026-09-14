import json
import urllib.request
import urllib.error
from django.conf import settings
from apps.memories.services.ai.base import LLMProvider, LLMProviderError


class GeminiProvider(LLMProvider):
    """
    Provider implementation for Google Gemini AI endpoints.
    Communicates with https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
    """

    def __init__(self):
        raw_key = getattr(settings, "AI_API", "").strip().strip('"').strip("'")
        if raw_key.startswith("Bearer "):
            raw_key = raw_key[7:].strip()
        self.api_key = raw_key

        model_setting = getattr(settings, "AI_MODEL", "gemini-3.6-flash").strip()
        if not model_setting or model_setting in ["gemini", "gemini-flash"]:
            self.model = "gemini-3.6-flash"
        else:
            self.model = model_setting

        if not self.api_key:
            raise LLMProviderError("GeminiProvider initialized without AI_API key in settings.")

    def _call_api(self, prompt: str, system_prompt: str = "") -> str:
        model_name = self.model
        if not model_name.startswith("models/"):
            model_name = f"models/{model_name}"

        url = f"https://generativelanguage.googleapis.com/v1beta/{model_name}:generateContent?key={self.api_key}"

        contents = []
        if system_prompt:
            contents.append({
                "role": "user",
                "parts": [{"text": f"System Instructions: {system_prompt}"}]
            })
        contents.append({
            "role": "user",
            "parts": [{"text": prompt}]
        })

        data = {
            "contents": contents,
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 1024
            }
        }

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

        req = urllib.request.Request(
            url,
            data=json.dumps(data).encode("utf-8"),
            headers=headers,
            method="POST"
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                response_data = response.read().decode("utf-8")
                parsed = json.loads(response_data)

                candidates = parsed.get("candidates", [])
                if not candidates:
                    raise LLMProviderError("No candidates returned from Google Gemini API.")

                parts = candidates[0].get("content", {}).get("parts", [])
                if not parts:
                    raise LLMProviderError("No content parts returned from Google Gemini API.")

                content = parts[0].get("text", "").strip()

                if content.startswith("```json"):
                    content = content[7:]
                if content.startswith("```"):
                    content = content[3:]
                if content.endswith("```"):
                    content = content[:-3]

                return content.strip()

        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8")
            raise LLMProviderError(f"HTTPError {e.code} from Google Gemini API: {error_body}")
        except urllib.error.URLError as e:
            raise LLMProviderError(f"URLError connecting to Google Gemini API: {e.reason}")
        except Exception as e:
            raise LLMProviderError(f"Unexpected error communicating with Google Gemini API: {str(e)}")

    def generate_enrichment(self, raw_memory: str) -> str:
        return self._call_api(prompt=raw_memory)

    def generate_answer(self, prompt: str) -> str:
        return self._call_api(prompt=prompt)

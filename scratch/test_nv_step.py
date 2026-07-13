import sys
import os
from openai import OpenAI
from decouple import Config, RepositoryEnv

def log(msg):
    print(msg, flush=True)

# Load .env explicitly
env_path = r"c:\Users\DEll\Desktop\Startup\ME\.env"
config = Config(RepositoryEnv(env_path))

api_key = config("AI_API")
base_url = "https://integrate.api.nvidia.com/v1"

log(f"Key preview: {api_key[:10]}...{api_key[-10:]}")
log(f"Base URL: {base_url}")

log("Initializing client...")
client = OpenAI(
    api_key=api_key,
    base_url=base_url,
    timeout=15.0 # Fast timeout for debugging
)

log("Listing models...")
try:
    models = client.models.list()
    log(f"Received models: {len(models.data)} models found.")
    for m in models.data:
        log(f"Model ID: {m.id}")
except Exception as e:
    log(f"Error listing models: {e}")

log("\nTrying to generate chat completion with z-ai/glm-5.2...")
try:
    completion = client.chat.completions.create(
        model="z-ai/glm-5.2",
        messages=[{"role": "user", "content": "Say hello in one word."}],
        temperature=0.2,
        max_tokens=10
    )
    log("Success!")
    log(f"Response: {completion.choices[0].message.content}")
except Exception as e:
    log(f"Error generating chat: {e}")

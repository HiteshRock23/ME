import sys
from openai import OpenAI
from decouple import Config, RepositoryEnv

def log(msg):
    print(msg, flush=True)

# Load .env explicitly
env_path = r"c:\Users\DEll\Desktop\Startup\ME\.env"
config = Config(RepositoryEnv(env_path))

api_key = config("AI_API")
base_url = "https://integrate.api.nvidia.com/v1"

client = OpenAI(
    api_key=api_key,
    base_url=base_url,
    timeout=10.0
)

models_to_test = [
    "z-ai/glm-5.2",
    "meta/llama-3.1-8b-instruct",
    "google/gemma-2-2b-it"
]

for model in models_to_test:
    log(f"\nTesting chat completion with model: {model}...")
    try:
        completion = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Say hello in one word."}],
            temperature=0.2,
            max_tokens=10
        )
        log(f"SUCCESS! Response: {completion.choices[0].message.content}")
    except Exception as e:
        log(f"FAILED: {e}")

import os
from openai import OpenAI
from decouple import Config, RepositoryEnv

# Load .env explicitly
env_path = r"c:\Users\DEll\Desktop\Startup\ME\.env"
config = Config(RepositoryEnv(env_path))

api_key = config("AI_API")
base_url = "https://integrate.api.nvidia.com/v1"

print(f"Key preview: {api_key[:10]}...{api_key[-10:]}")
print(f"Base URL: {base_url}")

client = OpenAI(
    api_key=api_key,
    base_url=base_url
)

print("Listing models...")
try:
    models = client.models.list()
    for m in models.data:
        if 'glm' in m.id.lower() or 'z-ai' in m.id.lower():
            print(f"Found GLM model: {m.id}")
except Exception as e:
    print(f"Error listing models: {e}")

print("\nTrying to generate chat completion...")
try:
    completion = client.chat.completions.create(
        model="z-ai/glm-5.2",
        messages=[{"role": "user", "content": "Say hello in one word."}],
        temperature=0.2,
        max_tokens=10
    )
    print("Success!")
    print("Response:", completion.choices[0].message.content)
except Exception as e:
    print(f"Error generating chat: {e}")

import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django
django.setup()

from django.test import Client
from rest_framework_simplejwt.tokens import RefreshToken
from apps.users.models import User
from apps.memories.models import Memory

print("--- Testing Ask ME & Retrieval Pipeline Bug Fix ---")

user, _ = User.objects.get_or_create(email="ask_pipeline_test@example.com", defaults={"first_name": "Ask", "last_name": "Test"})

# Ensure user has a memory
mem = Memory.objects.create(
    user=user,
    raw_content="Building Hermes system with python microservices.",
    memory_type=Memory.MemoryType.TEXT,
    ai_title="Hermes Microservices Project",
    ai_summary="Hermes system development using Python.",
    ai_status=Memory.AIStatus.READY
)

token = str(RefreshToken.for_user(user).access_token)
client = Client(HTTP_HOST="localhost")

resp = client.post(
    "/api/memories/ask/",
    {"question": "building hermes"},
    content_type="application/json",
    HTTP_AUTHORIZATION=f"Bearer {token}"
)

print("Ask API Response Status:", resp.status_code)
print("Ask API Payload Keys:", list(resp.json().keys()))

assert resp.status_code == 200, "Ask ME MUST return 200 OK without AttributeError!"
assert "answer" in resp.json()
assert "referenced_memories" in resp.json()

print("--- Ask ME Pipeline Verification Passed Successfully! ---")

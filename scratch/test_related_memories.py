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

print("--- Testing Related Memories Endpoint ---")

# 1. Create or fetch test user
user, _ = User.objects.get_or_create(email="user_related_test@example.com", defaults={"first_name": "Test", "last_name": "User"})

# 2. Create target memory and related memory
mem1 = Memory.objects.create(
    user=user,
    raw_content="PostgreSQL database query optimization techniques and indexing.",
    memory_type=Memory.MemoryType.TEXT,
    ai_title="PostgreSQL Optimization Guide",
    ai_summary="Optimizing database queries and btree indexing.",
    ai_status=Memory.AIStatus.READY
)

mem2 = Memory.objects.create(
    user=user,
    raw_content="Database indexing guidelines for PostgreSQL performance.",
    memory_type=Memory.MemoryType.TEXT,
    ai_title="PostgreSQL Indexing Best Practices",
    ai_summary="Best practices for indexing in PostgreSQL.",
    ai_status=Memory.AIStatus.READY
)

token = str(RefreshToken.for_user(user).access_token)
client = Client(HTTP_HOST="localhost")

resp = client.get(f"/api/memories/{mem1.id}/related/", HTTP_AUTHORIZATION=f"Bearer {token}")
print("Related Memories API Status:", resp.status_code)
assert resp.status_code == 200
data = resp.json()
print("Related Memories Count:", len(data.get("results", [])))
related_ids = [m["id"] for m in data.get("results", [])]
print("Related Memory IDs:", related_ids)

assert mem1.id not in related_ids, "Target memory ID MUST be excluded from related results!"

print("--- Related Memories API Test Passed Successfully! ---")

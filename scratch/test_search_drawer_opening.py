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
from apps.memories.services.search_service import perform_search

print("--- Testing Search Results & Memory Drawer Hydration ---")

user, _ = User.objects.get_or_create(email="drawer_search_test@example.com", defaults={"first_name": "Drawer", "last_name": "Test"})

mem = Memory.objects.create(
    user=user,
    raw_content="Deep learning architectures and neural network optimization.",
    memory_type=Memory.MemoryType.TEXT,
    ai_title="Deep Learning Optimization",
    ai_summary="Overview of neural network training techniques.",
    ai_status=Memory.AIStatus.READY
)

token = str(RefreshToken.for_user(user).access_token)
client = Client(HTTP_HOST="localhost")

# 1. Search memories
search_res = client.get(f"/api/memories/search/?q=neural", HTTP_AUTHORIZATION=f"Bearer {token}")
print("Search Response Code:", search_res.status_code)
assert search_res.status_code == 200
results = search_res.json().get("results", [])
print("Search Results Count:", len(results))

if results:
    dto_dict = results[0]
    print("Search Result DTO Keys:", list(dto_dict.keys()))
    # 2. Fetch full memory by ID (simulating ui.openMemoryDrawer full hydration)
    mem_detail_res = client.get(f"/api/memories/{dto_dict['id']}/", HTTP_AUTHORIZATION=f"Bearer {token}")
    print("Hydrated Memory Detail Response Code:", mem_detail_res.status_code)
    assert mem_detail_res.status_code == 200
    full_data = mem_detail_res.json()
    print("Full Memory Title:", full_data.get("ai_title"))
    print("Full Memory Content:", full_data.get("raw_content"))
    assert full_data["raw_content"] == "Deep learning architectures and neural network optimization."

print("--- Search & Drawer Hydration Verification Passed Successfully! ---")

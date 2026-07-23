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

print("--- Testing Memory Detail API Endpoint & Security ---")

# 1. Create or fetch test users
user1, _ = User.objects.get_or_create(email="user1_detail_test@example.com", defaults={"first_name": "User", "last_name": "One"})
user2, _ = User.objects.get_or_create(email="user2_detail_test@example.com", defaults={"first_name": "User", "last_name": "Two"})

# 2. Create test memory for User 1
mem1 = Memory.objects.create(
    user=user1,
    raw_content="This is a private memory for User 1 about BDNF and exercise.",
    memory_type=Memory.MemoryType.TEXT,
    ai_title="Exercise Increases BDNF",
    ai_summary="Physical exercise stimulates BDNF production.",
    ai_status=Memory.AIStatus.READY
)

token1 = str(RefreshToken.for_user(user1).access_token)
token2 = str(RefreshToken.for_user(user2).access_token)

client = Client(HTTP_HOST="localhost")

# 3. Test Owner Access (User 1 accessing memory 1)
resp1 = client.get(f"/api/memories/{mem1.id}/", HTTP_AUTHORIZATION=f"Bearer {token1}")
print("Owner Detail Access Status:", resp1.status_code)
assert resp1.status_code == 200
data = resp1.json()
print("Owner Memory Title:", data.get("ai_title"))
print("Owner Memory Content:", data.get("raw_content"))
assert data["id"] == mem1.id
assert data["ai_title"] == "Exercise Increases BDNF"

# 4. Test Cross-Tenant Security Access (User 2 attempting to access memory 1)
resp2 = client.get(f"/api/memories/{mem1.id}/", HTTP_AUTHORIZATION=f"Bearer {token2}")
print("Cross-Tenant Detail Access Status:", resp2.status_code)
assert resp2.status_code == 404, "Other users MUST receive 404 Not Found for security isolation!"

print("--- Memory Detail Endpoint Tests Passed Successfully! ---")

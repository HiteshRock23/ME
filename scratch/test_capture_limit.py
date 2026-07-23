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

print("--- Testing 5000 Character Capture Validation ---")

user, _ = User.objects.get_or_create(email="user_limit_test@example.com", defaults={"first_name": "Limit", "last_name": "Test"})
token = str(RefreshToken.for_user(user).access_token)
client = Client(HTTP_HOST="localhost")

# 1. Test Valid Capture (under 5000 chars)
valid_content = "A" * 4999
resp1 = client.post("/api/memories/capture/", {"raw_content": valid_content}, content_type="application/json", HTTP_AUTHORIZATION=f"Bearer {token}")
print("Valid Capture Status:", resp1.status_code)
assert resp1.status_code == 201

# 2. Test Oversized Capture (> 5000 chars)
oversized_content = "A" * 5001
resp2 = client.post("/api/memories/capture/", {"raw_content": oversized_content}, content_type="application/json", HTTP_AUTHORIZATION=f"Bearer {token}")
print("Oversized Capture Status:", resp2.status_code)
print("Response Error Payload:", resp2.json())

assert resp2.status_code == 400, "Backend MUST return 400 Bad Request for memories exceeding 5000 characters!"
err_msg = str(resp2.json())
assert "5000 characters" in err_msg, "Error payload must inform user of 5000 character limit!"

print("--- 5000 Character Capture Limit Verification Passed Successfully! ---")

import sys
import os

# Ensure the project root is in sys.path
sys.path.insert(0, r"c:\Users\DEll\Desktop\Startup\ME")

# Setup django settings module
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django
django.setup()

from django.contrib.auth import get_user_model
from apps.memories.models import Memory
from apps.memories.services import capture_memory

User = get_user_model()

# 1. Get or create a test user
user, created = User.objects.get_or_create(
    email="test_ai_user@example.com",
    defaults={
        "first_name": "AI Test",
        "last_name": "User",
        "is_active": True
    }
)
if created:
    user.set_password("test_pass_123")
    user.save()
    print("Created test user.")
else:
    print("Using existing test user.")

# 2. Test Happy Path
print("\n=== Testing Happy Path ===")
raw_content = "Brainstorming for ME app: We need to implement vector search in Milestone 5 using pgvector. PostgreSQL will store our memory vectors directly."
print(f"Capturing memory: {raw_content[:50]}...")
memory = capture_memory(user, raw_content)

print(f"Memory ID: {memory.pk}")
print(f"Raw Content: {memory.raw_content}")
print(f"AI Title: {memory.ai_title}")
print(f"AI Summary: {memory.ai_summary}")
print(f"Status: {memory.status}")
assert memory.status == Memory.Status.READY, "Expected status to be READY"
assert memory.ai_title != "", "Expected AI Title to be set"
assert memory.ai_summary != "", "Expected AI Summary to be set"
print("Happy Path verified successfully!")

# 3. Test Failure Path (invalid API key)
print("\n=== Testing Failure Path (Invalid API Key) ===")
# Set invalid key in os.environ which overrides decouple .env lookup
os.environ["AI_API"] = "invalid_key_garbage_123"

raw_content_fail = "This memory should still be saved even if the LLM client fails because of a bad API key."
print(f"Capturing memory with invalid key: {raw_content_fail[:50]}...")
failed_memory = capture_memory(user, raw_content_fail)

print(f"Memory ID: {failed_memory.pk}")
print(f"Raw Content: {failed_memory.raw_content}")
print(f"AI Title: {failed_memory.ai_title!r}")
print(f"AI Summary: {failed_memory.ai_summary!r}")
print(f"Status: {failed_memory.status}")
assert failed_memory.status == Memory.Status.FAILED, "Expected status to be FAILED"
assert failed_memory.ai_title == "", "Expected AI Title to be empty"
assert failed_memory.ai_summary == "", "Expected AI Summary to be empty"
print("Failure Path verified successfully! Raw memory is preserved.")

# Cleanup test records
print("\nCleaning up test data...")
memory.delete()
failed_memory.delete()
print("Cleanup complete.")

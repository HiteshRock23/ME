import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django
django.setup()

from django.conf import settings
if "testserver" not in settings.ALLOWED_HOSTS:
    settings.ALLOWED_HOSTS.append("testserver")

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.memories.models import Memory
from apps.memories.serializers import CaptureSerializer, MemoryReadSerializer
from apps.memories.services.capture_service import capture_memory

User = get_user_model()

def test_all_captures():
    user = User.objects.first()
    print(f"User: {user.pk} ({user.email})")

    tests = [
        ("Text note", {"raw_content": "Just a normal text note"}),
        ("Link without title", {"raw_content": "https://github.com/django/django"}),
        ("Link with title", {"raw_content": "https://python.org", "link_title": "Python Website"}),
        ("Pinned text note", {"raw_content": "Important pinned note", "is_pinned": True}),
    ]

    client = APIClient()
    client.force_authenticate(user=user)
    client.raise_request_exception = True

    for name, payload in tests:
        print(f"\n--- Testing: {name} ---")
        try:
            res = client.post("/api/memories/capture/", payload, format="json")
            print(f"Status: {res.status_code}")
            print(f"Result ID: {res.json()['id']}, type: {res.json()['memory_type']}, is_pinned: {res.json()['is_pinned']}")
        except Exception as e:
            import traceback
            print(f"FAILED on {name}:")
            traceback.print_exc()

if __name__ == "__main__":
    test_all_captures()

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django
django.setup()

from django.conf import settings
settings.ALLOWED_HOSTS.append("testserver")

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.memories.serializers import MemoryReadSerializer
from apps.memories.services.capture_service import capture_memory

User = get_user_model()

def test_capture():
    user, _ = User.objects.get_or_create(email="debug@example.com")

    print("\nTesting CaptureView via APIClient...")
    client = APIClient()
    client.force_authenticate(user=user)
    
    client.raise_request_exception = True
    try:
        res = client.post("/api/memories/capture/", {"raw_content": "API test note"}, format="json")
        print("Response status:", res.status_code)
        print("Response data:", res.json())
    except Exception as e:
        import traceback
        print("EXACT EXCEPTION IN CAPTURE:")
        traceback.print_exc()

if __name__ == "__main__":
    test_capture()

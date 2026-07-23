import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django
django.setup()

from django.test import Client
from django.conf import settings

print("--- Testing Google Auth Configuration Endpoint ---")
print("GOOGLE_CLIENT_ID from settings:", getattr(settings, "GOOGLE_CLIENT_ID", None))

client = Client(HTTP_HOST="localhost")
res = client.get("/api/auth/google/config/")
print("Config API Status Code:", res.status_code)
print("Config API Payload:", res.json())

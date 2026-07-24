import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django
django.setup()

from django.test import Client

client = Client(HTTP_HOST="localhost")
res = client.get("/")
print("Status:", res.status_code)
print("Headers:", dict(res.headers))
print("COOP Header:", res.headers.get("Cross-Origin-Opener-Policy"))

import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django
django.setup()

from django.test import Client
from apps.users.models import User
from unittest.mock import patch

print("--- Testing Google Authentication Backend View ---")

client = Client(HTTP_HOST="localhost")

# Mock Google token verification payload
mock_idinfo = {
    "sub": "1234567890_test_google_sub",
    "email": "testgoogleuser@example.com",
    "email_verified": True,
    "given_name": "Google",
    "family_name": "User",
    "picture": "https://lh3.googleusercontent.com/a/mock_pic"
}

with patch("apps.users.services.google_auth.id_token.verify_oauth2_token", return_value=mock_idinfo):
    resp = client.post(
        "/api/auth/google/",
        {"credential": "mock_google_id_token_xyz"},
        content_type="application/json"
    )
    print("Google Auth POST Status Code:", resp.status_code)
    assert resp.status_code == 200
    data = resp.json()
    print("Google Auth Access Token Generated:", bool(data.get("access")))
    print("Google Auth Refresh Token Generated:", bool(data.get("refresh")))
    print("User Email:", data.get("user", {}).get("email"))

    assert data.get("access") is not None
    assert data.get("user", {}).get("email") == "testgoogleuser@example.com"

print("--- Google Authentication Backend Verification Passed Successfully! ---")

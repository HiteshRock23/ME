from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from apps.memories.models import Memory

User = get_user_model()

class MemoryTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="test@example.com", password="testpass", first_name="Test", last_name="User")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_capture_text_memory(self):
        response = self.client.post("/api/memories/capture/", {
            "raw_content": "Just a normal text thought"
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["memory_type"], "text")
        self.assertIsNone(response.data.get("link_url"))
        self.assertEqual(response.data.get("link_title"), "")

    def test_capture_link_memory_no_custom_title(self):
        response = self.client.post("/api/memories/capture/", {
            "raw_content": "https://example.com"
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["memory_type"], "link")
        self.assertEqual(response.data["link_url"], "https://example.com")
        self.assertEqual(response.data.get("link_title"), "")

    def test_capture_link_memory_with_custom_title(self):
        response = self.client.post("/api/memories/capture/", {
            "raw_content": "https://github.com",
            "link_title": "My Github"
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["memory_type"], "link")
        self.assertEqual(response.data["link_url"], "https://github.com")
        self.assertEqual(response.data["link_title"], "My Github")

    def test_invalid_url_treated_as_text(self):
        response = self.client.post("/api/memories/capture/", {
            "raw_content": "this is not a valid url"
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["memory_type"], "text")

    def test_patch_link_title(self):
        memory = Memory.objects.create(
            user=self.user,
            raw_content="https://youtu.be/foo",
            url="https://youtu.be/foo",
            link_url="https://youtu.be/foo",
            memory_type="link",
            link_title="Old Title"
        )
        response = self.client.patch(f"/api/memories/{memory.id}/", {
            "link_title": "New Title"
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        memory.refresh_from_db()
        self.assertEqual(memory.link_title, "New Title")
        # Ensure other fields aren't overwritten
        self.assertEqual(memory.memory_type, "link")

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
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["memory_type"], "text")
        self.assertIsNone(response.data.get("link_url"))
        self.assertEqual(response.data.get("link_title"), "")

    def test_capture_link_memory_no_custom_title(self):
        response = self.client.post("/api/memories/capture/", {
            "raw_content": "https://example.com"
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["memory_type"], "link")
        self.assertEqual(response.data["link_url"], "https://example.com")
        self.assertEqual(response.data.get("link_title"), "")

    def test_capture_link_memory_with_custom_title(self):
        response = self.client.post("/api/memories/capture/", {
            "raw_content": "https://github.com",
            "link_title": "My Github"
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["memory_type"], "link")
        self.assertEqual(response.data["link_url"], "https://github.com")
        self.assertEqual(response.data["link_title"], "My Github")

    def test_invalid_url_treated_as_text(self):
        response = self.client.post("/api/memories/capture/", {
            "raw_content": "this is not a valid url"
        }, format="json")
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
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        memory.refresh_from_db()
        self.assertEqual(memory.link_title, "New Title")
        # Ensure other fields aren't overwritten
        self.assertEqual(memory.memory_type, "link")

    def test_pinned_and_recent_queryset_helpers(self):
        from django.utils import timezone
        import time

        now = timezone.now()
        mem1 = Memory.objects.create(user=self.user, raw_content="Unpinned 1")
        mem2 = Memory.objects.create(user=self.user, raw_content="Pinned 1", pinned_at=now)
        time.sleep(0.01)
        mem3 = Memory.objects.create(user=self.user, raw_content="Pinned 2", pinned_at=timezone.now())

        pinned_list = list(Memory.objects.pinned(self.user))
        recent_list = list(Memory.objects.recent(self.user))

        self.assertEqual(len(pinned_list), 2)
        self.assertEqual(pinned_list[0], mem3)  # Newest pin first
        self.assertEqual(pinned_list[1], mem2)
        self.assertTrue(mem2.is_pinned)
        self.assertTrue(mem3.is_pinned)

        self.assertEqual(len(recent_list), 1)
        self.assertEqual(recent_list[0], mem1)
        self.assertFalse(mem1.is_pinned)

    def test_capture_pinned_memory(self):
        response = self.client.post("/api/memories/capture/", {
            "raw_content": "Important pinned note",
            "is_pinned": True
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["is_pinned"])
        self.assertIsNotNone(response.data["pinned_at"])

    def test_pin_and_unpin_memory_api(self):
        memory = Memory.objects.create(user=self.user, raw_content="Normal note")
        self.assertFalse(memory.is_pinned)

        # Pin memory
        pin_resp = self.client.post(f"/api/memories/{memory.id}/pin/", format="json")
        self.assertEqual(pin_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(pin_resp.data["is_pinned"])

        # Unpin memory
        unpin_resp = self.client.post(f"/api/memories/{memory.id}/unpin/", format="json")
        self.assertEqual(unpin_resp.status_code, status.HTTP_200_OK)
        self.assertFalse(unpin_resp.data["is_pinned"])

    def test_five_pinned_memories_limit_api(self):
        from django.utils import timezone
        for i in range(5):
            Memory.objects.create(user=self.user, raw_content=f"Pinned {i}", pinned_at=timezone.now())

        # Attempt to pin a 6th memory via API
        sixth_mem = Memory.objects.create(user=self.user, raw_content="Sixth note")
        response = self.client.post(f"/api/memories/{sixth_mem.id}/pin/", format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("You can pin up to 5 memories. Unpin one to pin another.", response.data.get("error", ""))

        # Attempt to capture a 6th memory with is_pinned=True
        capture_resp = self.client.post("/api/memories/capture/", {
            "raw_content": "Sixth capture note",
            "is_pinned": True
        }, format="json")
        self.assertEqual(capture_resp.status_code, status.HTTP_400_BAD_REQUEST)


class MemorySharingTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="owner@example.com", password="password123")
        self.other_user = User.objects.create_user(email="other@example.com", password="password123")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.memory = Memory.objects.create(
            user=self.user,
            raw_content="Deep insight about system architecture and modular design.",
            ai_title="System Architecture Insights",
            ai_summary="Key observations on decoupling modules and maintainability.",
        )

    def test_share_memory_flow(self):
        # 1. Enable share
        res = self.client.post(f"/api/memories/{self.memory.id}/share/", format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data["shared"])
        token = res.data["token"]
        self.assertIsNotNone(token)
        self.assertIn(token, res.data["url"])

        # Repeated share returns same token
        res_repeat = self.client.post(f"/api/memories/{self.memory.id}/share/", format="json")
        self.assertEqual(res_repeat.data["token"], token)

        # 2. Access public link (unauthenticated)
        public_client = APIClient()
        pub_res = public_client.get(f"/api/shared/{token}/")
        self.assertEqual(pub_res.status_code, status.HTTP_200_OK)
        self.assertEqual(pub_res.data["title"], "System Architecture Insights")
        self.assertEqual(pub_res.data["summary"], "Key observations on decoupling modules and maintainability.")
        self.assertEqual(pub_res.data["content"], "Deep insight about system architecture and modular design.")

        # Privacy check: Ensure sensitive keys are absent
        forbidden_keys = {"id", "user", "email", "user_id", "sync_status", "ai_status", "embedding"}
        self.assertTrue(forbidden_keys.isdisjoint(set(pub_res.data.keys())))

        # 3. Regenerate share link
        regen_res = self.client.post(f"/api/memories/{self.memory.id}/share/regenerate/", format="json")
        self.assertEqual(regen_res.status_code, status.HTTP_200_OK)
        new_token = regen_res.data["token"]
        self.assertNotEqual(new_token, token)

        # Old token returns 404
        old_pub_res = public_client.get(f"/api/shared/{token}/")
        self.assertEqual(old_pub_res.status_code, status.HTTP_404_NOT_FOUND)

        # New token works
        new_pub_res = public_client.get(f"/api/shared/{new_token}/")
        self.assertEqual(new_pub_res.status_code, status.HTTP_200_OK)

        # 4. Revoke access
        revoke_res = self.client.delete(f"/api/memories/{self.memory.id}/share/", format="json")
        self.assertEqual(revoke_res.status_code, status.HTTP_200_OK)
        self.assertFalse(revoke_res.data["shared"])

        # Public access now 404
        revoked_pub_res = public_client.get(f"/api/shared/{new_token}/")
        self.assertEqual(revoked_pub_res.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_cannot_share_or_revoke_other_user_memory(self):
        other_client = APIClient()
        other_client.force_authenticate(user=self.other_user)

        res = other_client.post(f"/api/memories/{self.memory.id}/share/", format="json")
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

        revoke_res = other_client.delete(f"/api/memories/{self.memory.id}/share/", format="json")
        self.assertEqual(revoke_res.status_code, status.HTTP_404_NOT_FOUND)




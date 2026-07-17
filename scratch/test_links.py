import os
import django
import sys

# Setup Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model
from apps.memories.services.capture_service import capture_memory
from apps.memories.models import Memory

User = get_user_model()

def run_tests():
    print("Running manual tests...")
    
    # Setup test user
    user, created = User.objects.get_or_create(email="test_link_titles@example.com", defaults={
        "first_name": "Test",
        "last_name": "User"
    })
    
    try:
        # Test 1: Plain text
        mem1 = capture_memory(user, "Just a normal thought")
        assert mem1.memory_type == "text", "Expected text memory type"
        assert mem1.link_url is None, "Expected no link_url"
        assert mem1.link_title == "", "Expected empty link_title"
        print("✅ Text memory test passed.")
        
        # Test 2: URL without custom title
        mem2 = capture_memory(user, "https://example.com")
        assert mem2.memory_type == "link", "Expected link memory type"
        assert mem2.link_url == "https://example.com", "Expected link_url to match"
        assert mem2.link_title == "", "Expected empty link_title"
        print("✅ Link memory without custom title passed.")
        
        # Test 3: URL with custom title
        mem3 = capture_memory(user, "https://github.com", "My Github")
        assert mem3.memory_type == "link", "Expected link memory type"
        assert mem3.link_url == "https://github.com", "Expected link_url to match"
        assert mem3.link_title == "My Github", "Expected link_title to match"
        print("✅ Link memory with custom title passed.")
        
        # Test 4: Invalid URL
        mem4 = capture_memory(user, "this is not a valid url http://foo", "Should not be link title")
        assert mem4.memory_type == "text", "Expected text memory type"
        print("✅ Invalid URL treated as text passed.")
        
    finally:
        # Cleanup
        print("Cleaning up test data...")
        Memory.objects.filter(user=user).delete()
        user.delete()
        print("Cleanup done.")

if __name__ == "__main__":
    run_tests()

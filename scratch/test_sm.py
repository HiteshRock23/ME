import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.memories.services.supermemory_service import SupermemoryService

def test_sm():
    sm = SupermemoryService()
    try:
        print("Checking health...")
        res = sm.health_check()
        print("Health Check:", res)
    except Exception as e:
        print("Health Check Failed:", type(e), e)
        
    try:
        print("Checking search...")
        res = sm.search("test")
        print("Search:", res)
    except Exception as e:
        print("Search Failed:", type(e), e)

if __name__ == "__main__":
    test_sm()

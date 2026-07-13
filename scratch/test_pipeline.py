import sys
import os

# Ensure the project root is in sys.path
sys.path.insert(0, r"c:\Users\DEll\Desktop\Startup\ME")

# Setup django settings module
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django
django.setup()

from apps.memories.services.ai_service import generate_metadata

test_memories = [
    "I had a great meeting with Sarah today at 2 PM. We discussed the launch of our new product ME and decided to target mid-August for the beta release. She suggested we focus on the AI Understanding Engine first.",
    "Remember to buy almond milk, eggs, and bread from the grocery store on my way back from work tomorrow.",
    "Reflections on my walk in the park today: The weather was beautiful, around 22 degrees, with a gentle breeze. I realized that my best ideas come when I'm not staring at a screen."
]

for idx, content in enumerate(test_memories, 1):
    print(f"\n--- Test Memory {idx} ---")
    print(f"Input: {content}")
    try:
        metadata = generate_metadata(content)
        print(f"Status: SUCCESS")
        print(f"AI Title: {metadata.title}")
        print(f"AI Summary: {metadata.summary}")
    except Exception as e:
        print(f"Status: FAILED — {type(e).__name__}: {e}")

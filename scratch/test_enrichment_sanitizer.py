import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django
django.setup()

from apps.memories.services.memory_enrichment_service import sanitize_title

test_cases = [
    ('"Exercise Increases BDNF"', 'Exercise Increases BDNF'),
    ('   Startup Pricing Strategy.  ', 'Startup Pricing Strategy'),
    ('Untitled', ''),
    ('New Memory', ''),
    ('Summary:', ''),
    ('React Authentication Fix for ME System', 'React Authentication Fix for ME System'),
]

print("--- Testing Title Sanitizer ---")
all_passed = True
for raw, expected in test_cases:
    result = sanitize_title(raw)
    passed = (result == expected)
    if not passed:
        all_passed = False
    print(f"Input: '{raw}' => Output: '{result}' | Match: {passed}")

if all_passed:
    print("ALL SANITIZER TESTS PASSED!")
else:
    print("SOME SANITIZER TESTS FAILED!")

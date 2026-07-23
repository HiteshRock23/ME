import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django
django.setup()

from apps.memories.services.retrieval_pipeline import RetrievalPipeline, RetrievalConfig, ReferencedMemory
from apps.users.models import User
from apps.memories.models import Memory

print("--- Testing Retrieval Pipeline Architecture ---")

# 1. Test DTO & Serialization
dto = ReferencedMemory(
    id=101,
    memory_type="text",
    title="Exercise Increases BDNF",
    preview="Physical exercise stimulates BDNF production...",
    url=None,
    created_at="2026-07-22T20:00:00Z",
    score=0.92
)

data = dto.to_dict()
print("Serialized DTO keys:", list(data.keys()))
assert "score" not in data, "Internal score must NOT be exposed to public serialization!"
assert data["id"] == 101
assert data["title"] == "Exercise Increases BDNF"
print("DTO test passed cleanly.")

# 2. Test RetrievalConfig
config = RetrievalConfig.default()
print(f"Default RetrievalConfig: min_confidence={config.min_confidence_score}, max_results={config.max_results}")
assert config.min_confidence_score == 0.50
assert config.max_results == 5
print("RetrievalConfig test passed cleanly.")

print("--- Pipeline Unit Verification Completed Successfully ---")

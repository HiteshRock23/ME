"""
Production-Grade Knowledge Retrieval Pipeline for ME.

Pipeline Stages:
    1. Semantic Retrieval (Supermemory Service)
    2. Confidence Filtering
    3. Deduplication
    4. Database Hydration & Ownership Validation
    5. Ranking & Recency Weighting
    6. Limiting
    7. DTO Construction (ReferencedMemory)

Features:
    - RetrievalConfig: Encapsulates thresholds, limits, and options.
    - ReferencedMemory: Clean DTO shared across SearchService and AskService.
    - Structured Logging: Traces every stage of retrieval.
    - Backward Compatibility & Extensibility (Reranking, Metadata, Graph navigation).
"""

import logging
from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from django.conf import settings

from apps.memories.models import Memory
from apps.memories.services.supermemory_service import SupermemoryService

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RetrievalConfig:
    """
    Configuration parameters for the retrieval pipeline.
    """
    min_confidence_score: float = 0.50
    max_results: int = 5
    min_query_length: int = 2

    @classmethod
    def default(cls) -> "RetrievalConfig":
        min_score = getattr(settings, "RETRIEVAL_MIN_CONFIDENCE_SCORE", 0.50)
        max_res = getattr(settings, "RETRIEVAL_MAX_RESULTS", 5)
        return cls(min_confidence_score=min_score, max_results=max_res)


@dataclass
class ReferencedMemory:
    """
    Data Transfer Object (DTO) representing a retrieved memory.
    Internal score is preserved for backend logic, but omitted from public API serialization.
    """
    id: int
    memory_type: str
    title: str
    preview: str
    url: Optional[str]
    created_at: str
    score: float  # Kept internal to backend

    def to_dict(self) -> Dict[str, Any]:
        """
        Public JSON serialization for API responses.
        Intentionally excludes internal similarity score.
        """
        return {
            "id": self.id,
            "memory_type": self.memory_type,
            "title": self.title,
            "preview": self.preview,
            "url": self.url or "",
            "created_at": self.created_at,
        }


class RetrievalPipeline:
    """
    Modular, multi-stage retrieval pipeline.
    """

    @classmethod
    def execute(
        cls,
        user,
        query: str,
        config: Optional[RetrievalConfig] = None
    ) -> List[ReferencedMemory]:
        """
        Execute the retrieval pipeline for a given user and query.
        """
        if not config:
            config = RetrievalConfig.default()

        clean_query = query.strip() if query else ""
        if len(clean_query) < config.min_query_length:
            logger.info("Retrieval Pipeline: Query '%s' shorter than min_query_length %d", clean_query, config.min_query_length)
            return []

        logger.info(
            "Retrieval Pipeline Started: user=%s, query='%s', min_score=%.2f, max_results=%d",
            user.pk, clean_query, config.min_confidence_score, config.max_results
        )

        # Stage 1: Semantic Retrieval
        raw_results = cls._stage_semantic_retrieval(clean_query)
        logger.info("Stage 1 (Semantic Retrieval): Obtained %d raw results", len(raw_results))

        if not raw_results:
            return []

        # Stage 2: Confidence Filtering
        filtered_results = cls._stage_confidence_filtering(raw_results, config.min_confidence_score)
        logger.info("Stage 2 (Confidence Filtering): %d candidates passed threshold >= %.2f", len(filtered_results), config.min_confidence_score)

        if not filtered_results:
            return []

        # Stage 3: Deduplication
        deduped_map = cls._stage_deduplication(filtered_results)
        logger.info("Stage 3 (Deduplication): %d unique memory IDs", len(deduped_map))

        # Stage 4: Database Hydration & Ownership Validation
        hydrated_memories = cls._stage_hydration_and_ownership(user, list(deduped_map.keys()))
        logger.info("Stage 4 (Ownership & Hydration): %d verified user memories", len(hydrated_memories))

        if not hydrated_memories:
            return []

        # Stage 5: Ranking
        ranked_memories = cls._stage_ranking(hydrated_memories, deduped_map)

        # Stage 6: Limiting
        final_memories = ranked_memories[:config.max_results]
        logger.info("Stage 6 (Limiting): Returning %d memories (max %d)", len(final_memories), config.max_results)

        # Stage 7: DTO Serialization
        dtos = cls._stage_dto_construction(final_memories, deduped_map)
        return dtos

    # -------------------------------------------------------------------------
    # Pipeline Stage Implementations
    # -------------------------------------------------------------------------

    @staticmethod
    def _stage_semantic_retrieval(query: str) -> List[Dict[str, Any]]:
        sm_service = SupermemoryService()
        return sm_service.search(query)

    @staticmethod
    def _stage_confidence_filtering(raw_results: List[Dict[str, Any]], min_score: float) -> List[Dict[str, Any]]:
        filtered = []
        for item in raw_results:
            score = float(item.get("similarity", item.get("score", 0.0)))
            if score >= min_score:
                filtered.append(item)
        return filtered

    @staticmethod
    def _stage_deduplication(filtered_results: List[Dict[str, Any]]) -> Dict[int, float]:
        pk_to_score: Dict[int, float] = {}
        for item in filtered_results:
            score = float(item.get("similarity", item.get("score", 0.0)))
            metadata = item.get("metadata") or {}
            pk = metadata.get("memory_id")

            if pk is None:
                doc_id = item.get("id", item.get("documentId", ""))
                if isinstance(doc_id, str) and doc_id.startswith("me_memory_"):
                    try:
                        pk = int(doc_id.split("_")[-1])
                    except (ValueError, TypeError):
                        continue

            if pk is not None:
                try:
                    pk = int(pk)
                    # Keep highest score if duplicates exist
                    if pk not in pk_to_score or score > pk_to_score[pk]:
                        pk_to_score[pk] = score
                except (ValueError, TypeError):
                    continue

        return pk_to_score

    @staticmethod
    def _stage_hydration_and_ownership(user, pks: List[int]) -> List[Memory]:
        if not pks:
            return []
        # Strict user isolation
        queryset = Memory.objects.filter(pk__in=pks, user=user)
        return list(queryset)

    @staticmethod
    def _stage_ranking(memories: List[Memory], pk_to_score: Dict[int, float]) -> List[Memory]:
        # Sort by primary similarity score descending, secondary created_at descending
        return sorted(
            memories,
            key=lambda m: (pk_to_score.get(m.pk, 0.0), m.created_at.timestamp()),
            reverse=True
        )

    @staticmethod
    def _stage_dto_construction(memories: List[Memory], pk_to_score: Dict[int, float]) -> List[ReferencedMemory]:
        dtos = []
        for m in memories:
            # Canonical Title Priority: Custom Link Title -> AI Title -> Temporary Title
            if m.link_title:
                title = m.link_title
            elif m.ai_title and m.ai_title.strip():
                title = m.ai_title.strip()
            else:
                title = "Link Saved" if m.memory_type == Memory.MemoryType.LINK else "New Memory"

            # Preview Priority: Summary -> Trimmed Raw Content
            if m.ai_summary and m.ai_summary.strip():
                preview = m.ai_summary.strip()
            else:
                preview = m.raw_content[:150] + ("..." if len(m.raw_content) > 150 else "")

            dtos.append(
                ReferencedMemory(
                    id=m.id,
                    memory_type=m.memory_type,
                    title=title,
                    preview=preview,
                    url=m.url,
                    created_at=m.created_at.isoformat(),
                    score=pk_to_score.get(m.pk, 0.0)
                )
            )
        return dtos

import uuid
from django.conf import settings
from django.db import models
from django.core.validators import MaxLengthValidator


class MemoryQuerySet(models.QuerySet):
    def pinned(self, user):
        return self.filter(user=user, pinned_at__isnull=False).order_by("-pinned_at")

    def recent(self, user):
        return self.filter(user=user, pinned_at__isnull=True).order_by("-created_at")


class Memory(models.Model):
    """
    A single memory captured by a user.

    This is the core of the Capture → Understand → Retrieve pipeline.
    The raw_content is saved immediately and is the source of truth.
    AI-generated metadata (ai_title, ai_summary) is an enhancement
    that is populated asynchronously after capture.

    Supports multiple content types via memory_type. The architecture
    is open for extension: adding a new type requires only a new
    MemoryType choice and a corresponding metadata extractor.
    """

    objects = MemoryQuerySet.as_manager()

    class MemoryType(models.TextChoices):
        TEXT = "text", "Text"  # Plain text thought, note, or reflection
        LINK = "link", "Link"  # A URL to a webpage, article, or resource
        # Future types: IMAGE, PDF, VIDEO, AUDIO — add here, nothing else changes.

    class AIStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        PLATFORM_DETECTION = "platform_detection", "Platform Detection"
        METADATA_EXTRACTION = "metadata_extraction", "Metadata Extraction"
        AI_ENRICHMENT = "ai_enrichment", "AI Enrichment"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    class SyncStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        SYNCED = "synced", "Synced"
        FAILED = "failed", "Failed"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="memories",
    )

    # -------------------------------------------------------------------------
    # Content Classification Fields
    # -------------------------------------------------------------------------

    memory_type = models.CharField(
        max_length=10,
        choices=MemoryType.choices,
        default=MemoryType.TEXT,
        db_index=True,
        help_text="The classified content type of this memory.",
    )

    raw_content = models.TextField(
        validators=[MaxLengthValidator(5000)],
        help_text="The user's unprocessed input. Max 5000 characters.",
    )

    # Populated only for LINK memories.
    url = models.URLField(
        blank=True,
        null=True,
        help_text="The normalized URL for LINK memories.",
    )

    domain = models.CharField(
        max_length=255,
        blank=True,
        help_text="The extracted domain for LINK memories (e.g. github.com).",
    )

    link_url = models.URLField(
        blank=True,
        null=True,
        help_text="URL field for LINK memories (V2 requirement).",
    )

    link_title = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="User-provided custom title for LINK memories.",
    )

    ai_title = models.CharField(
        max_length=255,
        blank=True,
        help_text="AI-generated title. Empty until processing completes.",
    )

    ai_summary = models.TextField(
        blank=True,
        help_text="AI-generated summary. Empty until processing completes.",
    )

    # Embedding storage is handled externally by Supermemory (RAG + embeddings).
    # No embedding field on this model.

    ai_status = models.CharField(
        max_length=25,
        choices=AIStatus.choices,
        default=AIStatus.PENDING,
        db_index=True,
    )

    ai_processed_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text="When AI enrichment was completed.",
    )

    ai_last_error = models.TextField(
        blank=True,
        null=True,
        help_text="Error message from the last failed AI enrichment.",
    )

    # -------------------------------------------------------------------------
    # Link Intelligence Fields
    # -------------------------------------------------------------------------
    platform = models.CharField(max_length=255, blank=True)
    content_type = models.CharField(max_length=50, blank=True)
    source_url = models.URLField(max_length=2000, blank=True, null=True)
    canonical_url = models.URLField(max_length=2000, blank=True, null=True)
    page_title = models.CharField(max_length=500, blank=True)
    page_description = models.TextField(blank=True)
    favicon_url = models.URLField(max_length=2000, blank=True, null=True)
    thumbnail_url = models.URLField(max_length=2000, blank=True, null=True)
    site_name = models.CharField(max_length=255, blank=True)
    author = models.CharField(max_length=255, blank=True)
    reading_time = models.CharField(max_length=50, blank=True)
    metadata_json = models.JSONField(default=dict, blank=True)
    tags = models.JSONField(default=list, blank=True)

    # -------------------------------------------------------------------------
    # User Edit Protection & Intent
    # -------------------------------------------------------------------------
    title_user_modified = models.BooleanField(default=False)
    summary_user_modified = models.BooleanField(default=False)
    tags_user_modified = models.BooleanField(default=False)
    capture_intent = models.CharField(max_length=255, blank=True)

    # -------------------------------------------------------------------------
    # AI Confidence Scores
    # -------------------------------------------------------------------------
    title_confidence = models.FloatField(blank=True, null=True)
    summary_confidence = models.FloatField(blank=True, null=True)
    tags_confidence = models.FloatField(blank=True, null=True)

    # -------------------------------------------------------------------------
    # Synchronization Fields
    # -------------------------------------------------------------------------

    supermemory_document_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="The document ID returned by Supermemory Local.",
    )

    sync_status = models.CharField(
        max_length=20,
        choices=SyncStatus.choices,
        default=SyncStatus.PENDING,
        db_index=True,
        help_text="Status of synchronization with Supermemory.",
    )

    synced_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text="When this memory was successfully synchronized.",
    )

    last_sync_attempt = models.DateTimeField(
        blank=True,
        null=True,
        help_text="When synchronization was last attempted.",
    )

    last_sync_error = models.TextField(
        blank=True,
        null=True,
        help_text="Error message from the last failed synchronization.",
    )

    pinned_at = models.DateTimeField(
        blank=True,
        null=True,
        db_index=True,
        help_text="Timestamp when memory was pinned, or null if unpinned.",
    )

    # -------------------------------------------------------------------------
    # Knowledge Sharing Fields
    # -------------------------------------------------------------------------
    share_token = models.CharField(
        max_length=64,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        help_text="Cryptographically secure token for public knowledge sharing.",
    )

    shared_at = models.DateTimeField(
        blank=True,
        null=True,
        help_text="Timestamp when sharing was enabled or regenerated.",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_pinned(self) -> bool:
        return self.pinned_at is not None

    @property
    def is_shared(self) -> bool:
        return self.share_token is not None

    class Meta:
        verbose_name = "memory"
        verbose_name_plural = "memories"
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["user", "-created_at"],
                name="idx_memory_user_created",
            ),
            models.Index(
                fields=["user", "-pinned_at"],
                name="idx_memory_user_pinned",
            ),
            models.Index(
                fields=["user", "ai_status"],
                name="idx_memory_user_status",
            ),
            models.Index(
                fields=["user", "memory_type"],
                name="idx_memory_user_type",
            ),
        ]

    def __str__(self) -> str:
        if self.ai_title:
            return self.ai_title
        return f"{self.raw_content[:50]}..."


class LinkMetadataCache(models.Model):
    """
    Cache for fetched metadata to avoid repeating network requests and AI enrichment
    for the same URL within a 24-hour period.
    """
    url_hash = models.CharField(max_length=64, unique=True, db_index=True)
    normalized_url = models.URLField(max_length=2000)
    metadata_json = models.JSONField(default=dict)
    fetched_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        verbose_name = "link metadata cache"
        verbose_name_plural = "link metadata caches"

    def __str__(self):
        return f"Cache for {self.normalized_url[:50]}"


class PendingCapture(models.Model):
    """
    Temporary storage for an enriched capture (e.g. from Save Link) before the user logs in
    and saves it permanently. This is a generic structure supporting future free tools.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    capture_type = models.CharField(max_length=50, help_text="e.g. 'link', 'dump', 'code'")
    payload_json = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    version = models.IntegerField(default=1)

    class Meta:
        verbose_name = "pending capture"
        verbose_name_plural = "pending captures"

    def __str__(self):
        return f"PendingCapture {self.capture_type} ({self.id})"

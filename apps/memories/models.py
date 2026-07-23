from django.conf import settings
from django.db import models
from django.core.validators import MaxLengthValidator


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

    class MemoryType(models.TextChoices):
        TEXT = "text", "Text"  # Plain text thought, note, or reflection
        LINK = "link", "Link"  # A URL to a webpage, article, or resource
        # Future types: IMAGE, PDF, VIDEO, AUDIO — add here, nothing else changes.

    class AIStatus(models.TextChoices):
        PENDING = "pending", "Pending"      # Saved, waiting for AI processing
        PROCESSING = "processing", "Processing" # Currently being processed by worker
        READY = "ready", "Ready"            # AI processing complete
        FAILED = "failed", "Failed"         # AI failed, raw data preserved

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
        max_length=10,
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

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

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

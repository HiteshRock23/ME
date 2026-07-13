from django.contrib import admin

from apps.memories.models import Memory


@admin.register(Memory)
class MemoryAdmin(admin.ModelAdmin):
    list_display = ("short_content", "user", "ai_status", "created_at")
    list_filter = ("ai_status",)
    search_fields = ("raw_content", "ai_title", "ai_summary", "user__email")
    readonly_fields = ("ai_title", "ai_summary", "ai_status", "ai_processed_at", "ai_last_error", "created_at", "updated_at")

    @admin.display(description="Memory")
    def short_content(self, obj: Memory) -> str:
        if obj.ai_title:
            return obj.ai_title
        return f"{obj.raw_content[:50]}..."

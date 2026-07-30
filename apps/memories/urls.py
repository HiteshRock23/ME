from django.urls import path

from apps.memories.views import (
    CaptureView, MemoryDetailView, MemoryListView, SearchView, AskView,
    RelatedMemoriesView, AnalyzeLinkView, MemoryPinView, MemoryUnpinView
)

app_name = "memories"

urlpatterns = [
    path("capture/", CaptureView.as_view(), name="capture"),
    path("search/", SearchView.as_view(), name="search"),
    path("ask/", AskView.as_view(), name="ask"),
    path("analyze-link/", AnalyzeLinkView.as_view(), name="analyze-link"),
    path("", MemoryListView.as_view(), name="memory-list"),
    path("<int:pk>/", MemoryDetailView.as_view(), name="memory-detail"),
    path("<int:pk>/pin/", MemoryPinView.as_view(), name="memory-pin"),
    path("<int:pk>/unpin/", MemoryUnpinView.as_view(), name="memory-unpin"),
    path("<int:pk>/related/", RelatedMemoriesView.as_view(), name="memory-related"),
]

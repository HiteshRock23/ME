from django.urls import path

from apps.memories.views import CaptureView, MemoryDetailView, MemoryListView, SearchView, AskView, RelatedMemoriesView

app_name = "memories"

urlpatterns = [
    path("capture/", CaptureView.as_view(), name="capture"),
    path("search/", SearchView.as_view(), name="search"),
    path("ask/", AskView.as_view(), name="ask"),
    path("", MemoryListView.as_view(), name="memory-list"),
    path("<int:pk>/", MemoryDetailView.as_view(), name="memory-detail"),
    path("<int:pk>/related/", RelatedMemoriesView.as_view(), name="memory-related"),
]

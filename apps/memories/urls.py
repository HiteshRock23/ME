from django.urls import path

from apps.memories.views import CaptureView, MemoryDetailView, MemoryListView, SearchView, AskView

app_name = "memories"

urlpatterns = [
    path("capture/", CaptureView.as_view(), name="capture"),
    path("search/", SearchView.as_view(), name="search"),
    path("ask/", AskView.as_view(), name="ask"),
    path("", MemoryListView.as_view(), name="memory-list"),
    path("<int:pk>/", MemoryDetailView.as_view(), name="memory-detail"),
]

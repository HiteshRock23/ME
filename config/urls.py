"""
Root URL configuration for the ME project.

API endpoints live under /api/.
The frontend SPA is served from the root.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import FileResponse
from django.urls import include, path
from pathlib import Path


def spa_view(request):
    """Serve the SPA shell for any non-API route."""
    index = settings.BASE_DIR / "static" / "index.html"
    return FileResponse(open(index, "rb"), content_type="text/html")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.users.urls")),
    path("api/memories/", include("apps.memories.urls")),
    # SPA catch-all — must be last
    path("", spa_view, name="spa"),
]

# Serve static + media files during development only.
# In production, Nginx handles this.
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATICFILES_DIRS[0])
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)


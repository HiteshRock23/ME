"""
Root URL configuration for the ME project.

API endpoints live under /api/.
The frontend SPA is served from the root.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import FileResponse
from django.urls import include, path, re_path
from pathlib import Path


def spa_view(request):
    """Serve the SPA shell for any non-API route."""
    index = settings.BASE_DIR / "static" / "index.html"
    return FileResponse(open(index, "rb"), content_type="text/html")


def robots_view(request):
    file_path = settings.BASE_DIR / "static" / "robots.txt"
    return FileResponse(open(file_path, "rb"), content_type="text/plain")

def sitemap_view(request):
    file_path = settings.BASE_DIR / "static" / "sitemap.xml"
    return FileResponse(open(file_path, "rb"), content_type="application/xml")

urlpatterns = [
    path("robots.txt", robots_view),
    path("sitemap.xml", sitemap_view),
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.users.urls")),
    path("api/memories/", include("apps.memories.urls")),
    # SPA catch-all — must be last
    re_path(r"^(?!api/|admin/).*$", spa_view, name="spa"),
]

# Serve static + media files during development only.
# In production, Nginx handles this.
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATICFILES_DIRS[0])
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)



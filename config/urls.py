"""
Root URL configuration for the ME project.

API endpoints live under /api/.
The frontend SPA is served from the root.
Downloads (APK/AAB) are served from /downloads/ — handled by Nginx in production.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import FileResponse, Http404
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

def downloads_view(request, filename: str):
    """
    Serve release artifacts (APK/AAB/JSON/TXT) from the downloads/ directory.

    In production, Nginx serves /downloads/ directly for performance.
    This view is the development fallback and safety net.
    """
    # Whitelist safe extensions only — no directory traversal possible.
    allowed_extensions = (".apk", ".aab", ".json", ".txt")
    if not any(filename.endswith(ext) for ext in allowed_extensions):
        raise Http404

    file_path = settings.BASE_DIR / "downloads" / filename

    if not file_path.exists() or not file_path.is_file():
        raise Http404

    if filename.endswith(".apk"):
        content_type = "application/vnd.android.package-archive"
        as_attachment = True
    elif filename.endswith(".json"):
        content_type = "application/json"
        as_attachment = False
    elif filename.endswith(".txt"):
        content_type = "text/plain"
        as_attachment = False
    else:
        content_type = "application/octet-stream"
        as_attachment = True

    response = FileResponse(
        open(file_path, "rb"),
        content_type=content_type,
        as_attachment=as_attachment,
        filename=filename,
    )
    response["Cache-Control"] = "public, max-age=3600"
    return response


from apps.memories.views import PublicSharedMemoryView

urlpatterns = [
    path("robots.txt", robots_view),
    path("sitemap.xml", sitemap_view),
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.users.urls")),
    path("api/memories/", include("apps.memories.urls")),
    path("api/shared/<str:token>/", PublicSharedMemoryView.as_view(), name="public-shared-memory"),
    # Release artifact downloads (/downloads/<filename>.apk or .aab)
    # NOTE: In production, Nginx serves this location directly.
    #       This handler is the dev + fallback path only.
    path("downloads/<str:filename>", downloads_view, name="downloads"),
    # SPA catch-all — must be last
    re_path(r"^(?!api/|admin/).*$", spa_view, name="spa"),
]

# Serve static + media files during development only.
# In production, Nginx handles this.
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATICFILES_DIRS[0])
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)


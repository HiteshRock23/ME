import secrets
from typing import Optional, Dict, Any
from django.utils import timezone
from django.core.exceptions import ObjectDoesNotExist

from apps.memories.models import Memory


class SharedMemoryNotFoundError(ObjectDoesNotExist):
    """Raised when a shared memory token is invalid or has been revoked."""
    pass


def _build_share_url(token: str, request=None) -> str:
    """Build the public sharing URL for a given token."""
    path = f"/s/{token}"
    if request is not None:
        return request.build_absolute_uri(path)
    return path


def share_memory(memory: Memory, request=None) -> Dict[str, Any]:
    """
    Enable knowledge sharing for a memory or return existing share info.

    If memory is already shared, returns existing token and URL.
    Otherwise, generates a cryptographically secure URL-safe token.
    """
    if not memory.share_token:
        memory.share_token = secrets.token_urlsafe(12)
        memory.shared_at = timezone.now()
        memory.save(update_fields=["share_token", "shared_at", "updated_at"])

    url = _build_share_url(memory.share_token, request)
    return {
        "url": url,
        "token": memory.share_token,
        "shared": True,
    }


def regenerate_share_link(memory: Memory, request=None) -> Dict[str, Any]:
    """
    Regenerate a share token for a memory.

    Invalidates any previously generated share URL immediately and creates a new one.
    """
    memory.share_token = secrets.token_urlsafe(12)
    memory.shared_at = timezone.now()
    memory.save(update_fields=["share_token", "shared_at", "updated_at"])

    url = _build_share_url(memory.share_token, request)
    return {
        "url": url,
        "token": memory.share_token,
        "shared": True,
    }


def revoke_memory_share(memory: Memory) -> Dict[str, Any]:
    """
    Revoke public sharing for a memory.

    Removes the share token, causing any future access to the public URL to return 404.
    """
    if memory.share_token:
        memory.share_token = None
        memory.shared_at = None
        memory.save(update_fields=["share_token", "shared_at", "updated_at"])

    return {
        "shared": False,
    }


def get_shared_memory(share_token: str) -> Memory:
    """
    Retrieve a memory by its public share token.

    Raises SharedMemoryNotFoundError if the token is invalid, empty, or revoked.
    """
    if not share_token:
        raise SharedMemoryNotFoundError("Share token is required.")

    try:
        return Memory.objects.get(share_token=share_token)
    except Memory.DoesNotExist:
        raise SharedMemoryNotFoundError("Shared memory not found or link has been revoked.")

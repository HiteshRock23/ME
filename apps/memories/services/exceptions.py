"""
Typed exceptions for the integrations pipeline.
"""

# -----------------------------------------------------------------------------
# Supermemory Exceptions
# -----------------------------------------------------------------------------

class SupermemoryError(Exception):
    """Base exception for all Supermemory integration failures."""
    pass


class SupermemoryConnectionError(SupermemoryError):
    """Raised when Supermemory Local is unreachable or times out."""
    pass


class SupermemoryAPIError(SupermemoryError):
    """Raised when Supermemory Local returns an HTTP error code (non-2xx)."""
    pass

class DuplicateMemoryError(Exception):
    """Raised when a duplicate URL is detected during capture."""
    def __init__(self, memory):
        self.memory = memory
        super().__init__("Memory already exists for this URL.")

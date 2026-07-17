"""
Supermemory Service — Connection and abstraction layer for Supermemory Local.

This service manages the HTTP bridge between Django and the running local
Supermemory server instance. It uses Python's built-in `urllib` to keep the
project lightweight and dependency-free.
"""

import json
import logging
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional

from django.conf import settings
from apps.memories.services.exceptions import (
    SupermemoryAPIError,
    SupermemoryConnectionError,
    SupermemoryError,
)

logger = logging.getLogger(__name__)


class SupermemoryService:
    """
    Abstractions for calling the Supermemory Local instance.
    Handles connection lifecycle, health check pings, and API communication.
    """

    def __init__(self) -> None:
        """Initialize configuration from Django settings (populated from .env via python-decouple)."""
        self.base_url: str = getattr(settings, "SUPERMEMORY_URL", "http://195.35.6.26:6767").rstrip("/")
        self.api_key: str = getattr(settings, "SUPERMEMORY_API_KEY", "")
        self.timeout: int = getattr(settings, "SUPERMEMORY_TIMEOUT", 10)
        self.headers: Dict[str, str] = {}

    def connect(self) -> None:
        """
        Establish connection configuration.
        Prepares default authorization and content-type headers.
        """
        self.headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if self.api_key:
            self.headers["Authorization"] = f"Bearer {self.api_key}"
        logger.debug("SupermemoryService connection configured for URL: %s", self.base_url)

    def disconnect(self) -> None:
        """
        Placeholder cleanup method.
        Resets configured headers.
        """
        self.headers = {}
        logger.debug("SupermemoryService disconnected")

    # ------------------------------------------------------------------
    # Private logging helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _log_request(method: str, url: str, body: Optional[bytes], timeout: int) -> None:
        """
        Emit a formatted HTTP request log — only in DEBUG mode.
        Never logs headers, API keys, or any authentication material.
        """
        from django.conf import settings as _settings
        if not _settings.DEBUG:
            return
        body_str = body.decode("utf-8") if body else "(empty)"
        logger.debug(
            "\n%s\nHTTP REQUEST\n"
            "METHOD      : %s\n"
            "URL         : %s\n"
            "BODY        : %s\n"
            "TIMEOUT     : %ss\n%s",
            "-" * 60, method, url, body_str, timeout, "-" * 60,
        )

    @staticmethod
    def _log_response(status: int, reason: str, duration_ms: int) -> None:
        """
        Emit a formatted HTTP response log — only in DEBUG mode.
        """
        from django.conf import settings as _settings
        if not _settings.DEBUG:
            return
        logger.debug(
            "\nHTTP RESPONSE\n"
            "STATUS      : %s %s\n"
            "DURATION    : %sms\n%s",
            status, reason, duration_ms, "-" * 60,
        )

    # ------------------------------------------------------------------

    def _make_request(
        self,
        path: str,
        method: str = "GET",
        data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Send a REST API request to the Supermemory Local instance.

        Args:
            path: Relative API path (e.g. '/v3/settings').
            method: HTTP method string (GET, POST, PATCH, DELETE).
            data: Optional dictionary containing JSON request body payload.

        Returns:
            The parsed JSON response dictionary.

        Raises:
            SupermemoryConnectionError: If the server is offline or times out.
            SupermemoryAPIError: If the server returns a non-2xx status code.
            SupermemoryError: For other unexpected integration failures.
        """
        # Build absolute URL
        url = f"{self.base_url}{path}"

        # Ensure headers are initialized (implicitly call connect if not done)
        if not self.headers:
            self.connect()

        # Encode JSON data payload if provided
        req_body: Optional[bytes] = None
        if data is not None:
            try:
                req_body = json.dumps(data).encode("utf-8")
            except Exception as exc:
                logger.error("Failed to serialize request body: %s", exc)
                raise SupermemoryError(f"Request serialization failed: {exc}") from exc

        # Build urllib Request object
        request = urllib.request.Request(
            url=url,
            data=req_body,
            headers=self.headers,
            method=method,
        )

        # Log the outgoing request (DEBUG only — no headers/credentials logged)
        self._log_request(method, url, req_body, self.timeout)

        try:
            start_time = time.monotonic()
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                resp_data = response.read().decode("utf-8")
                duration_ms = int((time.monotonic() - start_time) * 1000)
                self._log_response(response.status, response.reason or "OK", duration_ms)
                if not resp_data:
                    return {}
                return json.loads(resp_data)

        except urllib.error.HTTPError as exc:
            # Server responded with an error code (4xx or 5xx)
            err_content = exc.read().decode("utf-8")
            details = err_content
            try:
                parsed_err = json.loads(err_content)
                details = parsed_err.get("error", err_content)
            except json.JSONDecodeError:
                pass
            logger.error(
                "SupermemoryAPIError: %s %s → HTTP %d %s | %s",
                method, url, exc.code, exc.reason, details,
            )
            raise SupermemoryAPIError(
                f"Supermemory server returned HTTP {exc.code}: {details}"
            ) from exc

        except urllib.error.URLError as exc:
            logger.error(
                "SupermemoryConnectionError: %s %s → %s",
                method, url, exc.reason,
            )
            raise SupermemoryConnectionError(
                f"Failed to connect to Supermemory Local at {self.base_url}: {exc.reason}"
            ) from exc

        except TimeoutError as exc:
            logger.error(
                "SupermemoryConnectionError: %s %s → timed out after %ss",
                method, url, self.timeout,
            )
            raise SupermemoryConnectionError(
                f"Request to Supermemory Local timed out after {self.timeout} seconds."
            ) from exc

        except Exception as exc:
            logger.error(
                "SupermemoryError: %s %s → %s: %s\n%s",
                method, url, type(exc).__name__, exc, traceback.format_exc(),
            )
            raise SupermemoryError(f"Unexpected Supermemory integration failure: {exc}") from exc

    def health_check(self) -> bool:
        """
        Check if the Supermemory Local instance is running and reachable.

        Queries the '/v4/profile' endpoint. If it responds with HTTP 200,
        the service is considered healthy.

        Returns:
            True if healthy and reachable, False otherwise.
        """
        try:
            self._make_request("/v4/profile", method="POST", data={"containerTag": "me_app", "include": []})
            return True
        except (SupermemoryConnectionError, SupermemoryAPIError) as exc:
            logger.warning("Supermemory health check failed: %s", exc)
            return False
        except Exception as exc:
            logger.error("Unexpected health check error: %s", exc)
            return False

    def is_available(self) -> bool:
        """Alias for health_check()."""
        return self.health_check()

    def get_server_info(self) -> Dict[str, Any]:
        """
        Fetch setting and configuration information from the Supermemory Local instance.

        Queries the '/v4/profile' endpoint.

        Returns:
            A dictionary containing server settings.

        Raises:
            SupermemoryConnectionError: If the server is offline or times out.
            SupermemoryAPIError: If the server returns a non-2xx status code.
        """
        return self._make_request("/v4/profile", method="POST", data={"containerTag": "me_app"})

    def store_memory(self, content: str, memory_id: int, user_id: int = None, link_title: str = "") -> str:
        """
        Store a raw memory in Supermemory Local v4.

        Args:
            content: The raw text content of the memory.
            memory_id: The local PostgreSQL Memory ID (used for idempotency).
            user_id: The local PostgreSQL User ID (optional, for metadata filtering).

        Returns:
            The Supermemory document/memory ID as a string.

        Raises:
            SupermemoryConnectionError: If the server is offline.
            SupermemoryAPIError: If the API rejects the request.
        """
        payload_content = f"{link_title}\n{content}" if link_title else content
        
        metadata = {"memory_id": memory_id}
        if user_id is not None:
            metadata["user_id"] = user_id

        payload = {
            "containerTag": "me_app",
            "memories": [
                {
                    "content": payload_content,
                    "metadata": metadata
                }
            ]
        }
        
        response = self._make_request("/v4/memories", method="POST", data=payload)
        
        # Supermemory v4 returns `{"memories": [{"id": "..."}]}`
        try:
            return str(response["memories"][0]["id"])
        except (KeyError, IndexError):
            # Fallback if the response schema is slightly different
            if "documentId" in response and response["documentId"]:
                return str(response["documentId"])
            raise SupermemoryAPIError(f"Unexpected response format from Supermemory v4: {response}")

    def delete_memory(self, document_id: str) -> None:
        """
        Delete a memory from Supermemory Local v4.

        Args:
            document_id: The Supermemory document ID.

        Raises:
            SupermemoryConnectionError: If the server is offline.
            SupermemoryAPIError: If the API rejects the request.
        """
        if not document_id:
            return
            
        payload = {
            "containerTag": "me_app",
            "id": document_id
        }
        
        self._make_request("/v4/memories", method="DELETE", data=payload)

    def search(self, query: str) -> list[dict]:
        """
        Search Supermemory Local using natural language.

        Args:
            query: The user's natural language search query.

        Returns:
            A list of dictionaries representing the search results,
            ordered by semantic relevance (score).

        Raises:
            SupermemoryConnectionError: If the server is offline.
            SupermemoryAPIError: If the API rejects the request.
        """
        payload = {
            "containerTag": "me_app",
            "q": query
        }
        response = self._make_request("/v4/search", method="POST", data=payload)
        
        return response.get("results", [])

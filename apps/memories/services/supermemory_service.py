"""
Supermemory Service — Connection and abstraction layer for Supermemory Local.

This service manages the HTTP bridge between Django and the running local
Supermemory server instance. It uses Python's built-in `urllib` to keep the
project lightweight and dependency-free.
"""

import json
import logging
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
        """Initialize configuration from Django settings."""
        self.base_url: str = getattr(settings, "SUPERMEMORY_URL", "http://localhost:6767").rstrip("/")
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

        try:
            logger.debug("Sending %s request to %s", method, url)
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                resp_data = response.read().decode("utf-8")
                if not resp_data:
                    return {}
                return json.loads(resp_data)

        except urllib.error.HTTPError as exc:
            # Server responded with an error code (4xx or 5xx)
            err_content = exc.read().decode("utf-8")
            logger.error(
                "Supermemory API error: %d %s - Content: %s",
                exc.code,
                exc.reason,
                err_content,
            )
            # Try parsing JSON error details if possible
            details = err_content
            try:
                parsed_err = json.loads(err_content)
                details = parsed_err.get("error", err_content)
            except json.JSONDecodeError:
                pass

            raise SupermemoryAPIError(
                f"Supermemory server returned HTTP {exc.code}: {details}"
            ) from exc

        except urllib.error.URLError as exc:
            # Network layer issue, name resolution, or server offline
            logger.error("Supermemory connection failed: %s", exc.reason)
            raise SupermemoryConnectionError(
                f"Failed to connect to Supermemory Local at {self.base_url}: {exc.reason}"
            ) from exc

        except TimeoutError as exc:
            # Timed out during connection/read
            logger.error("Supermemory request timed out (limit=%d seconds)", self.timeout)
            raise SupermemoryConnectionError(
                f"Request to Supermemory Local timed out after {self.timeout} seconds."
            ) from exc

        except Exception as exc:
            # Generic catch-all for parsing or execution anomalies
            logger.error("Unexpected error in Supermemory integration: %s", exc)
            raise SupermemoryError(f"Unexpected Supermemory integration failure: {exc}") from exc

    def health_check(self) -> bool:
        """
        Check if the Supermemory Local instance is running and reachable.

        Queries the '/v3/settings' endpoint. If it responds with HTTP 200,
        the service is considered healthy.

        Returns:
            True if healthy and reachable, False otherwise.
        """
        try:
            self._make_request("/v3/settings", method="GET")
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

        Queries the '/v3/settings' endpoint.

        Returns:
            A dictionary containing server settings.

        Raises:
            SupermemoryConnectionError: If the server is offline or times out.
            SupermemoryAPIError: If the server returns a non-2xx status code.
        """
        return self._make_request("/v3/settings", method="GET")

    def store_memory(self, content: str, memory_id: int, user_id: int = None) -> str:
        """
        Store a raw memory in Supermemory Local.

        Args:
            content: The raw text content of the memory.
            memory_id: The local PostgreSQL Memory ID (used for idempotency).
            user_id: The local PostgreSQL User ID (optional, for metadata filtering).

        Returns:
            The Supermemory document ID as a string.

        Raises:
            SupermemoryConnectionError: If the server is offline.
            SupermemoryAPIError: If the API rejects the request.
        """
        payload = {
            "content": content,
            "customId": f"me_memory_{memory_id}"
        }
        
        if user_id is not None:
            payload["metadata"] = {"user_id": user_id}
        
        response = self._make_request("/v3/documents", method="POST", data=payload)
        
        if "id" not in response:
            raise SupermemoryAPIError(f"Unexpected response format from Supermemory: {response}")
            
        return str(response["id"])

    def delete_memory(self, document_id: str) -> None:
        """
        Delete a memory from Supermemory Local.

        Args:
            document_id: The Supermemory document ID.

        Raises:
            SupermemoryConnectionError: If the server is offline.
            SupermemoryAPIError: If the API rejects the request.
        """
        if not document_id:
            return
            
        # DELETE endpoints usually return 204 No Content, our _make_request parses empty bodies as {}
        self._make_request(f"/v3/documents/{urllib.parse.quote(document_id)}", method="DELETE")

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
        payload = {"q": query}
        response = self._make_request("/v3/search", method="POST", data=payload)
        
        return response.get("results", [])

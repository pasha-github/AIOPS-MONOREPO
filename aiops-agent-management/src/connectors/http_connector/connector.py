"""
HTTP Connector v1.0.0
---------------------
Generic connector for making HTTP requests to a configured base URL.
"""

from typing import Any

from base_connector import BaseConnector, connector_tool
from google.adk.tools.tool_context import ToolContext


class HttpConnector(BaseConnector):
    """Generic HTTP connector using a single universal request tool."""

    def __init__(self, BASE_URL: str, prefix: str = ""):
        super().__init__(prefix=prefix)
        self.base_url = BASE_URL.rstrip("/")

    @connector_tool
    def http_request(
        self,
        method: str,
        path: str,
        query: dict[str, str] | None = None,
        body: dict[str, str] | None = None,
        headers: dict[str, str] | None = None,
        tool_context: ToolContext | None = None,
    ) -> dict[str, Any]:
        """Makes an HTTP request with method GET, POST, PUT, PATCH, or DELETE to a relative path under BASE_URL."""
        method_upper = method.upper()
        allowed_methods = {"GET", "POST", "PUT", "PATCH", "DELETE"}

        if method_upper not in allowed_methods:
            return {
                "status": "error",
                "code": 400,
                "message": "Invalid method. Allowed methods: GET, POST, PUT, PATCH, DELETE.",
            }

        if path.startswith("http://") or path.startswith("https://"):
            return {
                "status": "error",
                "code": 400,
                "message": "Path must be relative, not an absolute URL.",
            }

        normalized_path = path if path.startswith("/") else f"/{path}"
        url = f"{self.base_url}{normalized_path}"

        response = self.call_api(
            url=url,
            method=method_upper,
            headers=headers,
            params=query,
            json=body,
        )

        if response.status_code >= 400:
            return {
                "status": "error",
                "code": response.status_code,
                "message": response.text,
            }

        try:
            payload = response.json()
        except ValueError:
            payload = response.text

        return {
            "status": "success",
            "code": response.status_code,
            "data": payload,
        }

"""
Confluence Connector v1.0.0
Read pages and spaces from Confluence Cloud via Atlassian REST API v2.
"""

from __future__ import annotations

import base64
from typing import Any

try:
    from base_connector import BaseConnector, connector_tool
except ModuleNotFoundError:
    from src.connectors.base_connector import BaseConnector, connector_tool


class ConfluenceConnector(BaseConnector):
    """Confluence Cloud connector — list pages and read content via Atlassian API."""

    def __init__(
        self,
        CF_DOMAIN: str,
        CF_EMAIL: str,
        CF_API_TOKEN: str,
        CF_SPACE_KEY: str = "",
        prefix: str = "",
    ):
        super().__init__(prefix=prefix)
        self.domain = CF_DOMAIN.strip().rstrip("/")
        self.email = CF_EMAIL.strip()
        self.api_token = CF_API_TOKEN.strip()
        self.space_key = CF_SPACE_KEY.strip()
        self.base_url = f"https://{self.domain}/wiki/api/v2"

    # ── Config & Auth ──────────────────────────────────────────────────────────

    def _validate_config(self) -> str | None:
        if not self.domain:
            return "CF_DOMAIN is required."
        if not self.email:
            return "CF_EMAIL is required."
        if not self.api_token:
            return "CF_API_TOKEN is required."
        if not self.space_key:
            return "CF_SPACE_KEY is required."
        return None

    def _auth_headers(self) -> dict[str, str]:
        credentials = base64.b64encode(
            f"{self.email}:{self.api_token}".encode()
        ).decode()
        return {
            "Authorization": f"Basic {credentials}",
            "Accept": "application/json",
        }

    def _api_request(
        self,
        endpoint: str,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        error = self._validate_config()
        if error:
            return {"status": "error", "message": error}

        url = f"{self.base_url}{endpoint}"
        response = self.call_api(
            url=url,
            method="GET",
            headers=self._auth_headers(),
            params=params,
        )

        if response.status_code == 401:
            return {
                "status": "error",
                "code": 401,
                "message": "Authentication failed. Check CF_EMAIL and CF_API_TOKEN.",
            }
        if response.status_code == 403:
            return {
                "status": "error",
                "code": 403,
                "message": "Forbidden. You may not have access to this resource.",
            }
        if response.status_code == 404:
            return {
                "status": "error",
                "code": 404,
                "message": "Resource not found. Check CF_DOMAIN and the page/space details.",
            }
        if response.status_code >= 400:
            return {
                "status": "error",
                "code": response.status_code,
                "message": "Confluence API request failed.",
                "details": response.text,
            }

        try:
            return {"status": "success", "data": response.json()}
        except Exception:
            return {
                "status": "error",
                "message": "Confluence API returned a non-JSON response.",
            }

    # ── Tools ──────────────────────────────────────────────────────────────────

    def _resolve_space_id(self, space_key: str) -> dict[str, Any]:
        """Resolve a space key to its numeric space ID using the v2 API."""
        result = self._api_request("/spaces", params={"limit": 250})
        if result["status"] != "success":
            return result
        results = result["data"].get("results", [])
        for space in results:
            if space.get("key", "").upper() == space_key.upper():
                return {"status": "success", "space_id": space["id"]}
        return {
            "status": "error",
            "message": f"Space with key '{space_key}' not found or not accessible.",
        }

    @connector_tool
    def list_pages(self, space_key: str = "") -> dict[str, Any]:
        """
        List pages in Confluence.

        If space_key is provided, lists pages in that space.
        If not provided, falls back to CF_SPACE_KEY config.
        If neither is set, lists all available spaces.

        Args:
            space_key: The Confluence space key (e.g. "TS", "NOC"). Optional.

        Returns:
            dict: List of pages (id, title, url) or spaces (id, key, name).
        """
        active_key = space_key.strip() or self.space_key
        if active_key:
            # Resolve space key → space ID first (v2 API requires ID not key)
            space_result = self._resolve_space_id(active_key)
            if space_result["status"] != "success":
                return space_result

            space_id = space_result["space_id"]
            result = self._api_request(
                "/pages",
                params={"space-id": space_id, "limit": 50, "status": "current"},
            )
            if result["status"] != "success":
                return result

            pages = result["data"].get("results", [])
            if not pages:
                return {
                    "status": "success",
                    "space_key": active_key,
                    "count": 0,
                    "pages": [],
                    "message": f"No pages found in space '{active_key}'.",
                }

            return {
                "status": "success",
                "space_key": active_key,
                "count": len(pages),
                "pages": [
                    {
                        "id": p["id"],
                        "title": p["title"],
                        "status": p.get("status", ""),
                        "url": f"https://{self.domain}/wiki{p.get('_links', {}).get('webui', '')}",
                    }
                    for p in pages
                ],
            }

        # No space key — list spaces instead
        result = self._api_request(
            "/spaces", params={"limit": 250, "status": "current"}
        )
        if result["status"] != "success":
            return result

        spaces = result["data"].get("results", [])
        return {
            "status": "success",
            "count": len(spaces),
            "message": "No CF_SPACE_KEY configured. Listing available spaces.",
            "spaces": [
                {
                    "id": s["id"],
                    "key": s["key"],
                    "name": s["name"],
                    "type": s.get("type", ""),
                    "url": f"https://{self.domain}/wiki{s.get('_links', {}).get('webui', '')}",
                }
                for s in spaces
            ],
        }

    @connector_tool
    def get_page_content(self, page_id: str) -> dict[str, Any]:
        """
        Get the plain text content of a Confluence page by its ID.

        Use list_pages first to find the page ID.

        Args:
            page_id: The numeric Confluence page ID (e.g. "123456789").

        Returns:
            dict: Page title, space, and plain text content.
        """
        if not page_id or not page_id.strip():
            return {"status": "error", "message": "page_id is required."}

        result = self._api_request(
            f"/pages/{page_id.strip()}",
            params={"body-format": "atlas_doc_format"},
        )
        if result["status"] != "success":
            return result

        page = result["data"]
        title = page.get("title", "")
        space_id = page.get("spaceId", "")
        web_url = f"https://{self.domain}/wiki{page.get('_links', {}).get('webui', '')}"

        # Extract plain text from body
        body = page.get("body", {})
        content = self._extract_text(body)

        return {
            "status": "success",
            "id": page_id,
            "title": title,
            "space_id": space_id,
            "url": web_url,
            "content": content,
        }

    # ── Helpers ────────────────────────────────────────────────────────────────

    def _extract_text(self, body: dict[str, Any]) -> str:
        """Recursively extract plain text from Confluence ADF body."""
        if not body:
            return ""

        # atlas_doc_format wraps content in a 'value' key as ADF JSON string
        value = body.get("atlas_doc_format", {}).get("value", "")
        if not value:
            # fallback: try storage/view format
            storage = body.get("storage", {}).get("value", "")
            if storage:
                return self._strip_html(storage)
            return ""

        try:
            import json

            doc = json.loads(value)
            return self._extract_adf_text(doc)
        except Exception:
            return value

    def _extract_adf_text(self, node: Any, depth: int = 0) -> str:
        """Walk ADF node tree and collect text."""
        if not isinstance(node, dict):
            return ""

        node_type = node.get("type", "")
        text = node.get("text", "")

        parts: list[str] = []

        if text:
            parts.append(text)

        for child in node.get("content", []):
            parts.append(self._extract_adf_text(child, depth + 1))

        result = "".join(parts)

        # Add newlines after block-level nodes
        if node_type in (
            "paragraph",
            "heading",
            "bulletList",
            "orderedList",
            "listItem",
            "codeBlock",
            "blockquote",
            "rule",
        ):
            result = result + "\n"

        return result

    def _strip_html(self, html: str) -> str:
        """Very simple HTML tag stripper for storage format fallback."""
        import re

        text = re.sub(r"<[^>]+>", " ", html)
        text = re.sub(r"\s+", " ", text)
        return text.strip()

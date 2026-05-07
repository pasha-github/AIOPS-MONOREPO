"""
SharePoint Connector v0.0.1
Graph-only connector for listing documents, reading document content, and updating markdown files.
"""

from __future__ import annotations

import base64
import posixpath
import time
from typing import Any, cast
from urllib.parse import quote, urlparse

try:
    from base_connector import BaseConnector, connector_tool
except ModuleNotFoundError:
    from src.connectors.base_connector import BaseConnector, connector_tool


class SharePointConnector(BaseConnector):
    """Connector for SharePoint document operations through Microsoft Graph."""

    def __init__(
        self,
        SHP_ID_APP: str,
        SHP_ID_APP_SECRET: str,
        SHP_TENANT_ID: str,
        SHP_SITE_URL: str,
        SHP_DOC_LIBRARY: str,
        prefix: str = "",
    ):
        super().__init__(prefix=prefix)
        self.client_id = SHP_ID_APP.strip()
        self.client_secret = SHP_ID_APP_SECRET.strip()
        self.tenant_id = SHP_TENANT_ID.strip()
        self.site_url = SHP_SITE_URL.strip().rstrip("/")
        self.doc_library = SHP_DOC_LIBRARY.strip().strip("/")
        self.graph_base_url = "https://graph.microsoft.com/v1.0"
        self.token_url = (
            f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
        )
        self._access_token: str | None = None
        self._access_token_expires_at: float = 0.0
        self._site_id: str | None = None

    def _validate_config(self) -> str | None:
        if not self.client_id:
            return "SHP_ID_APP is required."
        if not self.client_secret:
            return "SHP_ID_APP_SECRET is required."
        if not self.tenant_id:
            return "SHP_TENANT_ID is required."
        if not self.site_url:
            return "SHP_SITE_URL is required."
        if not self.doc_library:
            return "SHP_DOC_LIBRARY is required."
        return None

    def _parse_site_url(self) -> tuple[str, str, str] | None:
        parsed = urlparse(self.site_url)
        host = parsed.netloc
        path = (parsed.path or "").strip("/")

        if not host or not path:
            return None

        parts = [p for p in path.split("/") if p]
        if len(parts) < 2:
            return None

        site_path = f"/{'/'.join(parts)}"
        return host, parts[0], site_path

    def _get_access_token(self) -> dict[str, Any]:
        now = time.time()
        refresh_buffer_seconds = 300

        if self._access_token and now < (
            self._access_token_expires_at - refresh_buffer_seconds
        ):
            return {"status": "success", "access_token": self._access_token}

        response = self.call_api(
            url=self.token_url,
            method="POST",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "scope": "https://graph.microsoft.com/.default",
                "grant_type": "client_credentials",
            },
        )

        if response.status_code == 401:
            return {
                "status": "error",
                "code": 401,
                "message": "Authentication failed. Check SHP_TENANT_ID, SHP_ID_APP, and SHP_ID_APP_SECRET.",
            }

        if response.status_code == 403:
            return {
                "status": "error",
                "code": 403,
                "message": "Token request forbidden. Verify app permissions and tenant policy.",
                "details": response.text,
            }

        if response.status_code == 429:
            return {
                "status": "error",
                "code": 429,
                "message": "Token endpoint rate limit exceeded. Retry after a short delay.",
                "details": response.text,
            }

        if response.status_code >= 400:
            return {
                "status": "error",
                "code": response.status_code,
                "message": "Failed to fetch Microsoft Graph access token.",
                "details": response.text,
            }

        try:
            payload = response.json()
        except ValueError:
            return {
                "status": "error",
                "code": response.status_code,
                "message": "Token endpoint returned a non-JSON response.",
            }

        token = payload.get("access_token")
        expires_in = int(payload.get("expires_in", 3600))

        if not token:
            return {
                "status": "error",
                "code": response.status_code,
                "message": "Token endpoint did not return an access token.",
            }

        self._access_token = token
        self._access_token_expires_at = now + expires_in

        return {"status": "success", "access_token": token}

    def _graph_request(
        self,
        endpoint: str,
        method: str = "GET",
        data: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        auth = self._get_access_token()
        if auth["status"] != "success":
            return auth

        req_headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {auth['access_token']}",
        }
        if headers:
            req_headers.update(headers)

        response = self.call_api(
            url=f"{self.graph_base_url}{endpoint}",
            method=method,
            headers=req_headers,
            json=data,
        )

        if response.status_code == 401:
            return {
                "status": "error",
                "code": 401,
                "message": "Authentication failed when calling Microsoft Graph.",
            }

        if response.status_code == 403:
            return {
                "status": "error",
                "code": 403,
                "message": "Forbidden. The app likely lacks required SharePoint/Graph permissions.",
                "details": response.text,
            }

        if response.status_code == 404:
            return {
                "status": "error",
                "code": 404,
                "message": "The requested SharePoint resource was not found.",
                "details": response.text,
            }

        if response.status_code == 429:
            return {
                "status": "error",
                "code": 429,
                "message": "Microsoft Graph rate limit exceeded. Retry after a short delay.",
                "details": response.text,
            }

        if response.status_code >= 400:
            return {
                "status": "error",
                "code": response.status_code,
                "message": "Microsoft Graph request failed.",
                "details": response.text,
            }

        if response.status_code in (202, 204):
            return {"status": "success", "data": None}

        content_type = (response.headers.get("Content-Type") or "").lower()
        if "application/json" in content_type:
            try:
                return {"status": "success", "data": response.json()}
            except ValueError:
                return {
                    "status": "error",
                    "code": 500,
                    "message": "Graph returned invalid JSON.",
                }

        return {"status": "success", "data": response.content}

    def _get_site_id(self) -> dict[str, Any]:
        if self._site_id:
            return {"status": "success", "site_id": self._site_id}

        parsed = self._parse_site_url()
        if parsed is None:
            return {
                "status": "error",
                "code": 400,
                "message": "Invalid SHP_SITE_URL format.",
            }

        host, _, site_path = parsed
        endpoint = f"/sites/{host}:{site_path}"
        result = self._graph_request(endpoint)
        if result["status"] != "success":
            return result

        site_id = (result.get("data") or {}).get("id")
        if not site_id:
            return {
                "status": "error",
                "code": 500,
                "message": "Unable to resolve SharePoint site ID.",
            }

        self._site_id = site_id
        return {"status": "success", "site_id": site_id}

    def _normalize_path(self, document_path: str | None = None) -> str:
        raw_path = (document_path or "").strip()
        if raw_path.startswith("/drive/root:/"):
            raw_path = raw_path[len("/drive/root:/") :]
        elif raw_path.startswith("drive/root:/"):
            raw_path = raw_path[len("drive/root:/") :]

        clean_path = posixpath.normpath(f"/{raw_path}").lstrip("/") if raw_path else ""
        if clean_path.startswith(".."):
            raise ValueError("Invalid path traversal attempt.")

        scope_prefix = f"{self.doc_library}/"
        if clean_path == self.doc_library or clean_path.startswith(scope_prefix):
            return clean_path

        if clean_path:
            return f"{self.doc_library}/{clean_path}".strip("/")
        return self.doc_library

    def _build_children_endpoint(self, site_id: str, folder_path: str) -> str:
        if folder_path:
            return f"/sites/{site_id}/drive/root:/{quote(folder_path)}:/children"
        return f"/sites/{site_id}/drive/root/children"

    def _build_item_endpoint(self, site_id: str, file_path: str) -> str:
        return f"/sites/{site_id}/drive/root:/{quote(file_path)}"

    @connector_tool
    def list_documents(self, relative_folder_path: str = "") -> dict[str, Any]:
        """List documents in the configured SharePoint library scope."""
        config_error = self._validate_config()
        if config_error:
            return {"status": "error", "code": 400, "message": config_error}

        site = self._get_site_id()
        if site["status"] != "success":
            return site

        try:
            folder_path = self._normalize_path(relative_folder_path)
        except ValueError as exc:
            return {"status": "error", "code": 400, "message": str(exc)}

        endpoint = self._build_children_endpoint(site["site_id"], folder_path)
        result = self._graph_request(endpoint)
        if result["status"] != "success":
            return result

        items = (result.get("data") or {}).get("value", [])
        files = [i for i in items if "file" in i]

        return {
            "status": "success",
            "folder": relative_folder_path,
            "documents": [
                {
                    "name": item.get("name"),
                    "path": item.get("parentReference", {}).get("path"),
                    "url": item.get("webUrl"),
                    "size": item.get("size"),
                    "created": item.get("createdDateTime"),
                    "modified": item.get("lastModifiedDateTime"),
                    "mime_type": (item.get("file") or {}).get("mimeType"),
                }
                for item in files
            ],
        }

    @connector_tool
    def get_document_content(self, document_path: str) -> dict[str, Any]:
        """Get document content from SharePoint. Text is returned as text, binaries as Base64."""
        config_error = self._validate_config()
        if config_error:
            return {"status": "error", "code": 400, "message": config_error}
        if not document_path.strip():
            return {
                "status": "error",
                "code": 400,
                "message": "document_path is required.",
            }

        site = self._get_site_id()
        if site["status"] != "success":
            return site

        try:
            full_path = self._normalize_path(document_path)
        except ValueError as exc:
            return {"status": "error", "code": 400, "message": str(exc)}

        metadata_result = self._graph_request(
            self._build_item_endpoint(site["site_id"], full_path)
        )
        if metadata_result["status"] != "success":
            return metadata_result

        content_result = self._graph_request(
            f"{self._build_item_endpoint(site['site_id'], full_path)}:/content"
        )
        if content_result["status"] != "success":
            return content_result

        binary = content_result.get("data")
        if not isinstance(binary, (bytes, bytearray)):
            return {
                "status": "error",
                "code": 500,
                "message": "Unexpected content response from Graph.",
            }

        metadata = metadata_result.get("data") or {}
        mime_type = ((metadata.get("file") or {}).get("mimeType") or "").lower()

        if (
            mime_type.startswith("text/")
            or mime_type in {"application/json", "application/xml"}
            or document_path.lower().endswith(
                (".md", ".txt", ".json", ".xml", ".yaml", ".yml", ".py")
            )
        ):
            try:
                text_content = bytes(binary).decode("utf-8")
            except UnicodeDecodeError:
                text_content = bytes(binary).decode("utf-8", errors="replace")
            return {
                "status": "success",
                "document_path": document_path,
                "mime_type": mime_type,
                "content": text_content,
                "encoding": "utf-8",
            }

        return {
            "status": "success",
            "document_path": document_path,
            "mime_type": mime_type,
            "content_base64": base64.b64encode(bytes(binary)).decode("utf-8"),
            "encoding": "base64",
        }

    @connector_tool
    def update_document(self, document_path: str, content: str) -> dict[str, Any]:
        """Update an existing markdown document (.md only)."""
        config_error = self._validate_config()
        if config_error:
            return {"status": "error", "code": 400, "message": config_error}

        normalized_path = document_path.strip()
        if not normalized_path:
            return {
                "status": "error",
                "code": 400,
                "message": "document_path is required.",
            }
        if not normalized_path.lower().endswith(".md"):
            return {
                "status": "error",
                "code": 400,
                "message": "update_document currently supports only .md files.",
            }

        site = self._get_site_id()
        if site["status"] != "success":
            return site

        try:
            full_path = self._normalize_path(normalized_path)
        except ValueError as exc:
            return {"status": "error", "code": 400, "message": str(exc)}

        check_result = self._graph_request(
            self._build_item_endpoint(site["site_id"], full_path)
        )
        if check_result["status"] != "success":
            return check_result

        auth = self._get_access_token()
        if auth["status"] != "success":
            return auth

        put_response = self.call_api(
            url=(
                f"{self.graph_base_url}"
                f"{self._build_item_endpoint(site['site_id'], full_path)}:/content"
            ),
            method="PUT",
            headers={
                "Authorization": f"Bearer {auth['access_token']}",
                "Content-Type": "text/markdown; charset=utf-8",
            },
            data=cast(dict[str, str], content),
        )

        if put_response.status_code >= 400:
            return {
                "status": "error",
                "code": put_response.status_code,
                "message": "Failed to update markdown document.",
                "details": put_response.text,
            }

        try:
            payload = put_response.json()
        except ValueError:
            payload = {}

        return {
            "status": "success",
            "document_path": normalized_path,
            "message": "Document updated successfully.",
            "modified": payload.get("lastModifiedDateTime"),
            "url": payload.get("webUrl"),
        }

"""
OneDrive Connector v1.0.0
Read documents from a user's OneDrive for Business via Microsoft Graph API.
Uses the SharePoint personal site approach — no extra permissions beyond Sites.Read.All.
"""

from __future__ import annotations

import base64
import io
import time
from typing import Any

import pypdf

try:
    from base_connector import BaseConnector, connector_tool
except ModuleNotFoundError:
    from src.connectors.base_connector import BaseConnector, connector_tool


class OneDriveConnector(BaseConnector):
    """OneDrive for Business connector via Microsoft Graph API."""

    def __init__(
        self,
        OD_ID_APP: str,
        OD_ID_APP_SECRET: str,
        OD_TENANT_ID: str,
        OD_TENANT: str,
        OD_USER_EMAIL: str,
        OD_FOLDER: str = "",
        prefix: str = "",
    ):
        super().__init__(prefix=prefix)
        self.client_id = OD_ID_APP.strip()
        self.client_secret = OD_ID_APP_SECRET.strip()
        self.tenant_id = OD_TENANT_ID.strip()
        self.tenant = OD_TENANT.strip().rstrip("-my").rstrip()
        self.user_email = OD_USER_EMAIL.strip()
        self.folder = OD_FOLDER.strip().strip("/")
        self.graph_base_url = "https://graph.microsoft.com/v1.0"
        self.token_url = (
            f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
        )
        self._access_token: str | None = None
        self._access_token_expires_at: float = 0.0
        self._site_id: str | None = None

    # ── Config & Auth ──────────────────────────────────────────────────────────

    def _validate_config(self) -> str | None:
        if not self.client_id:
            return "OD_ID_APP is required."
        if not self.client_secret:
            return "OD_ID_APP_SECRET is required."
        if not self.tenant_id:
            return "OD_TENANT_ID is required."
        if not self.tenant:
            return "OD_TENANT is required."
        if not self.user_email:
            return "OD_USER_EMAIL is required."
        if not self.folder:
            return "OD_FOLDER is required."
        return None

    def _get_access_token(self) -> dict[str, Any]:
        now = time.time()
        if self._access_token and now < (self._access_token_expires_at - 300):
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
                "message": "Authentication failed. Check OD_TENANT_ID, OD_ID_APP, and OD_ID_APP_SECRET.",
            }
        if response.status_code == 403:
            return {
                "status": "error",
                "code": 403,
                "message": "Token request forbidden. Verify app permissions and tenant policy.",
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
                "message": "Token endpoint returned a non-JSON response.",
            }

        token = payload.get("access_token")
        expires_in = int(payload.get("expires_in", 3600))
        if not token:
            return {
                "status": "error",
                "message": "Token endpoint did not return an access token.",
            }

        self._access_token = token
        self._access_token_expires_at = now + expires_in
        return {"status": "success", "access_token": token}

    def _graph_request(
        self,
        endpoint: str,
        raw: bool = False,
    ) -> dict[str, Any]:
        auth = self._get_access_token()
        if auth["status"] != "success":
            return auth

        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {auth['access_token']}",
        }

        url = (
            endpoint
            if endpoint.startswith("https://")
            else f"{self.graph_base_url}{endpoint}"
        )

        response = self.call_api(url=url, method="GET", headers=headers)

        if response.status_code == 401:
            return {"status": "error", "code": 401, "message": "Authentication failed."}
        if response.status_code == 403:
            return {
                "status": "error",
                "code": 403,
                "message": "Forbidden. The app likely lacks Sites.Read.All permission.",
                "details": response.text,
            }
        if response.status_code == 404:
            return {"status": "error", "code": 404, "message": "Resource not found."}
        if response.status_code >= 400:
            return {
                "status": "error",
                "code": response.status_code,
                "message": "Graph API request failed.",
                "details": response.text,
            }

        if raw:
            return {"status": "success", "data": response.content}

        try:
            return {"status": "success", "data": response.json()}
        except Exception:
            return {
                "status": "error",
                "message": "Graph API returned a non-JSON response.",
            }

    # ── Site & Drive Resolution ────────────────────────────────────────────────

    def _personal_site_url(self) -> str:
        """Convert user email to OneDrive personal site URL."""
        local = self.user_email.replace("@", "_").replace(".", "_")
        return f"https://{self.tenant}-my.sharepoint.com/personal/{local}"

    def _get_site_id(self) -> dict[str, Any]:
        if self._site_id:
            return {"status": "success", "site_id": self._site_id}

        site_url = self._personal_site_url()
        from urllib.parse import urlparse

        parsed = urlparse(site_url)
        host = parsed.netloc
        path = parsed.path.strip("/")

        result = self._graph_request(f"/sites/{host}:/{path}")
        if result["status"] != "success":
            return result

        site_id = result["data"].get("id")
        if not site_id:
            return {"status": "error", "message": "Could not resolve OneDrive site ID."}

        self._site_id = site_id
        return {"status": "success", "site_id": site_id}

    # ── Tools ──────────────────────────────────────────────────────────────────

    @connector_tool
    def list_documents(self) -> dict[str, Any]:
        """
        List documents in the user's OneDrive for Business.

        Lists files from OD_FOLDER if configured, otherwise from the root.

        Returns:
            dict: List of files with id, name, size, last modified, and download URL.
        """
        error = self._validate_config()
        if error:
            return {"status": "error", "message": error}

        site = self._get_site_id()
        if site["status"] != "success":
            return site

        site_id = site["site_id"]

        if self.folder:
            endpoint = f"/sites/{site_id}/drive/root:/{self.folder}:/children"
        else:
            endpoint = f"/sites/{site_id}/drive/root/children"

        result = self._graph_request(endpoint)
        if result["status"] != "success":
            return result

        items = result["data"].get("value", [])
        files = [
            {
                "id": item["id"],
                "name": item["name"],
                "size": item.get("size", 0),
                "last_modified": item.get("lastModifiedDateTime", ""),
                "type": "folder" if "folder" in item else "file",
            }
            for item in items
        ]

        return {
            "status": "success",
            "folder": self.folder or "root",
            "count": len(files),
            "files": files,
        }

    @connector_tool
    def get_document_content(self, file_name: str) -> dict[str, Any]:
        """
        Get the content of a document from OneDrive by file name.

        .docx returns extracted plain text.
        .pdf returns extracted plain text.
        .md and text files return plain text.
        All other files return Base64.

        Args:
            file_name: Name of the file (e.g. handbook.docx, report.pdf).

        Returns:
            dict: File content as plain text or Base64.
        """
        error = self._validate_config()
        if error:
            return {"status": "error", "message": error}

        if not file_name.strip():
            return {"status": "error", "message": "file_name is required."}

        site = self._get_site_id()
        if site["status"] != "success":
            return site

        site_id = site["site_id"]
        file_name = file_name.strip()

        # Build path
        file_path = f"{self.folder}/{file_name}" if self.folder else file_name

        # Get file content
        content_result = self._graph_request(
            f"/sites/{site_id}/drive/root:/{file_path}:/content",
            raw=True,
        )
        if content_result["status"] != "success":
            return content_result

        binary = bytes(content_result["data"])
        lower = file_name.lower()

        # .docx → extract plain text
        if lower.endswith(".docx"):
            try:
                import zipfile
                from xml.etree import ElementTree as ET

                with zipfile.ZipFile(io.BytesIO(binary)) as z:
                    xml = z.read("word/document.xml")
                ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
                root = ET.fromstring(xml)
                paragraphs = []
                for para in root.iter(f"{ns}p"):
                    text = "".join(t.text or "" for t in para.iter(f"{ns}t"))
                    if text.strip():
                        paragraphs.append(text)
                content = "\n".join(paragraphs)
            except Exception as exc:
                return {
                    "status": "error",
                    "message": f"Failed to extract docx text: {exc}",
                }
            return {
                "status": "success",
                "file_name": file_name,
                "content": content,
                "encoding": "utf-8",
            }

        # .pdf → extract plain text
        if lower.endswith(".pdf"):
            try:
                reader = pypdf.PdfReader(io.BytesIO(binary))
                pages_text = []
                for page in reader.pages:
                    page_text = page.extract_text() or ""
                    if page_text.strip():
                        pages_text.append(page_text)
                content = "\n\n".join(pages_text)
            except Exception as exc:
                return {
                    "status": "error",
                    "message": f"Failed to extract PDF text: {exc}",
                }
            return {
                "status": "success",
                "file_name": file_name,
                "content": content,
                "encoding": "utf-8",
            }

        # Text files → plain text
        if lower.endswith(
            (".md", ".txt", ".json", ".xml", ".yaml", ".yml", ".py", ".csv")
        ):
            try:
                content = binary.decode("utf-8")
            except UnicodeDecodeError:
                content = binary.decode("utf-8", errors="replace")
            return {
                "status": "success",
                "file_name": file_name,
                "content": content,
                "encoding": "utf-8",
            }

        # Binary → Base64
        return {
            "status": "success",
            "file_name": file_name,
            "content_base64": base64.b64encode(binary).decode("utf-8"),
            "encoding": "base64",
        }

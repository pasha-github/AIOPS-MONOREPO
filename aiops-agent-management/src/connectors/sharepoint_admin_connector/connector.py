"""
SharePoint Admin Connector v1.0.0
Manage SharePoint folder permissions via Microsoft Graph.
"""

from __future__ import annotations

import time
from typing import Any
from urllib.parse import quote, urlparse

try:
    from base_connector import BaseConnector, connector_tool
except ModuleNotFoundError:
    from src.connectors.base_connector import BaseConnector, connector_tool


class SharepointAdminConnector(BaseConnector):
    """Connector for managing SharePoint folder permissions via Microsoft Graph."""

    def __init__(
        self,
        SHP_ID_APP: str,
        SHP_ID_APP_SECRET: str,
        SHP_TENANT_ID: str,
        SHP_SITE_URL: str,
        prefix: str = "",
    ):
        self.client_id = SHP_ID_APP.strip()
        self.client_secret = SHP_ID_APP_SECRET.strip()
        self.tenant_id = SHP_TENANT_ID.strip()
        self.site_url = SHP_SITE_URL.strip().rstrip("/")
        self.graph_base_url = "https://graph.microsoft.com/v1.0"
        self.token_url = (
            f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
        )
        self._access_token: str | None = None
        self._access_token_expires_at: float = 0.0
        self._site_id: str | None = None
        super().__init__(prefix=prefix)

    # ── Config & Auth ──────────────────────────────────────────────────────────

    def _validate_config(self) -> str | None:
        if not self.client_id:
            return "SHP_ID_APP is required."
        if not self.client_secret:
            return "SHP_ID_APP_SECRET is required."
        if not self.tenant_id:
            return "SHP_TENANT_ID is required."
        if not self.site_url:
            return "SHP_SITE_URL is required."
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
    ) -> dict[str, Any]:
        auth = self._get_access_token()
        if auth["status"] != "success":
            return auth

        response = self.call_api(
            url=f"{self.graph_base_url}{endpoint}",
            method=method,
            headers={
                "Accept": "application/json",
                "Authorization": f"Bearer {auth['access_token']}",
            },
            json=data,
        )

        if response.status_code == 401:
            return {"status": "error", "code": 401, "message": "Authentication failed."}
        if response.status_code == 403:
            return {
                "status": "error",
                "code": 403,
                "message": "Forbidden. The app likely lacks Sites.FullControl.All or Files.ReadWrite.All permission.",
                "details": response.text,
            }
        if response.status_code == 404:
            return {
                "status": "error",
                "code": 404,
                "message": "Resource not found.",
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

        try:
            return {"status": "success", "data": response.json()}
        except ValueError:
            return {
                "status": "error",
                "code": 500,
                "message": "Graph returned invalid JSON.",
            }

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
        result = self._graph_request(f"/sites/{host}:{site_path}")
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

    def _get_item_id(self, site_id: str, folder_path: str) -> dict[str, Any]:
        """Resolve a folder path (from drive root) to its Graph item ID."""
        encoded = quote(folder_path.strip("/"))
        result = self._graph_request(f"/sites/{site_id}/drive/root:/{encoded}")
        if result["status"] != "success":
            return result
        item_id = (result.get("data") or {}).get("id")
        if not item_id:
            return {
                "status": "error",
                "code": 404,
                "message": f"Folder '{folder_path}' not found.",
            }
        return {"status": "success", "item_id": item_id}

    # ── Tools ──────────────────────────────────────────────────────────────────

    @connector_tool
    def list_folder_permissions(self, folder_path: str) -> dict[str, Any]:
        """List all users and groups with their permission roles on a SharePoint folder.

        Args:
            folder_path: Path to the folder from the drive root (e.g. 'Documents/Reports').
        """
        config_error = self._validate_config()
        if config_error:
            return {"status": "error", "code": 400, "message": config_error}
        if not folder_path.strip():
            return {
                "status": "error",
                "code": 400,
                "message": "folder_path is required.",
            }

        site = self._get_site_id()
        if site["status"] != "success":
            return site

        item = self._get_item_id(site["site_id"], folder_path.strip())
        if item["status"] != "success":
            return item

        perms_result = self._graph_request(
            f"/sites/{site['site_id']}/drive/items/{item['item_id']}/permissions"
        )
        if perms_result["status"] != "success":
            return perms_result

        permissions = (perms_result.get("data") or {}).get("value", [])
        entries = []
        for perm in permissions:
            roles = perm.get("roles", [])
            inherited = "inheritedFrom" in perm
            granted_to = perm.get("grantedToV2") or perm.get("grantedTo") or {}
            identities = (
                perm.get("grantedToIdentitiesV2")
                or perm.get("grantedToIdentities")
                or []
            )
            group = granted_to.get("group") or granted_to.get("siteGroup") or {}
            group_name = group.get("displayName", "")

            if identities:
                for identity in identities:
                    id_user = identity.get("user") or identity.get("siteUser") or {}
                    entries.append(
                        {
                            "type": "user",
                            "email": id_user.get("email", ""),
                            "display_name": id_user.get("displayName", ""),
                            "roles": roles,
                            "inherited": inherited,
                        }
                    )
            elif group_name:
                user = granted_to.get("user") or granted_to.get("siteUser") or {}
                entries.append(
                    {
                        "type": "group",
                        "email": user.get("email", ""),
                        "display_name": group_name,
                        "roles": roles,
                        "inherited": inherited,
                    }
                )
            else:
                user = granted_to.get("user") or granted_to.get("siteUser") or {}
                entries.append(
                    {
                        "type": "user",
                        "email": user.get("email", ""),
                        "display_name": user.get("displayName", ""),
                        "roles": roles,
                        "inherited": inherited,
                    }
                )

        return {
            "status": "success",
            "folder_path": folder_path,
            "count": len(entries),
            "permissions": entries,
        }

    @connector_tool
    def grant_folder_access(
        self, folder_path: str, user_email: str, role: str = "read"
    ) -> dict[str, Any]:
        """Grant a user read or write access to a SharePoint folder by their email address.

        Args:
            folder_path: Path to the folder from the drive root (e.g. 'Documents/Reports').
            user_email: Email address of the user to grant access to.
            role: Permission role — 'read' or 'write'. Defaults to 'read'.
        """
        config_error = self._validate_config()
        if config_error:
            return {"status": "error", "code": 400, "message": config_error}
        if not folder_path.strip():
            return {
                "status": "error",
                "code": 400,
                "message": "folder_path is required.",
            }
        if not user_email.strip():
            return {
                "status": "error",
                "code": 400,
                "message": "user_email is required.",
            }

        role = role.strip().lower()
        if role not in ("read", "write"):
            return {
                "status": "error",
                "code": 400,
                "message": "role must be 'read' or 'write'.",
            }

        site = self._get_site_id()
        if site["status"] != "success":
            return site

        item = self._get_item_id(site["site_id"], folder_path.strip())
        if item["status"] != "success":
            return item

        result = self._graph_request(
            f"/sites/{site['site_id']}/drive/items/{item['item_id']}/invite",
            method="POST",
            data={
                "recipients": [{"email": user_email.strip()}],
                "roles": [role],
                "sendInvitation": False,
                "requireSignIn": True,
            },
        )
        if result["status"] != "success":
            return result

        return {
            "status": "success",
            "folder_path": folder_path,
            "user_email": user_email,
            "role": role,
            "message": "Access granted successfully.",
        }

    @connector_tool
    def remove_folder_access(self, folder_path: str, user_email: str) -> dict[str, Any]:
        """Remove a user's access from a SharePoint folder by their email address.

        Args:
            folder_path: Path to the folder from the drive root (e.g. 'Documents/Reports').
            user_email: Email address of the user whose access should be removed.
        """
        config_error = self._validate_config()
        if config_error:
            return {"status": "error", "code": 400, "message": config_error}
        if not folder_path.strip():
            return {
                "status": "error",
                "code": 400,
                "message": "folder_path is required.",
            }
        if not user_email.strip():
            return {
                "status": "error",
                "code": 400,
                "message": "user_email is required.",
            }

        site = self._get_site_id()
        if site["status"] != "success":
            return site

        item = self._get_item_id(site["site_id"], folder_path.strip())
        if item["status"] != "success":
            return item

        perms_result = self._graph_request(
            f"/sites/{site['site_id']}/drive/items/{item['item_id']}/permissions"
        )
        if perms_result["status"] != "success":
            return perms_result

        permissions = (perms_result.get("data") or {}).get("value", [])
        target_email = user_email.strip().lower()
        perm_id = None
        for perm in permissions:
            granted_to = perm.get("grantedToV2") or perm.get("grantedTo") or {}
            email = (
                (granted_to.get("user") or {}).get("email", "")
                or (granted_to.get("siteUser") or {}).get("email", "")
            ).lower()
            if email == target_email:
                perm_id = perm.get("id")
                break

        if not perm_id:
            return {
                "status": "error",
                "code": 404,
                "message": f"No permission entry found for '{user_email}' on folder '{folder_path}'.",
            }

        delete_result = self._graph_request(
            f"/sites/{site['site_id']}/drive/items/{item['item_id']}/permissions/{perm_id}",
            method="DELETE",
        )
        if delete_result["status"] != "success":
            return delete_result

        return {
            "status": "success",
            "folder_path": folder_path,
            "user_email": user_email,
            "message": "Access removed successfully.",
        }

    @connector_tool
    def copy_folder_access(
        self, folder_path: str, source_email: str, target_email: str
    ) -> dict[str, Any]:
        """Grant a user the same permissions on a SharePoint folder that another user already has.

        Args:
            folder_path: Path to the folder from the drive root (e.g. 'SOP/Documents').
            source_email: Email of the user whose permissions to copy FROM.
            target_email: Email of the user to grant the same permissions TO.
        """
        config_error = self._validate_config()
        if config_error:
            return {"status": "error", "code": 400, "message": config_error}
        if (
            not folder_path.strip()
            or not source_email.strip()
            or not target_email.strip()
        ):
            return {
                "status": "error",
                "code": 400,
                "message": "folder_path, source_email, and target_email are all required.",
            }

        site = self._get_site_id()
        if site["status"] != "success":
            return site

        item = self._get_item_id(site["site_id"], folder_path.strip())
        if item["status"] != "success":
            return item

        perms_result = self._graph_request(
            f"/sites/{site['site_id']}/drive/items/{item['item_id']}/permissions"
        )
        if perms_result["status"] != "success":
            return perms_result

        permissions = (perms_result.get("data") or {}).get("value", [])
        source = source_email.strip().lower()
        all_roles: set[str] = set()

        for perm in permissions:
            matched = False
            # Check grantedToIdentitiesV2 (sharing-link based permissions)
            identities = (
                perm.get("grantedToIdentitiesV2")
                or perm.get("grantedToIdentities")
                or []
            )
            for identity in identities:
                id_user = identity.get("user") or identity.get("siteUser") or {}
                if id_user.get("email", "").lower() == source:
                    matched = True
                    break

            # Check grantedToV2 / grantedTo (direct user permissions)
            if not matched:
                granted_to = perm.get("grantedToV2") or perm.get("grantedTo") or {}
                user = granted_to.get("user") or granted_to.get("siteUser") or {}
                if user.get("email", "").lower() == source:
                    matched = True

            if matched:
                all_roles.update(perm.get("roles", []))

        roles = list(all_roles)
        if not roles:
            return {
                "status": "error",
                "code": 404,
                "message": f"No permissions found for '{source_email}' on folder '{folder_path}'.",
            }

        result = self._graph_request(
            f"/sites/{site['site_id']}/drive/items/{item['item_id']}/invite",
            method="POST",
            data={
                "recipients": [{"email": target_email.strip()}],
                "roles": roles,
                "sendInvitation": False,
                "requireSignIn": True,
            },
        )
        if result["status"] != "success":
            return result

        return {
            "status": "success",
            "folder_path": folder_path,
            "source_email": source_email,
            "target_email": target_email,
            "roles_copied": roles,
            "message": f"Access copied from '{source_email}' to '{target_email}' successfully.",
        }

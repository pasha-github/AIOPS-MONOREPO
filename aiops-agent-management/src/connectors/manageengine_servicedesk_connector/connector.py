"""
ManageEngine ServiceDesk Plus Cloud Connector v1.0.0
---------------------------------------------------
CRUD tools for the ServiceDesk Plus Cloud API v3 Requests and Changes modules.
"""

import json
import time
from typing import Any
from urllib.parse import quote

from google.adk.tools.tool_context import ToolContext

try:
    from base_connector import BaseConnector, connector_tool
except ModuleNotFoundError:
    from src.connectors.base_connector import BaseConnector, connector_tool


class ManageEngineServiceDeskConnector(BaseConnector):
    """Connector for ManageEngine ServiceDesk Plus Cloud requests and changes."""

    _ACCEPT = "application/vnd.manageengine.sdp.v3+json"
    _SCOPES = "SDPOnDemand.requests.ALL,SDPOnDemand.changes.ALL"

    def __init__(
        self,
        CLIENT_ID: str,
        CLIENT_SECRET: str,
        API_DOMAIN: str,
        ACCOUNTS_SERVER_URL: str,
        PORTAL: str = "",
        prefix: str = "",
        **_ignored_config: str,
    ):
        self.client_id = CLIENT_ID.strip()
        self.client_secret = CLIENT_SECRET.strip()
        self.api_domain = API_DOMAIN.strip().rstrip("/")
        self.accounts_server_url = ACCOUNTS_SERVER_URL.strip().rstrip("/")
        self.portal = PORTAL.strip().strip("/")
        required = {
            "CLIENT_ID": self.client_id,
            "CLIENT_SECRET": self.client_secret,
            "API_DOMAIN": self.api_domain,
            "ACCOUNTS_SERVER_URL": self.accounts_server_url,
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise ValueError(f"Missing required configuration: {', '.join(missing)}.")
        self.access_token = ""
        self.access_token_expires_at = 0.0
        super().__init__(prefix=prefix)

    @property
    def api_base(self) -> str:
        portal_path = f"/app/{quote(self.portal, safe='')}" if self.portal else ""
        return f"{self.api_domain}{portal_path}/api/v3"

    def _refresh_access_token(self, force: bool = False) -> dict[str, Any] | None:
        if (
            not force
            and self.access_token
            and self.api_domain
            and time.monotonic() < self.access_token_expires_at
        ):
            return None

        token_data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "client_credentials",
            "scope": self._SCOPES,
        }

        try:
            response = self.call_api(
                url=f"{self.accounts_server_url}/oauth/v2/token",
                method="POST",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data=token_data,
            )
        except Exception as exc:
            return {"status": "error", "message": f"OAuth token request failed: {exc}"}

        try:
            body = response.json()
        except ValueError:
            body = {"message": response.text}
        access_token = body.get("access_token") if isinstance(body, dict) else None
        if response.status_code >= 400 or not access_token:
            return {
                "status": "error",
                "code": response.status_code,
                "message": body,
            }

        self.access_token = str(access_token)
        try:
            expires_in = max(int(body.get("expires_in", 3600)), 60)
        except (TypeError, ValueError):
            expires_in = 3600
        self.access_token_expires_at = time.monotonic() + max(expires_in - 60, 1)
        return None

    def _call_sdp(
        self,
        endpoint: str,
        method: str = "GET",
        payload: dict[str, Any] | None = None,
        list_info: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        auth_error = self._refresh_access_token()
        if auth_error:
            return auth_error
        headers = {
            "Accept": self._ACCEPT,
            "Authorization": f"Zoho-oauthtoken {self.access_token}",
        }
        data = None
        params = None
        if payload is not None:
            headers["Content-Type"] = "application/x-www-form-urlencoded"
            data = {"input_data": json.dumps(payload, separators=(",", ":"))}
        if list_info is not None:
            params = {
                "input_data": json.dumps(
                    {"list_info": list_info}, separators=(",", ":")
                )
            }

        request_kwargs = {
            "url": f"{self.api_base}{endpoint}",
            "method": method,
            "headers": headers,
            "data": data,
            "params": params,
        }
        try:
            response = self.call_api(**request_kwargs)
            if response.status_code == 401:
                auth_error = self._refresh_access_token(force=True)
                if auth_error:
                    return auth_error
                request_kwargs["url"] = f"{self.api_base}{endpoint}"
                request_kwargs["headers"]["Authorization"] = (
                    f"Zoho-oauthtoken {self.access_token}"
                )
                response = self.call_api(**request_kwargs)
        except Exception as exc:
            return {"status": "error", "message": f"Request failed: {exc}"}

        try:
            body: Any = response.json()
        except ValueError:
            body = response.text
        if response.status_code >= 400:
            return {
                "status": "error",
                "code": response.status_code,
                "message": body,
            }
        return {"status": "success", "code": response.status_code, "data": body}

    @staticmethod
    def _id(value: str | int, field: str) -> str:
        normalized = str(value).strip()
        if not normalized or not normalized.isdigit():
            raise ValueError(f"{field} must be an internal numeric ID.")
        return normalized

    @staticmethod
    def _request_identifier(record: dict[str, Any]) -> dict[str, str]:
        identifier = {}
        internal_id = record.get("id")
        display_id = record.get("display_id")
        if internal_id:
            identifier["request_id_for_updates"] = str(internal_id)
        if display_id:
            identifier["request_number"] = str(display_id)
        return identifier

    def _annotate_request_result(self, result: dict[str, Any]) -> dict[str, Any]:
        if result.get("status") != "success" or not isinstance(
            result.get("data"), dict
        ):
            return result

        data = result["data"]
        records = []
        if isinstance(data.get("request"), dict):
            records.append(data["request"])
        elif isinstance(data.get("requests"), list):
            records.extend(item for item in data["requests"] if isinstance(item, dict))

        identifiers = [
            identifier
            for identifier in (self._request_identifier(record) for record in records)
            if identifier
        ]
        if identifiers:
            result["request_identifiers"] = identifiers
            if len(identifiers) == 1:
                result.update(identifiers[0])
        return result

    def _resolve_request_id(
        self, value: str | int
    ) -> tuple[str | None, dict[str, Any] | None]:
        normalized = str(value).strip()
        if not normalized or not normalized.isdigit():
            return None, {
                "status": "error",
                "code": 400,
                "message": (
                    "request_id must be a numeric internal ID or numeric request number."
                ),
            }
        if len(normalized) >= 10:
            return normalized, None

        result = self._call_sdp(
            "/requests",
            list_info={
                "row_count": 1,
                "start_index": 1,
                "search_criteria": {
                    "field": "display_id",
                    "condition": "is",
                    "value": normalized,
                },
            },
        )
        if result.get("status") != "success":
            return None, result

        data = result.get("data")
        requests = data.get("requests") if isinstance(data, dict) else None
        if not requests:
            return None, {
                "status": "error",
                "code": 404,
                "message": f"Request number {normalized} was not found.",
            }

        internal_id = requests[0].get("id") if isinstance(requests[0], dict) else None
        if not internal_id:
            return None, {
                "status": "error",
                "code": 404,
                "message": (
                    f"Request number {normalized} was found, but no internal ID "
                    "was returned by ManageEngine."
                ),
            }
        return str(internal_id), None

    @connector_tool
    def create_request(
        self, request: dict[str, Any], tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Create a service desk request. The request object must include at least subject."""
        if not str(request.get("subject", "")).strip():
            return {"status": "error", "code": 400, "message": "subject is required."}
        return self._annotate_request_result(
            self._call_sdp("/requests", "POST", {"request": request})
        )

    @connector_tool
    def update_request(
        self,
        request_id: str,
        request: dict[str, Any],
        tool_context: ToolContext | None = None,
    ) -> dict[str, Any]:
        """Update a request using its internal ID or displayed request number."""
        item_id, error = self._resolve_request_id(request_id)
        if error:
            return error
        return self._annotate_request_result(
            self._call_sdp(f"/requests/{item_id}", "PUT", {"request": request})
        )

    @connector_tool
    def get_request(
        self, request_id: str, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get one request by its internal ID or displayed request number."""
        item_id, error = self._resolve_request_id(request_id)
        if error:
            return error
        return self._annotate_request_result(self._call_sdp(f"/requests/{item_id}"))

    @connector_tool
    def list_requests(
        self,
        list_info: dict[str, Any] | None = None,
        tool_context: ToolContext | None = None,
    ) -> dict[str, Any]:
        """List requests, optionally using ServiceDesk list_info pagination, sorting, and filters."""
        return self._annotate_request_result(
            self._call_sdp("/requests", list_info=list_info)
        )

    @connector_tool
    def delete_request(
        self, request_id: str, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Delete a request by its internal ID or displayed request number."""
        item_id, error = self._resolve_request_id(request_id)
        if error:
            return error
        return self._call_sdp(f"/requests/{item_id}", "DELETE")

    @connector_tool
    def create_change(
        self, change: dict[str, Any], tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Create a change. The change object must include title."""
        if not str(change.get("title", "")).strip():
            return {"status": "error", "code": 400, "message": "title is required."}
        return self._call_sdp("/changes", "POST", {"change": change})

    @connector_tool
    def update_change(
        self,
        change_id: str,
        change: dict[str, Any],
        tool_context: ToolContext | None = None,
    ) -> dict[str, Any]:
        """Update a change using its internal numeric ID and a change fields object."""
        try:
            item_id = self._id(change_id, "change_id")
        except ValueError as exc:
            return {"status": "error", "code": 400, "message": str(exc)}
        return self._call_sdp(f"/changes/{item_id}", "PUT", {"change": change})

    @connector_tool
    def get_change(
        self, change_id: str, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Get one change by its internal numeric ID, not its display ID."""
        try:
            item_id = self._id(change_id, "change_id")
        except ValueError as exc:
            return {"status": "error", "code": 400, "message": str(exc)}
        return self._call_sdp(f"/changes/{item_id}")

    @connector_tool
    def list_changes(
        self,
        list_info: dict[str, Any] | None = None,
        tool_context: ToolContext | None = None,
    ) -> dict[str, Any]:
        """List changes, optionally using ServiceDesk list_info pagination, sorting, and filters."""
        return self._call_sdp("/changes", list_info=list_info)

    @connector_tool
    def delete_change(
        self, change_id: str, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Delete a change by its internal numeric ID."""
        try:
            item_id = self._id(change_id, "change_id")
        except ValueError as exc:
            return {"status": "error", "code": 400, "message": str(exc)}
        return self._call_sdp(f"/changes/{item_id}", "DELETE")

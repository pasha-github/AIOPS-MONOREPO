"""
Outlook Connector v0.0.1
Connector for replying to Outlook emails through Microsoft Graph.
Supports app-only authentication using tenant ID, client ID, client secret,
and a preconfigured mailbox user.
"""

from typing import Any

try:
    from base_connector import BaseConnector, connector_tool
except ModuleNotFoundError:
    from src.connectors.base_connector import BaseConnector, connector_tool
from google.adk.tools.tool_context import ToolContext


class OutlookConnector(BaseConnector):
    """
    Connector for Outlook email reply workflows through Microsoft Graph.

    This connector uses Microsoft Graph client-credentials authentication and
    exposes a focused email reply capability for a configured mailbox.
    """

    def __init__(
        self,
        TENANT_ID: str,
        CLIENT_ID: str,
        CLIENT_SECRET: str,
        MAILBOX_USER: str,
        prefix: str = "",
    ):
        super().__init__(prefix=prefix)
        self.tenant_id = TENANT_ID
        self.client_id = CLIENT_ID
        self.client_secret = CLIENT_SECRET
        self.mailbox_user = MAILBOX_USER.strip()
        self.graph_base_url = "https://graph.microsoft.com/v1.0"
        self.token_url = (
            f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
        )

    def _get_access_token(self) -> dict[str, Any]:
        """Fetch an application token for Microsoft Graph."""
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
                "message": "Authentication failed. Check TENANT_ID, CLIENT_ID, and CLIENT_SECRET.",
            }

        if response.status_code >= 400:
            return {
                "status": "error",
                "code": response.status_code,
                "message": response.text,
            }

        try:
            payload = response.json()
        except ValueError:
            return {
                "status": "error",
                "code": response.status_code,
                "message": "Token endpoint returned a non-JSON response.",
            }

        access_token = payload.get("access_token")
        if not access_token:
            return {
                "status": "error",
                "code": response.status_code,
                "message": "Token endpoint did not return an access token.",
            }

        return {"status": "success", "access_token": access_token}

    def _make_graph_request(
        self,
        endpoint: str,
        method: str = "GET",
        data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Call Microsoft Graph with centralized auth and error handling."""
        auth_result = self._get_access_token()
        if auth_result["status"] != "success":
            return auth_result

        response = self.call_api(
            url=f"{self.graph_base_url}{endpoint}",
            method=method,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": f"Bearer {auth_result['access_token']}",
            },
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
                "message": (
                    "Forbidden. The app registration likely lacks the required "
                    "Microsoft Graph permissions or mailbox access."
                ),
            }

        if response.status_code == 404:
            return {
                "status": "error",
                "code": 404,
                "message": "The specified mailbox user or message was not found.",
            }

        if response.status_code >= 400:
            return {
                "status": "error",
                "code": response.status_code,
                "message": response.text,
            }

        if response.status_code in {202, 204}:
            return {"status": "success", "data": None}

        try:
            return {"status": "success", "data": response.json()}
        except ValueError:
            return {"status": "success", "data": response.text}

    @connector_tool
    def reply_to_email(
        self,
        message_id: str,
        comment: str,
        tool_context: ToolContext | None = None,
    ) -> dict[str, Any]:
        """Reply to an existing Outlook email in the configured mailbox.

        Use this tool when the user wants to reply to a known Microsoft Graph
        message ID from the configured mailbox.

        Args:
            message_id: The Microsoft Graph message ID to reply to.
            comment: The reply body to send in the existing email thread.
        """
        normalized_message_id = message_id.strip()
        normalized_comment = comment.strip()

        if not self.mailbox_user or not normalized_message_id or not normalized_comment:
            return {
                "status": "error",
                "code": 400,
                "message": "MAILBOX_USER, message_id, and comment are required.",
            }

        result = self._make_graph_request(
            endpoint=f"/users/{self.mailbox_user}/messages/{normalized_message_id}/reply",
            method="POST",
            data={"comment": normalized_comment},
        )

        if result["status"] != "success":
            return result

        return {
            "status": "success",
            "mailbox_user": self.mailbox_user,
            "message_id": normalized_message_id,
            "message": "Reply sent successfully.",
        }

"""
Microsoft Entra Connector v0.0.1
Connector for Microsoft Entra ID password reset workflows via Microsoft Graph.
Supports app-only authentication using tenant ID, client ID, and client secret.
"""

import secrets
import string
from typing import Any

from base_connector import BaseConnector, connector_tool
from google.adk.tools.tool_context import ToolContext


class MicrosoftEntraConnector(BaseConnector):
    """
    Connector for Microsoft Entra ID password reset workflows.

    This connector uses Microsoft Graph client-credentials authentication and
    currently exposes a focused password reset capability.
    """

    def __init__(
        self,
        TENANT_ID: str,
        CLIENT_ID: str,
        CLIENT_SECRET: str,
        prefix: str = "",
    ):
        super().__init__(prefix=prefix)
        self.tenant_id = TENANT_ID
        self.client_id = CLIENT_ID
        self.client_secret = CLIENT_SECRET
        self.graph_base_url = "https://graph.microsoft.com/v1.0"
        self.token_url = (
            f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
        )

    def _generate_password(self, length: int = 12) -> str:
        """Generate a password with mixed character classes."""
        if length < 8:
            raise ValueError("Password length must be at least 8 characters.")

        digits = string.digits
        lowercase = string.ascii_lowercase
        uppercase = string.ascii_uppercase
        symbols = "@#$%=:?./|~>*()<_-+!"
        all_chars = digits + lowercase + uppercase + symbols

        password_chars = [
            secrets.choice(digits),
            secrets.choice(lowercase),
            secrets.choice(uppercase),
            secrets.choice(symbols),
        ]
        password_chars.extend(secrets.choice(all_chars) for _ in range(length - 4))
        secrets.SystemRandom().shuffle(password_chars)
        return "".join(password_chars)

    def _set_user_account_enabled(
        self,
        user_id: str,
        enabled: bool,
    ) -> dict[str, Any]:
        """Enable or disable a Microsoft Entra ID user account."""
        normalized_user_id = user_id.strip()
        if not normalized_user_id:
            return {
                "status": "error",
                "code": 400,
                "message": "user_id is required.",
            }

        result = self._make_graph_request(
            endpoint=f"/users/{normalized_user_id}",
            method="PATCH",
            data={"accountEnabled": enabled},
        )

        if result["status"] != "success":
            return result

        action = "enabled" if enabled else "disabled"
        return {
            "status": "success",
            "user_id": normalized_user_id,
            "account_enabled": enabled,
            "message": f"User account {action} successfully.",
        }

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
                    "Microsoft Graph permissions or admin consent."
                ),
            }

        if response.status_code == 404:
            return {
                "status": "error",
                "code": 404,
                "message": "The specified user was not found in Microsoft Entra ID.",
            }

        if response.status_code >= 400:
            return {
                "status": "error",
                "code": response.status_code,
                "message": response.text,
            }

        if response.status_code == 204:
            return {"status": "success", "data": None}

        try:
            return {"status": "success", "data": response.json()}
        except ValueError:
            return {"status": "success", "data": response.text}

    @connector_tool
    def reset_user_password(
        self,
        user_id: str,
        password: str = "",
        require_change_on_next_sign_in: bool = True,
        generate_password: bool = False,
        password_length: int = 12,
        tool_context: ToolContext | None = None,
    ) -> dict[str, Any]:
        """Reset a Microsoft Entra ID user's password through Microsoft Graph.

        Use this tool when the user wants to reset an Entra ID password for a
        known user object ID or UPN. It supports either a caller-provided password
        or a generated password, and can require a password change at next sign-in.

        Args:
            user_id: The Microsoft Entra user object ID or user principal name.
            password: The explicit password to set. Leave empty when generate_password is true.
            require_change_on_next_sign_in: Whether the user must change the password at next sign-in.
            generate_password: Generate a secure password instead of providing one manually.
            password_length: Length of generated password when generate_password is true.
        """
        if generate_password:
            password_to_set = self._generate_password(password_length)
        else:
            password_to_set = password.strip()

        if not password_to_set:
            return {
                "status": "error",
                "code": 400,
                "message": "Provide a password or set generate_password=true.",
            }

        result = self._make_graph_request(
            endpoint=f"/users/{user_id}",
            method="PATCH",
            data={
                "passwordProfile": {
                    "password": password_to_set,
                    "forceChangePasswordNextSignIn": require_change_on_next_sign_in,
                }
            },
        )

        if result["status"] != "success":
            return result

        payload = {
            "status": "success",
            "user_id": user_id,
            "password_reset_required": require_change_on_next_sign_in,
            "message": "Password reset completed successfully.",
        }
        if generate_password:
            payload["generated_password"] = password_to_set
        return payload

    @connector_tool
    def enable_user(
        self,
        user_id: str,
        tool_context: ToolContext | None = None,
    ) -> dict[str, Any]:
        """Enable a Microsoft Entra ID user account.

        Use this tool when the user wants to re-enable sign-in for a known Entra
        user object ID or UPN. This sets `accountEnabled` to `true` through
        Microsoft Graph.

        Args:
            user_id: The Microsoft Entra user object ID or user principal name.
        """
        return self._set_user_account_enabled(user_id=user_id, enabled=True)

    @connector_tool
    def disable_user(
        self,
        user_id: str,
        tool_context: ToolContext | None = None,
    ) -> dict[str, Any]:
        """Disable a Microsoft Entra ID user account.

        Use this tool when the user wants to block sign-in for a known Entra
        user object ID or UPN. This sets `accountEnabled` to `false` through
        Microsoft Graph.

        Args:
            user_id: The Microsoft Entra user object ID or user principal name.
        """
        return self._set_user_account_enabled(user_id=user_id, enabled=False)

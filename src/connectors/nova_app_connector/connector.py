"""
Nova App Connector v1.0.0
-------------------------
Connector for fetching logs and triggering remediation actions in Nova App.
"""

from typing import Any

from base_connector import BaseConnector, connector_tool
from google.adk.tools.tool_context import ToolContext


class NovaAppConnector(BaseConnector):
    """Connector for Nova App operational logs and remediation actions."""

    DEFAULT_BASE_URL = "https://nova-app-428716175586.us-central1.run.app"
    ALLOWED_ACTIONS = frozenset(
        {
        "RESTART_REDIS",
        "SCALE_DB_REPLICAS",
        "RESET_PAYMENT_GATEWAY",
        }
    )

    def __init__(self, BASE_URL: str = DEFAULT_BASE_URL, prefix: str = ""):
        super().__init__(prefix=prefix)
        self.base_url = (BASE_URL or self.DEFAULT_BASE_URL).rstrip("/")

    @connector_tool
    def get_nova_logs(self, tool_context: ToolContext) -> dict[str, Any]:
        """Fetches operational logs from Nova App."""
        response = self.call_api(
            url=f"{self.base_url}/api/logs",
            method="GET",
            headers={"Content-Type": "application/json"},
        )

        if response.status_code != 200:
            return {
                "status": "error",
                "code": response.status_code,
                "message": response.text,
            }

        try:
            return {"status": "success", "data": response.json()}
        except ValueError:
            return {"status": "success", "data": response.text}

    @connector_tool
    def remediate(self, action: str, tool_context: ToolContext) -> dict[str, Any]:
        """Triggers remediation in Nova App. Allowed actions: RESTART_REDIS, SCALE_DB_REPLICAS, RESET_PAYMENT_GATEWAY."""
        if action not in self.ALLOWED_ACTIONS:
            return {
                "status": "error",
                "code": 400,
                "message": "Invalid action. Allowed actions: RESTART_REDIS, SCALE_DB_REPLICAS, RESET_PAYMENT_GATEWAY.",
            }

        response = self.call_api(
            url=f"{self.base_url}/api/admin/remediate",
            method="POST",
            headers={"Content-Type": "application/json"},
            json={"action": action},
        )

        if response.status_code != 200:
            return {
                "status": "error",
                "code": response.status_code,
                "message": response.text,
            }

        try:
            return {"status": "success", "data": response.json()}
        except ValueError:
            return {"status": "success", "data": response.text}

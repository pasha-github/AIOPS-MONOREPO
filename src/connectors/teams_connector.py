"""
Teams Connector v0.0.1
Connector for the local Teams bot proactive alert APIs.
"""

from collections.abc import Mapping
from typing import Any, cast

try:
    from src.connectors.base_connector import BaseConnector, connector_tool
except ModuleNotFoundError:
    from base_connector import BaseConnector, connector_tool
from google.adk.tools.tool_context import ToolContext


class TeamsConnector(BaseConnector):
    """
    Connector for the Teams bot proactive alert APIs.

    Tools are only exposed when their route target is preconfigured:
    - `send_alert_by_email` requires `EMAILS`
    - `send_alert_by_conversation` requires `CONVERSATION_IDS`
    """

    def __init__(
        self,
        TEAMS_BOT_BASE_URL: str,
        ALERT_API_KEY: str,
        EMAILS: str = "",
        CONVERSATION_IDS: str = "",
        prefix: str = "",
    ):
        self.base_url = TEAMS_BOT_BASE_URL.strip().rstrip("/")
        self.alert_api_key = ALERT_API_KEY.strip()
        self.emails = self._parse_targets(EMAILS)
        self.conversation_ids = self._parse_targets(CONVERSATION_IDS)

        super().__init__(prefix=prefix)

        enabled_tool_names = set()
        if self.emails:
            enabled_tool_names.add(f"{self.prefix}send_alert_by_email")
        if self.conversation_ids:
            enabled_tool_names.add(f"{self.prefix}send_alert_by_conversation")

        self._tools = [tool for tool in self._tools if tool.name in enabled_tool_names]

    def _parse_targets(self, *raw_values: str) -> list[str]:
        """Parse comma or newline separated config values into a unique target list."""
        seen: set[str] = set()
        targets: list[str] = []

        for raw_value in raw_values:
            for part in (raw_value or "").replace("\r", "\n").split("\n"):
                for item in part.split(","):
                    target = item.strip()
                    if target and target not in seen:
                        seen.add(target)
                        targets.append(target)

        return targets

    def _post_alert(
        self, endpoint: str, payload: Mapping[str, str | list[str]]
    ) -> dict[str, Any]:
        """Send an authenticated alert request to the Teams bot API."""
        if not self.alert_api_key:
            return {
                "status": "error",
                "message": "ALERT_API_KEY is required for the Teams connector.",
            }

        response = self.call_api(
            url=f"{self.base_url}{endpoint}",
            method="POST",
            headers={
                "Content-Type": "application/json",
                "x-alert-key": self.alert_api_key,
            },
            json=cast(dict[str, str], dict(payload)),
        )

        if response.status_code >= 400:
            return {
                "status": "error",
                "code": response.status_code,
                "message": response.text,
            }

        try:
            data: Any = response.json()
        except ValueError:
            data = response.text

        return {"status": "success", "data": data}

    @connector_tool
    def send_alert_by_email(
        self, content: str, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Send a proactive Teams alert to preconfigured email target(s).

        This tool is only exposed when `EMAILS` is configured on the connector.

        Args:
            content: The alert message body to send to Teams.
        """
        if not self.emails:
            return {
                "status": "error",
                "message": "EMAILS is not configured for this Teams connector.",
            }

        return self._post_alert(
            "/api/alerts/by-email",
            payload={"emails": self.emails, "message": content},
        )

    @connector_tool
    def send_alert_by_conversation(
        self, content: str, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Send a proactive Teams alert to preconfigured conversation target(s).

        This tool is only exposed when `CONVERSATION_IDS` is configured on the connector.

        Args:
            content: The alert message body to send to Teams.
        """
        if not self.conversation_ids:
            return {
                "status": "error",
                "message": "CONVERSATION_IDS is not configured for this Teams connector.",
            }

        results = []
        for conversation_id in self.conversation_ids:
            results.append(
                self._post_alert(
                    "/api/alerts",
                    payload={"conversation_id": conversation_id, "message": content},
                )
            )

        failures = [result for result in results if result.get("status") != "success"]
        if failures:
            return {
                "status": "error",
                "requested_count": len(self.conversation_ids),
                "success_count": len(results) - len(failures),
                "failure_count": len(failures),
                "results": results,
            }

        return {
            "status": "success",
            "requested_count": len(self.conversation_ids),
            "results": results,
        }

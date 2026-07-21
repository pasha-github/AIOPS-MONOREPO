"""
IBM App Connect Enterprise (ACE) Connector v1.0.0
--------------------------------------------------
Manages IBM ACE servers and applications via the ACE REST API.
"""

from typing import Any

import requests
from base_connector import BaseConnector, connector_tool
from google.adk.tools.tool_context import ToolContext


class IbmAceConnector(BaseConnector):
    """
    Pre-built connector for IBM App Connect Enterprise (ACE).

    Tools exposed:
        list_servers        — list all integration servers
        start_server        — start a specific integration server
        stop_server         — stop a specific integration server
        list_applications   — list applications on a server
        start_application   — start a specific application on a server
        stop_application    — stop a specific application on a server
        get_server_logs     — retrieve recent log entries from a server
    """

    def __init__(
        self,
        IBM_ACE_BASE_URL: str,
        prefix: str = "",
    ):

        super().__init__(prefix=prefix)
        self.base_url = IBM_ACE_BASE_URL.rstrip("/")

    def _make_request(
        self, path: str, method: str = "GET", params: dict | None = None
    ) -> requests.Response:
        url = f"{self.base_url}{path}"
        return requests.request(
            method,
            url,
            headers={"Content-Type": "application/json"},
            params=params,
            verify=False,  # ACE typically uses self-signed certs
            timeout=60,
        )

    @connector_tool
    def list_servers(self, tool_context: ToolContext) -> dict[str, Any]:
        """Lists all IBM ACE integration servers with their name and state."""
        try:
            response = self._make_request("/datav2/servers")
            response.raise_for_status()
            children = response.json().get("children", [])
            servers = [
                {
                    "name": s.get("name"),
                    "state": s.get("active", {}).get("state", "unknown"),
                }
                for s in children
            ]
            return {"status": "success", "servers": servers, "count": len(servers)}
        except Exception as exc:
            return {"status": "error", "message": str(exc)}

    @connector_tool
    def start_server(self, server: str, tool_context: ToolContext) -> dict[str, Any]:
        """Starts a specific IBM ACE integration server.

        Args:
            server: The name of the integration server to start.
        """
        try:
            response = self._make_request(
                f"/apiv2/servers/{server}/start", method="POST"
            )
            return {"status": "success", "server": server, "code": response.status_code}
        except Exception as exc:
            return {"status": "error", "message": str(exc)}

    @connector_tool
    def list_applications(
        self, server: str, tool_context: ToolContext
    ) -> dict[str, Any]:
        """Lists all applications on a specific IBM ACE server with their name and state.

        Args:
            server: The name of the integration server.
        """
        try:
            response = self._make_request(
                f"/apiv2/servers/{server}/applications", params={"depth": "2"}
            )
            response.raise_for_status()
            children = response.json().get("children", [])
            apps = [
                {
                    "name": a.get("name"),
                    "state": a.get("active", {}).get("state", "unknown"),
                }
                for a in children
            ]
            return {
                "status": "success",
                "server": server,
                "applications": apps,
                "count": len(apps),
            }
        except Exception as exc:
            return {"status": "error", "message": str(exc)}

    @connector_tool
    def start_application(
        self, server: str, application: str, tool_context: ToolContext
    ) -> dict[str, Any]:
        """Starts a specific application on an IBM ACE integration server.

        Args:
            server:      The name of the integration server.
            application: The name of the application to start.
        """
        try:
            response = self._make_request(
                f"/apiv2/servers/{server}/applications/{application}/start",
                method="POST",
            )
            return {
                "status": "success",
                "server": server,
                "application": application,
                "code": response.status_code,
            }
        except Exception as exc:
            return {"status": "error", "message": str(exc)}

    @connector_tool
    def stop_server(self, server: str, tool_context: ToolContext) -> dict[str, Any]:
        """Stops a specific IBM ACE integration server.

        Args:
            server: The name of the integration server to stop.
        """
        try:
            response = self._make_request(
                f"/apiv2/servers/{server}/stop", method="POST"
            )
            return {"status": "success", "server": server, "code": response.status_code}
        except Exception as exc:
            return {"status": "error", "message": str(exc)}

    @connector_tool
    def stop_application(
        self, server: str, application: str, tool_context: ToolContext
    ) -> dict[str, Any]:
        """Stops a specific application on an IBM ACE integration server.

        Args:
            server:      The name of the integration server.
            application: The name of the application to stop.
        """
        try:
            response = self._make_request(
                f"/apiv2/servers/{server}/applications/{application}/stop",
                method="POST",
            )
            return {
                "status": "success",
                "server": server,
                "application": application,
                "code": response.status_code,
            }
        except Exception as exc:
            return {"status": "error", "message": str(exc)}

    @connector_tool
    def get_server_logs(self, server: str, tool_context: ToolContext) -> dict[str, Any]:
        """Retrieves the last 20 log entries from a specific IBM ACE integration server.

        Args:
            server: The name of the integration server.
        """
        try:
            response = self._make_request(f"/apiv2/servers/{server}/logs")
            response.raise_for_status()
            logs = response.json().get("logs", [])
            return {"status": "success", "server": server, "logs": logs[-20:]}
        except Exception as exc:
            return {"status": "error", "message": str(exc)}

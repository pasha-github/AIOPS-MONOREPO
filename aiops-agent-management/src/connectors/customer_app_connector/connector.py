"""
Customer App Connector v0.0.1
-----------------------------
Manage customer app lifecycle with start, stop, and status operations.
"""

from typing import Any

from base_connector import BaseConnector, connector_tool
from google.adk.tools.tool_context import ToolContext


class CustomerAppConnector(BaseConnector):
    """
    Pre-built connector for customer app lifecycle control.
    """

    BASE_URL = "https://customer-app-428716175586.us-central1.run.app"

    def __init__(self, prefix: str = ""):
        super().__init__(prefix=prefix)

    @connector_tool
    def start_customer_app(self, tool_context: ToolContext) -> dict[str, Any]:
        """Starts the customer app."""
        response = self.call_api(url=f"{self.BASE_URL}/api/start", method="POST")
        if response.status_code != 200:
            return {
                "status": "error",
                "code": response.status_code,
                "message": response.text,
            }
        return {"status": "success", "result": response.json()}

    @connector_tool
    def stop_customer_app(self, tool_context: ToolContext) -> dict[str, Any]:
        """Stops the customer app."""
        response = self.call_api(url=f"{self.BASE_URL}/api/stop", method="POST")
        if response.status_code != 200:
            return {
                "status": "error",
                "code": response.status_code,
                "message": response.text,
            }
        return {"status": "success", "result": response.json()}

    @connector_tool
    def get_customer_app_status(self, tool_context: ToolContext) -> dict[str, Any]:
        """Checks current status of the customer app."""
        response = self.call_api(url=f"{self.BASE_URL}/api/status", method="GET")
        if response.status_code != 200:
            return {
                "status": "error",
                "code": response.status_code,
                "message": response.text,
            }
        return {"status": "success", "result": response.json()}

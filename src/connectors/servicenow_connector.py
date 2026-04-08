"""
ServiceNow Connector v0.0.1
---------------------
Provides a connector for interacting with the ServiceNow API.
Supports Incidents, Change Requests, and the Knowledge Base.
"""

from typing import Any

from base_connector import BaseConnector, connector_tool
from google.adk.tools.tool_context import ToolContext


class ServiceNowConnector(BaseConnector):
    """
    Pre-built connector for the ServiceNow API.

    Tools exposed:
        {prefix}list_incidents
        {prefix}create_incident
        {prefix}update_incident
        {prefix}resolve_incident
        {prefix}list_change_requests
        {prefix}create_change_request
        {prefix}update_change_request
        {prefix}list_knowledge_bases
        {prefix}list_kb_articles
    """

    def __init__(
        self,
        SERVICENOW_INSTANCE_URL: str,
        SERVICENOW_USERNAME: str,
        SERVICENOW_PASSWORD: str,
        SERVICENOW_AUTH_TYPE: str = "basic",
        prefix: str = "",
    ):
        super().__init__(prefix=prefix)
        self.instance_url = SERVICENOW_INSTANCE_URL.rstrip("/")
        self.username = SERVICENOW_USERNAME
        self.password = SERVICENOW_PASSWORD
        self.auth_type = SERVICENOW_AUTH_TYPE

        # Verify valid auth type
        if self.auth_type.lower() != "basic":
            raise ValueError(
                "Currently, only 'basic' authentication is supported for the ServiceNow connector."
            )

    def _make_request(
        self,
        endpoint: str,
        method: str = "GET",
        params: dict[str, Any] | None = None,
        data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Helper method to make API requests and handle common authentication errors."""
        url = f"{self.instance_url}{endpoint}"

        headers = {"Accept": "application/json", "Content-Type": "application/json"}

        response = self.call_api(
            url=url,
            method=method,
            headers=headers,
            params=params,
            json=data,
            basic_auth=(self.username, self.password),
        )

        # Handle Auth token/credential expiration
        if response.status_code == 401:
            return {
                "status": "error",
                "code": 401,
                "message": "Authentication failed. Basic auth credentials may be invalid or expired. Please check SERVICENOW_USERNAME and SERVICENOW_PASSWORD.",
            }

        if response.status_code >= 400:
            return {
                "status": "error",
                "code": response.status_code,
                "message": response.text,
            }

        try:
            return {
                "status": "success",
                "data": response.json().get("result", response.json()),
            }
        except ValueError:
            # Not JSON
            return {"status": "success", "data": response.text}

    # ------------------------------------------------------------------ #
    #  Incidents                                                         #
    # ------------------------------------------------------------------ #

    @connector_tool
    def list_incidents(
        self, query: str = "", limit: int = 10, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Lists incidents from ServiceNow, optionally filtered by a query.

        Args:
            query: An optional ServiceNow encoded query string (e.g., active=true^priority=1).
            limit: The maximum number of incidents to return (default: 10).

        Returns:
            A dict containing the list of incidents.
        """
        params: dict[str, Any] = {"sysparm_limit": limit}
        if query:
            params["sysparm_query"] = query

        return self._make_request(
            "/api/now/table/incident", method="GET", params=params
        )

    @connector_tool
    def create_incident(
        self,
        short_description: str,
        description: str = "",
        caller_id: str = "",
        urgency: str = "3",
        impact: str = "3",
        tool_context: ToolContext | None = None,
    ) -> dict[str, Any]:
        """Creates a new incident in ServiceNow.

        Args:
            short_description: A brief summary of the incident.
            description: A detailed description of the incident.
            caller_id: The `sys_id` or `user_name` of the person reporting the incident.
            urgency: The urgency level (1-High, 2-Medium, 3-Low). Default is 3.
            impact: The impact level (1-High, 2-Medium, 3-Low). Default is 3.

        Returns:
            A dict containing the details of the created incident.
        """
        data = {
            "short_description": short_description,
            "description": description,
            "caller_id": caller_id,
            "urgency": urgency,
            "impact": impact,
        }
        # Remove empty string arguments to rely on SN defaults if not provided
        data = {k: v for k, v in data.items() if v != ""}

        return self._make_request("/api/now/table/incident", method="POST", data=data)

    @connector_tool
    def update_incident(
        self,
        sys_id: str,
        updates: dict[str, Any],
        tool_context: ToolContext | None = None,
    ) -> dict[str, Any]:
        """Updates an existing incident in ServiceNow.

        Args:
            sys_id: The unique system ID of the incident to update.
            updates: A dictionary of fields and values to update (e.g., {"short_description": "New title"}).

        Returns:
            A dict containing the details of the updated incident.
        """
        return self._make_request(
            f"/api/now/table/incident/{sys_id}", method="PATCH", data=updates
        )

    @connector_tool
    def resolve_incident(
        self,
        sys_id: str,
        close_notes: str,
        close_code: str = "Solved (Permanently)",
        tool_context: ToolContext | None = None,
    ) -> dict[str, Any]:
        """Resolves an incident in ServiceNow.

        Args:
            sys_id: The unique system ID of the incident to resolve.
            close_notes: Notes explaining how the incident was resolved.
            close_code: The resolution code (e.g., 'Solved (Work Around)', 'Solved (Permanently)', 'Closed/Resolved by Caller').

        Returns:
            A dict containing the details of the resolved incident.
        """
        # State 6 usually corresponds to 'Resolved' in default ServiceNow instances
        data = {"state": "6", "close_notes": close_notes, "close_code": close_code}
        return self._make_request(
            f"/api/now/table/incident/{sys_id}", method="PATCH", data=data
        )

    # ------------------------------------------------------------------ #
    #  Change Requests                                                   #
    # ------------------------------------------------------------------ #

    @connector_tool
    def list_change_requests(
        self, query: str = "", limit: int = 10, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Lists change requests from ServiceNow, optionally filtered by a query.

        Args:
            query: An optional ServiceNow encoded query string (e.g., active=true^type=normal).
            limit: The maximum number of change requests to return (default: 10).

        Returns:
            A dict containing the list of change requests.
        """
        params: dict[str, Any] = {"sysparm_limit": limit}
        if query:
            params["sysparm_query"] = query

        return self._make_request(
            "/api/now/table/change_request", method="GET", params=params
        )

    @connector_tool
    def create_change_request(
        self,
        short_description: str,
        description: str = "",
        type: str = "normal",
        tool_context: ToolContext | None = None,
    ) -> dict[str, Any]:
        """Creates a new change request in ServiceNow.

        Args:
            short_description: A brief summary of the change request.
            description: A detailed description of the change request.
            type: The type of change ('normal', 'standard', 'emergency'). Default is 'normal'.

        Returns:
            A dict containing the details of the created change request.
        """
        data = {
            "short_description": short_description,
            "description": description,
            "type": type,
        }
        data = {k: v for k, v in data.items() if v != ""}

        return self._make_request(
            "/api/now/table/change_request", method="POST", data=data
        )

    @connector_tool
    def update_change_request(
        self,
        sys_id: str,
        updates: dict[str, Any],
        tool_context: ToolContext | None = None,
    ) -> dict[str, Any]:
        """Updates an existing change request in ServiceNow.

        Args:
            sys_id: The unique system ID of the change request to update.
            updates: A dictionary of fields and values to update (e.g., {"state": "3"}).

        Returns:
            A dict containing the details of the updated change request.
        """
        return self._make_request(
            f"/api/now/table/change_request/{sys_id}", method="PATCH", data=updates
        )

    # ------------------------------------------------------------------ #
    #  Knowledge Base                                                    #
    # ------------------------------------------------------------------ #

    @connector_tool
    def list_knowledge_bases(
        self, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Lists available knowledge bases in ServiceNow.

        Returns:
            A dict containing the list of knowledge bases.
        """
        return self._make_request("/api/now/table/kb_knowledge_base", method="GET")

    @connector_tool
    def list_kb_articles(
        self, query: str = "", limit: int = 10, tool_context: ToolContext | None = None
    ) -> dict[str, Any]:
        """Lists knowledge base articles from ServiceNow, optionally filtered by a query.

        Args:
            query: An optional ServiceNow encoded query string (e.g., workflow_state=published).
            limit: The maximum number of knowledge articles to return (default: 10).

        Returns:
            A dict containing the list of knowledge articles.
        """
        params: dict[str, Any] = {"sysparm_limit": limit}
        if query:
            params["sysparm_query"] = query

        return self._make_request(
            "/api/now/table/kb_knowledge", method="GET", params=params
        )

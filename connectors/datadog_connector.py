"""
Datadog Connector v0.0.1
Connector for the Datadog Log Management API.
Enables querying and filtering logs from Datadog, supporting
service-level filtering via a standardized TR1-app service tag convention.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime, timezone, timedelta
from google.adk.tools.tool_context import ToolContext
from base_connector import BaseConnector, connector_tool


class DatadogConnector(BaseConnector):
    """
    Connector for the Datadog Log Management API.
    Enables querying and filtering logs from Datadog, supporting
    service-level filtering via a standardized TR1-app service tag convention.
    """

    def __init__(
        self,
        DD_API_KEY: str,
        DD_APP_KEY: str,
        DD_SITE: str = "datadoghq.com",
        prefix: str = "",
    ):
        # SUPER INIT MUST BE CALLED
        super().__init__(prefix=prefix)
        self.api_key = DD_API_KEY
        self.app_key = DD_APP_KEY
        self.base_url = f"https://api.{DD_SITE}"

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _make_request(
        self,
        endpoint: str,
        method: str = "GET",
        params: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Centralised request helper with auth and error handling."""
        url = f"{self.base_url}{endpoint}"
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "DD-API-KEY": self.api_key,
            "DD-APPLICATION-KEY": self.app_key,
        }

        response = self.call_api(
            url=url,
            method=method,
            headers=headers,
            params=params,
            data=data,
        )

        if response.status_code == 401:
            return {
                "status": "error",
                "code": 401,
                "message": "Authentication failed. Check your DD_API_KEY and DD_APP_KEY.",
            }
        elif response.status_code == 403:
            return {
                "status": "error",
                "code": 403,
                "message": "Forbidden. The provided keys may lack the required permissions.",
            }
        elif response.status_code >= 400:
            return {
                "status": "error",
                "code": response.status_code,
                "message": response.text,
            }

        try:
            return {"status": "success", "data": response.json()}
        except ValueError:
            return {"status": "success", "data": response.text}

    def _build_query(
        self,
        app_name: Optional[str],
        log_level: Optional[str],
        extra_query: Optional[str],
    ) -> str:
        """
        Builds a Datadog log search query string.

        The app_name is applied using the canonical TR1-app service tag:
            service:<app_name>

        Additional filters (log_level, free-text) are ANDed together.
        """
        parts: List[str] = []

        # Service tag following TR1-app convention
        if app_name:
            parts.append(f"service:{app_name}")

        # Status / log level filter
        if log_level:
            parts.append(f"status:{log_level.lower()}")

        # Any free-text / advanced Datadog query syntax supplied by the caller
        if extra_query:
            parts.append(f"({extra_query})")

        return " ".join(parts) if parts else "*"

    # ------------------------------------------------------------------
    # Public connector tool
    # ------------------------------------------------------------------

    @connector_tool
    def fetch_logs(
        self,
        app_name: Optional[str] = None,
        log_level: Optional[str] = None,
        extra_query: Optional[str] = None,
        from_minutes_ago: int = 15,
        to_minutes_ago: int = 0,
        limit: int = 50,
        sort: str = "-timestamp",
        tool_context: Optional[ToolContext] = None,
    ) -> Dict[str, Any]:
        """Fetches logs from Datadog with optional filters for app, log level, and custom query.

        Use this tool whenever the user wants to retrieve, search, or inspect application logs
        stored in Datadog. Supports filtering by application name, log severity level, time range, and arbitrary Datadog query syntax.

        Args:
            app_name: Name of the application. Translated to the Datadog service tag
                      'service:<app_name>'. Leave empty to query all services.
            log_level: Severity filter. Accepted values: debug, info, warn, error, critical.
                       Leave empty to return all levels.
            extra_query: Any additional Datadog log query string (e.g. '@http.status_code:500').
                         Appended with AND to the other filters.
            from_minutes_ago: Start of the time window expressed as minutes before now (default 15).
            to_minutes_ago: End of the time window expressed as minutes before now (default 0 = now).
            limit: Maximum number of log entries to return (1-1000, default 50).
            sort: Sort order for results. Use '-timestamp' for newest-first (default)
                  or 'timestamp' for oldest-first.
        """
        now = datetime.now(timezone.utc)
        time_from = (now - timedelta(minutes=from_minutes_ago)).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )
        time_to = (now - timedelta(minutes=to_minutes_ago)).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )

        query = self._build_query(app_name, log_level, extra_query)

        payload = {
            "filter": {
                "query": query,
                "from": time_from,
                "to": time_to,
            },
            "sort": sort,
            "page": {
                "limit": max(1, min(limit, 1000)),  # Clamp to Datadog's accepted range
            },
        }

        result = self._make_request(
            endpoint="/api/v2/logs/events/search",
            method="POST",
            data=payload,
        )

        if result["status"] != "success":
            return result

        raw = result["data"]
        log_events = raw.get("data", [])

        # Flatten each log entry for easier LLM consumption
        simplified_logs = []
        for event in log_events:
            attrs = event.get("attributes", {})
            simplified_logs.append(
                {
                    "id": event.get("id"),
                    "timestamp": attrs.get("timestamp"),
                    "status": attrs.get("status"),
                    "service": attrs.get("service"),
                    "host": attrs.get("host"),
                    "message": attrs.get("message"),
                    "tags": attrs.get("tags", []),
                    "attributes": attrs.get("attributes", {}),
                }
            )

        return {
            "status": "success",
            "query": query,
            "time_range": {"from": time_from, "to": time_to},
            "count": len(simplified_logs),
            "logs": simplified_logs,
            "meta": raw.get("meta", {}),
        }
"""
Time Connector v1.0.0
---------------------
Returns current local time for a configured timezone, with optional per-call override.
"""

from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from base_connector import BaseConnector, connector_tool
from google.adk.tools.tool_context import ToolContext


class TimeConnector(BaseConnector):
    """Pre-built connector for timezone-aware current time lookups."""

    def __init__(self, TIMEZONE: str = "UTC"):
        super().__init__()
        self.default_timezone = self._validate_timezone(TIMEZONE or "UTC")

    def _validate_timezone(self, timezone: str) -> str:
        tz = (timezone or "UTC").strip()
        try:
            ZoneInfo(tz)
        except ZoneInfoNotFoundError as exc:
            raise ValueError(f"Invalid timezone '{tz}'. Use an IANA timezone like 'UTC' or 'Asia/Karachi'.") from exc
        return tz

    @connector_tool
    def get_current_time(
        self,
        tool_context: ToolContext,
        timezone: str | None = None,
    ) -> dict[str, str]:
        """Returns the current time in the requested timezone.

        Args:
            timezone: Optional IANA timezone override (for example, 'America/New_York').

        Returns:
            A dict with timezone and ISO local datetime.
        """
        try:
            resolved_timezone = self._validate_timezone(
                timezone if timezone else self.default_timezone
            )
        except ValueError as exc:
            return {
                "status": "error",
                "message": str(exc),
            }

        now = datetime.now(ZoneInfo(resolved_timezone))
        return {
            "status": "success",
            "timezone": resolved_timezone,
            "local_time": now.isoformat(),
        }

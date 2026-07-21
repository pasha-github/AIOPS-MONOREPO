from typing import Any

from base_connector import BaseConnector, connector_tool
from google.adk.tools.tool_context import ToolContext


class DatabaseConnector(BaseConnector):
    """Read-only SQL database connector powered by SQLAlchemy."""

    MAX_ROWS = 500

    def __init__(self, DATABASE_URL: str, prefix: str = ""):
        super().__init__(prefix=prefix)
        from sqlalchemy import create_engine

        self.engine = create_engine(DATABASE_URL)

    @connector_tool
    def run_query(self, query: str, tool_context: ToolContext) -> dict[str, Any]:
        """Executes a read-only SELECT query and returns the results as a list of rows.

        Args:
            query: A valid SQL SELECT statement to execute.
        """
        query = query.strip().rstrip(";").strip()
        first_token = query.split()[0].upper() if query else ""
        if first_token != "SELECT":
            return {"status": "error", "message": "Only SELECT queries are allowed."}
        if ";" in query:
            return {
                "status": "error",
                "message": "Multiple statements are not allowed.",
            }
        try:
            from sqlalchemy import text

            with self.engine.connect() as conn:
                result = conn.execute(text(query))
                columns = list(result.keys())
                rows = [
                    dict(zip(columns, row, strict=True))
                    for row in result.fetchmany(self.MAX_ROWS)
                ]
            return {
                "status": "success",
                "columns": columns,
                "rows": rows,
                "count": len(rows),
            }
        except Exception as exc:
            return {"status": "error", "message": str(exc)}

    @connector_tool
    def get_schema(self, tool_context: ToolContext) -> dict[str, Any]:
        """Returns the full database schema: all tables with their column names and types."""
        try:
            from sqlalchemy import inspect

            inspector = inspect(self.engine)
            schema = {}
            for table in inspector.get_table_names():
                schema[table] = [
                    {"name": col["name"], "type": str(col["type"])}
                    for col in inspector.get_columns(table)
                ]
            return {"status": "success", "tables": schema, "table_count": len(schema)}
        except Exception as exc:
            return {"status": "error", "message": str(exc)}

# Database Connector

Read-only SQL connector powered by SQLAlchemy. Supports PostgreSQL, MySQL, SQLite, MSSQL, and any SQLAlchemy-compatible database.

## Configuration

| Variable | Required | Description |
|---|---|---|
| DATABASE_URL | Yes | SQLAlchemy connection string (e.g. `postgresql://user:pass@host:5432/db`) |

## Tools

| Tool | Description |
|---|---|
| run_query | Executes a SELECT query and returns rows (max 500) |
| get_schema | Returns all table names with their column names and types |

## Security

- Only SELECT statements are allowed — INSERT, UPDATE, DELETE, DROP are blocked
- Queries containing semicolons are rejected to prevent statement stacking
- Results are capped at 500 rows per query

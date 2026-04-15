import base64
from typing import Any
from urllib.parse import urlparse

from google.adk.tools.mcp_tool import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import (
    SseConnectionParams,
    StreamableHTTPConnectionParams,
)

SUPPORTED_MCP_AUTH_TYPES = {"none", "bearer", "basic"}


def normalize_mcp_auth_type(auth_type: str | None) -> str:
    normalized = (auth_type or "none").strip().lower()
    if normalized not in SUPPORTED_MCP_AUTH_TYPES:
        raise ValueError("auth_type must be one of: none, bearer, basic")
    return normalized


def build_mcp_auth_headers(
    auth_type: str | None,
    *,
    bearer_token: str | None = None,
    username: str | None = None,
    password: str | None = None,
) -> dict[str, str]:
    normalized = normalize_mcp_auth_type(auth_type)
    if normalized == "none":
        return {}
    if normalized == "bearer":
        if not bearer_token:
            raise ValueError("bearer auth requires a token")
        return {"Authorization": f"Bearer {bearer_token}"}
    if not username or password is None:
        raise ValueError("basic auth requires username and password")
    encoded = base64.b64encode(f"{username}:{password}".encode()).decode("utf-8")
    return {"Authorization": f"Basic {encoded}"}


def build_mcp_connection_params(
    url: str,
    headers: dict[str, str] | None = None,
) -> SseConnectionParams | StreamableHTTPConnectionParams:
    cleaned_url = url.strip()
    shared_kwargs = {"url": cleaned_url, "headers": headers or None}
    if cleaned_url.endswith("/sse"):
        return SseConnectionParams(**shared_kwargs)
    if cleaned_url.endswith("/mcp"):
        return StreamableHTTPConnectionParams(**shared_kwargs)
    raise ValueError("MCP server URL must end with /sse or /mcp")


def derive_mcp_display_name(url: str, metadata: dict[str, Any] | None = None) -> str:
    metadata = metadata or {}
    for key in ("name", "server_name", "title"):
        value = metadata.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    parsed = urlparse(url)
    if parsed.netloc:
        path = parsed.path.rstrip("/")
        suffix = path.split("/")[-1] if path else ""
        return f"{parsed.netloc}{f'/{suffix}' if suffix else ''}"
    return url


def serialize_mcp_tool(tool: Any) -> dict[str, Any]:
    raw_tool = getattr(tool, "_mcp_tool", None)
    input_schema = getattr(raw_tool, "inputSchema", None)
    if input_schema is None:
        input_schema = getattr(raw_tool, "input_schema", None)

    return {
        "name": getattr(tool, "name", ""),
        "description": getattr(tool, "description", "") or "",
        "input_schema": input_schema,
    }


async def inspect_mcp_server(
    url: str,
    *,
    auth_type: str | None = None,
    bearer_token: str | None = None,
    username: str | None = None,
    password: str | None = None,
) -> dict[str, Any]:
    headers = build_mcp_auth_headers(
        auth_type,
        bearer_token=bearer_token,
        username=username,
        password=password,
    )
    connection_params = build_mcp_connection_params(url, headers=headers)
    toolset = McpToolset(connection_params=connection_params)

    try:
        tools = await toolset.get_tools()
        tool_specs = [serialize_mcp_tool(tool) for tool in tools]

        resource_names: list[str] = []
        resources: list[dict[str, Any]] = []
        try:
            resource_names = await toolset.list_resources()
        except Exception:
            resource_names = []

        for name in resource_names:
            try:
                resources.append(await toolset.get_resource_info(name))
            except Exception:
                resources.append({"name": name})

        metadata = {
            "name": derive_mcp_display_name(url),
            "transport": "sse" if url.strip().endswith("/sse") else "streamable_http",
            "tool_count": len(tool_specs),
            "resource_count": len(resources),
        }
        return {
            "url": url.strip(),
            "auth_type": normalize_mcp_auth_type(auth_type),
            "metadata": metadata,
            "tools": tool_specs,
            "resources": resources,
        }
    finally:
        await toolset.close()

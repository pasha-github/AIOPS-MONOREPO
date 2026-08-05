"""
Unit tests for src/utils/mcp.py — auth headers, connection params, display name,
tool serialization.

Focuses on edge cases and security-sensitive logic that is not covered by the
higher-level MCP endpoint tests.
"""

import base64

import pytest

# ---------------------------------------------------------------------------
# normalize_mcp_auth_type
# ---------------------------------------------------------------------------


def test_normalize_mcp_auth_type_none_input():
    from src.utils.mcp import normalize_mcp_auth_type

    assert normalize_mcp_auth_type(None) == "none"


def test_normalize_mcp_auth_type_empty_string():
    from src.utils.mcp import normalize_mcp_auth_type

    assert normalize_mcp_auth_type("") == "none"


def test_normalize_mcp_auth_type_case_insensitive():
    from src.utils.mcp import normalize_mcp_auth_type

    assert normalize_mcp_auth_type("Bearer") == "bearer"
    assert normalize_mcp_auth_type("BASIC") == "basic"
    assert normalize_mcp_auth_type("NONE") == "none"


def test_normalize_mcp_auth_type_strips_whitespace():
    from src.utils.mcp import normalize_mcp_auth_type

    assert normalize_mcp_auth_type("  bearer  ") == "bearer"


def test_normalize_mcp_auth_type_invalid_raises():
    from src.utils.mcp import normalize_mcp_auth_type

    with pytest.raises(ValueError, match="auth_type must be one of"):
        normalize_mcp_auth_type("oauth2")


# ---------------------------------------------------------------------------
# build_mcp_auth_headers — none
# ---------------------------------------------------------------------------


def test_build_mcp_auth_headers_none_returns_empty():
    from src.utils.mcp import build_mcp_auth_headers

    assert build_mcp_auth_headers("none") == {}
    assert build_mcp_auth_headers(None) == {}


# ---------------------------------------------------------------------------
# build_mcp_auth_headers — bearer
# ---------------------------------------------------------------------------


def test_build_mcp_auth_headers_bearer_valid():
    from src.utils.mcp import build_mcp_auth_headers

    headers = build_mcp_auth_headers("bearer", bearer_token="mytoken")
    assert headers == {"Authorization": "Bearer mytoken"}


def test_build_mcp_auth_headers_bearer_no_token_raises():
    from src.utils.mcp import build_mcp_auth_headers

    with pytest.raises(ValueError, match="bearer auth requires a token"):
        build_mcp_auth_headers("bearer", bearer_token=None)


def test_build_mcp_auth_headers_bearer_empty_string_raises():
    from src.utils.mcp import build_mcp_auth_headers

    with pytest.raises(ValueError, match="bearer auth requires a token"):
        build_mcp_auth_headers("bearer", bearer_token="")


def test_build_mcp_auth_headers_bearer_whitespace_only_token_raises():
    """
    Regression: bearer_token='   ' passes `if not bearer_token` check because
    '   ' is truthy — creates an invalid 'Authorization: Bearer    ' header.
    The function must strip and validate the token.
    """
    from src.utils.mcp import build_mcp_auth_headers

    with pytest.raises(ValueError, match="bearer auth requires a token"):
        build_mcp_auth_headers("bearer", bearer_token="   ")


# ---------------------------------------------------------------------------
# build_mcp_auth_headers — basic
# ---------------------------------------------------------------------------


def test_build_mcp_auth_headers_basic_valid():
    from src.utils.mcp import build_mcp_auth_headers

    headers = build_mcp_auth_headers("basic", username="user", password="pass")
    expected = base64.b64encode(b"user:pass").decode()
    assert headers == {"Authorization": f"Basic {expected}"}


def test_build_mcp_auth_headers_basic_empty_password_allowed():
    """Empty password is valid for basic auth — some servers use username-only."""
    from src.utils.mcp import build_mcp_auth_headers

    headers = build_mcp_auth_headers("basic", username="user", password="")
    expected = base64.b64encode(b"user:").decode()
    assert headers == {"Authorization": f"Basic {expected}"}


def test_build_mcp_auth_headers_basic_no_username_raises():
    from src.utils.mcp import build_mcp_auth_headers

    with pytest.raises(ValueError, match="basic auth requires username and password"):
        build_mcp_auth_headers("basic", username=None, password="pass")


def test_build_mcp_auth_headers_basic_empty_username_raises():
    from src.utils.mcp import build_mcp_auth_headers

    with pytest.raises(ValueError, match="basic auth requires username and password"):
        build_mcp_auth_headers("basic", username="", password="pass")


def test_build_mcp_auth_headers_basic_none_password_raises():
    from src.utils.mcp import build_mcp_auth_headers

    with pytest.raises(ValueError, match="basic auth requires username and password"):
        build_mcp_auth_headers("basic", username="user", password=None)


def test_build_mcp_auth_headers_basic_colon_in_username():
    """
    Username containing ':' creates ambiguous Basic auth encoding.
    Verify the header is at least created (behavior documented).
    """
    from src.utils.mcp import build_mcp_auth_headers

    headers = build_mcp_auth_headers("basic", username="user:name", password="pass")
    assert "Authorization" in headers
    assert headers["Authorization"].startswith("Basic ")


# ---------------------------------------------------------------------------
# build_mcp_connection_params
# ---------------------------------------------------------------------------


def test_build_mcp_connection_params_sse_url():
    from google.adk.tools.mcp_tool.mcp_session_manager import SseConnectionParams

    from src.utils.mcp import build_mcp_connection_params

    result = build_mcp_connection_params("http://localhost:8100/sse")
    assert isinstance(result, SseConnectionParams)


def test_build_mcp_connection_params_mcp_url():
    from google.adk.tools.mcp_tool.mcp_session_manager import (
        StreamableHTTPConnectionParams,
    )

    from src.utils.mcp import build_mcp_connection_params

    result = build_mcp_connection_params("http://localhost:8100/mcp")
    assert isinstance(result, StreamableHTTPConnectionParams)


def test_build_mcp_connection_params_strips_whitespace():
    from google.adk.tools.mcp_tool.mcp_session_manager import SseConnectionParams

    from src.utils.mcp import build_mcp_connection_params

    result = build_mcp_connection_params("  http://localhost:8100/sse  ")
    assert isinstance(result, SseConnectionParams)


def test_build_mcp_connection_params_invalid_suffix_raises():
    from src.utils.mcp import build_mcp_connection_params

    with pytest.raises(ValueError, match="must end with /sse or /mcp"):
        build_mcp_connection_params("http://localhost:8100/events")


def test_build_mcp_connection_params_case_sensitive_sse():
    """
    Regression: endswith('/sse') is case-sensitive — '/SSE' raises ValueError
    instead of creating an SSE connection. Documents this known limitation.
    """
    from src.utils.mcp import build_mcp_connection_params

    with pytest.raises(ValueError):
        build_mcp_connection_params("http://localhost:8100/SSE")


def test_build_mcp_connection_params_case_sensitive_mcp():
    """Same case-sensitivity issue for /MCP."""
    from src.utils.mcp import build_mcp_connection_params

    with pytest.raises(ValueError):
        build_mcp_connection_params("http://localhost:8100/MCP")


def test_build_mcp_connection_params_passes_headers():
    from src.utils.mcp import build_mcp_connection_params

    headers = {"Authorization": "Bearer tok"}
    result = build_mcp_connection_params("http://localhost/sse", headers=headers)
    assert result.headers == headers


def test_build_mcp_connection_params_no_headers_passes_none():
    from src.utils.mcp import build_mcp_connection_params

    result = build_mcp_connection_params("http://localhost/sse")
    assert result.headers is None


# ---------------------------------------------------------------------------
# derive_mcp_display_name
# ---------------------------------------------------------------------------


def test_derive_mcp_display_name_prefers_name_key():
    from src.utils.mcp import derive_mcp_display_name

    result = derive_mcp_display_name(
        "http://localhost/sse", metadata={"name": "My Server", "title": "Other"}
    )
    assert result == "My Server"


def test_derive_mcp_display_name_falls_back_to_server_name():
    from src.utils.mcp import derive_mcp_display_name

    result = derive_mcp_display_name(
        "http://localhost/sse", metadata={"server_name": "Fallback Name"}
    )
    assert result == "Fallback Name"


def test_derive_mcp_display_name_falls_back_to_title():
    from src.utils.mcp import derive_mcp_display_name

    result = derive_mcp_display_name(
        "http://localhost/sse", metadata={"title": "Title Name"}
    )
    assert result == "Title Name"


def test_derive_mcp_display_name_skips_empty_metadata_values():
    from src.utils.mcp import derive_mcp_display_name

    result = derive_mcp_display_name(
        "http://myserver.com/sse", metadata={"name": "   ", "title": ""}
    )
    assert "myserver.com" in result


def test_derive_mcp_display_name_skips_non_string_metadata():
    """Non-string metadata values must be ignored, falling back to URL."""
    from src.utils.mcp import derive_mcp_display_name

    result = derive_mcp_display_name(
        "http://myserver.com/sse", metadata={"name": 123, "title": None}
    )
    assert "myserver.com" in result


def test_derive_mcp_display_name_uses_netloc_when_no_metadata():
    from src.utils.mcp import derive_mcp_display_name

    result = derive_mcp_display_name("http://myserver.com/sse")
    assert "myserver.com" in result


def test_derive_mcp_display_name_no_metadata_none():
    from src.utils.mcp import derive_mcp_display_name

    result = derive_mcp_display_name("http://myserver.com/sse", metadata=None)
    assert "myserver.com" in result


def test_derive_mcp_display_name_relative_url_returns_url():
    """Relative URLs have no netloc — should fall back to returning the URL itself."""
    from src.utils.mcp import derive_mcp_display_name

    result = derive_mcp_display_name("/path/to/sse")
    assert result == "/path/to/sse"


# ---------------------------------------------------------------------------
# serialize_mcp_tool
# ---------------------------------------------------------------------------


def test_serialize_mcp_tool_returns_expected_keys():
    from types import SimpleNamespace

    from src.utils.mcp import serialize_mcp_tool

    raw = SimpleNamespace(inputSchema={"type": "object"})
    tool = SimpleNamespace(name="ping", description="Ping tool", _mcp_tool=raw)

    result = serialize_mcp_tool(tool)
    assert result["name"] == "ping"
    assert result["description"] == "Ping tool"
    assert result["input_schema"] == {"type": "object"}


def test_serialize_mcp_tool_missing_name_defaults_empty():
    from types import SimpleNamespace

    from src.utils.mcp import serialize_mcp_tool

    tool = SimpleNamespace(description="desc", _mcp_tool=None)
    result = serialize_mcp_tool(tool)
    assert result["name"] == ""


def test_serialize_mcp_tool_none_description_coerced_to_empty():
    from types import SimpleNamespace

    from src.utils.mcp import serialize_mcp_tool

    raw = SimpleNamespace(inputSchema=None)
    tool = SimpleNamespace(name="tool", description=None, _mcp_tool=raw)
    result = serialize_mcp_tool(tool)
    assert result["description"] == ""


def test_serialize_mcp_tool_falls_back_to_input_schema_attr():
    """Falls back to raw_tool.input_schema when inputSchema is missing."""
    from types import SimpleNamespace

    from src.utils.mcp import serialize_mcp_tool

    raw = SimpleNamespace(input_schema={"type": "string"})
    tool = SimpleNamespace(name="t", description="d", _mcp_tool=raw)
    result = serialize_mcp_tool(tool)
    assert result["input_schema"] == {"type": "string"}


def test_serialize_mcp_tool_no_mcp_tool_attr():
    from types import SimpleNamespace

    from src.utils.mcp import serialize_mcp_tool

    tool = SimpleNamespace(name="t", description="d")
    result = serialize_mcp_tool(tool)
    assert result["input_schema"] is None

import sys
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from src.connectors.loader import cached_connector_info, resolve_connector_tools
from src.connectors.teams_connector import TeamsConnector
from src.database.models import ConnectorConfig


def test_list_connectors_success(client: TestClient):
    response = client.get("/connectors/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    ids = {item["id"] for item in data}
    # Based on current repository connector files
    assert "datadog_connector" in ids
    assert "ibm_mq_connector" in ids
    assert "servicenow_connector" in ids
    assert "teams_connector" in ids


def test_list_connectors_excludes_reserved_files(client: TestClient):
    response = client.get("/connectors/")
    assert response.status_code == 200
    ids = {item["id"] for item in response.json()}
    assert "__init__" not in ids
    assert "base_connector" not in ids
    assert "example_connector" not in ids


def test_get_connector_details_success(client: TestClient):
    list_response = client.get("/connectors/")
    assert list_response.status_code == 200
    connectors = list_response.json()
    assert len(connectors) > 0

    connector_id = connectors[0]["id"]
    response = client.get(f"/connectors/{connector_id}")
    assert response.status_code == 200
    data = response.json()
    assert "documentation" in data
    assert "tools" in data
    assert "config_variables" in data
    assert isinstance(data["tools"], list)
    assert isinstance(data["config_variables"], list)


def test_get_connector_details_not_found_404(client: TestClient):
    response = client.get("/connectors/does_not_exist")
    assert response.status_code == 404
    assert response.json()["detail"] == "Connector not found"


def test_get_connector_details_reserved_name_404(client: TestClient):
    response = client.get("/connectors/__init__")
    assert response.status_code == 404
    assert response.json()["detail"] == "Connector not found"

    response = client.get("/connectors/base_connector")
    assert response.status_code == 404
    assert response.json()["detail"] == "Connector not found"


def test_get_connector_config_list_empty(client: TestClient):
    response = client.get("/connectors/example_connector/config")
    assert response.status_code == 200
    assert response.json() == []


def test_create_connector_config_success(client: TestClient):
    payload = {
        "connector_id": "example_connector",
        "name": "Example Config",
        "config": [{"name": "base_url", "value": "https://example.com"}],
    }
    response = client.post("/connectors/example_connector/config", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Example Config"
    assert data["connector_id"] == "example_connector"
    assert len(data["config"]) == 1


def test_get_connector_config_list_after_create(client: TestClient):
    payload = {
        "connector_id": "example_connector",
        "name": "Config One",
        "config": [{"name": "token", "value": "abc"}],
    }
    create_response = client.post("/connectors/example_connector/config", json=payload)
    assert create_response.status_code == 200

    response = client.get("/connectors/example_connector/config")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Config One"
    assert data[0]["connector_id"] == "example_connector"


def test_get_connector_config_list_after_multiple_create(client: TestClient):
    payload1 = {
        "connector_id": "example_connector",
        "name": "Config One",
        "config": [{"name": "token", "value": "abc"}],
    }
    payload2 = {
        "connector_id": "example_connector",
        "name": "Config Two",
        "config": [{"name": "token", "value": "xyz"}],
    }
    r1 = client.post("/connectors/example_connector/config", json=payload1)
    r2 = client.post("/connectors/example_connector/config", json=payload2)
    assert r1.status_code == 200
    assert r2.status_code == 200

    response = client.get("/connectors/example_connector/config")
    assert response.status_code == 200
    data = response.json()
    names = {item["name"] for item in data}
    assert len(data) == 2
    assert names == {"Config One", "Config Two"}


def test_create_connector_config_path_body_mismatch_returns_400(client: TestClient):
    payload = {
        "connector_id": "servicenow_connector",
        "name": "Mismatch Config",
        "config": [{"name": "x", "value": "1"}],
    }
    response = client.post("/connectors/example_connector/config", json=payload)
    assert response.status_code == 400
    assert response.json()["detail"] == "connector_id in URL and body must match"


def test_create_connector_config_missing_required_field_422(client: TestClient):
    response = client.post(
        "/connectors/example_connector/config",
        json={
            "connector_id": "example_connector",
            # missing required "name"
            "config": [{"name": "x", "value": "1"}],
        },
    )
    assert response.status_code == 422


def test_patch_connector_config_name_only(client: TestClient):
    payload = {
        "connector_id": "example_connector",
        "name": "Original Config",
        "config": [{"name": "token", "value": "abc"}],
    }
    create_response = client.post("/connectors/example_connector/config", json=payload)
    assert create_response.status_code == 200

    connector_config_id = create_response.json()["connector_config_id"]
    response = client.patch(
        f"/connectors/example_connector/config/{connector_config_id}",
        json={"name": "Updated Config"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Config"
    assert data["config"] == payload["config"]


def test_patch_connector_config_config_only(client: TestClient):
    payload = {
        "connector_id": "example_connector",
        "name": "Config",
        "config": [{"name": "token", "value": "abc"}],
    }
    create_response = client.post("/connectors/example_connector/config", json=payload)
    assert create_response.status_code == 200

    connector_config_id = create_response.json()["connector_config_id"]
    updated_config = [{"name": "token", "value": "xyz"}]
    response = client.patch(
        f"/connectors/example_connector/config/{connector_config_id}",
        json={"config": updated_config},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == payload["name"]
    assert data["config"] == updated_config


def test_patch_connector_config_not_found_returns_404(client: TestClient):
    response = client.patch(
        f"/connectors/example_connector/config/{uuid4()}",
        json={"name": "Missing Config"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Connector config not found"


def test_patch_connector_config_wrong_connector_returns_404(client: TestClient):
    payload = {
        "connector_id": "example_connector",
        "name": "Original Config",
        "config": [{"name": "token", "value": "abc"}],
    }
    create_response = client.post("/connectors/example_connector/config", json=payload)
    assert create_response.status_code == 200

    connector_config_id = create_response.json()["connector_config_id"]
    response = client.patch(
        f"/connectors/servicenow_connector/config/{connector_config_id}",
        json={"name": "Updated Config"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Connector config not found"


def test_delete_connector_config_success(client: TestClient):
    payload = {
        "connector_id": "example_connector",
        "name": "Config To Delete",
        "config": [{"name": "token", "value": "abc"}],
    }
    create_response = client.post("/connectors/example_connector/config", json=payload)
    assert create_response.status_code == 200

    connector_config_id = create_response.json()["connector_config_id"]
    delete_response = client.delete(
        f"/connectors/example_connector/config/{connector_config_id}"
    )
    assert delete_response.status_code == 200
    assert delete_response.json() == {"success": True}

    list_response = client.get("/connectors/example_connector/config")
    assert list_response.status_code == 200
    assert list_response.json() == []


def test_delete_connector_config_not_found_returns_404(client: TestClient):
    response = client.delete(f"/connectors/example_connector/config/{uuid4()}")
    assert response.status_code == 404
    assert response.json()["detail"] == "Connector config not found"


def test_delete_connector_config_in_use_returns_409(client: TestClient):
    model_response = client.post(
        "/llms/",
        json={
            "model_id": "gemini-pro",
            "provider": "google",
            "name": "gemini-1.5-pro",
            "api_key": "test-key",
            "description": "model",
        },
    )
    assert model_response.status_code == 200

    payload = {
        "connector_id": "example_connector",
        "name": "Config In Use",
        "config": [{"name": "token", "value": "abc"}],
    }
    create_response = client.post("/connectors/example_connector/config", json=payload)
    assert create_response.status_code == 200

    connector_config_id = create_response.json()["connector_config_id"]
    agent_response = client.post(
        "/agent/",
        json={
            "agent_id": "a1",
            "name": "Agent 1",
            "description": "desc",
            "instruction": "instr",
            "model_id": "gemini-pro",
            "connector_config_ids": [connector_config_id],
        },
    )
    assert agent_response.status_code == 200

    response = client.delete(
        f"/connectors/example_connector/config/{connector_config_id}"
    )
    assert response.status_code == 409
    assert response.json()["detail"] == "Connector config is in use by agent: Agent 1"

    list_response = client.get("/connectors/example_connector/config")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


def test_delete_connector_config_wrong_connector_returns_404(client: TestClient):
    payload = {
        "connector_id": "example_connector",
        "name": "Config To Delete",
        "config": [{"name": "token", "value": "abc"}],
    }
    create_response = client.post("/connectors/example_connector/config", json=payload)
    assert create_response.status_code == 200

    connector_config_id = create_response.json()["connector_config_id"]
    response = client.delete(
        f"/connectors/servicenow_connector/config/{connector_config_id}"
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Connector config not found"


def test_cached_connector_info_extracts_expected_sections():
    source = '''
"""Demo connector documentation."""

from base_connector import BaseConnector
from base_connector import connector_tool

class DemoConnector(BaseConnector):
    def __init__(self, API_KEY, BASE_URL="https://example.com"):
        self.API_KEY = API_KEY
        self.BASE_URL = BASE_URL

    @connector_tool
    def ping(self):
        """Ping endpoint.

        Args:
            x: ignored
        Returns:
            bool
        """
        return True

    def helper(self):
        """Not a tool."""
        return "x"
'''
    info = cached_connector_info(source, 123.0)
    assert info["documentation"] == "Demo connector documentation."
    assert isinstance(info["tools"], list)
    assert isinstance(info["config_variables"], list)
    assert len(info["tools"]) == 1
    assert info["tools"][0]["name"] == "ping"
    # Args/Returns should be trimmed from docs
    assert "Args" not in info["tools"][0]["documentation"]
    assert "Returns" not in info["tools"][0]["documentation"]
    assert {"name": "API_KEY", "required": True} in info["config_variables"]
    assert {"name": "BASE_URL", "required": False} in info["config_variables"]


def test_ibm_mq_connector_details_include_expected_tools(client: TestClient):
    response = client.get("/connectors/ibm_mq_connector")
    assert response.status_code == 200

    data = response.json()
    tool_names = {tool["name"] for tool in data["tools"]}
    config_vars = {item["name"]: item["required"] for item in data["config_variables"]}

    assert {"dspmq", "runmqsc", "get_mq_logs", "run_commands_ssh"} <= tool_names
    assert config_vars["URL_BASE"] is True
    assert config_vars["USER_NAME"] is True
    assert config_vars["PASSWORD"] is True
    assert config_vars["LOGS_URL"] is True
    assert config_vars["SSH_URL"] is True
    assert config_vars["VERIFY_TLS"] is False


def test_resolve_connector_tools_missing_file_raises():
    cfg = ConnectorConfig(
        name="bad",
        connector_id="does_not_exist_connector",
        config=[],
    )
    with pytest.raises(FileNotFoundError):
        resolve_connector_tools(cfg)


def test_resolve_connector_tools_success(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
):
    connector_source = '''
from base_connector import BaseConnector, connector_tool

class TempConnector(BaseConnector):
    def __init__(self, token):
        self.token = token

    @connector_tool
    def ping(self):
        """Ping."""
        return "pong"

    def get_tools(self):
        return [self.ping]
'''
    base_source = """
def connector_tool(func):
    return func

class BaseConnector:
    pass
"""

    temp_connectors = tmp_path / "src" / "connectors"
    temp_connectors.mkdir(parents=True, exist_ok=True)
    (temp_connectors / "base_connector.py").write_text(base_source, encoding="utf-8")
    (temp_connectors / "temp_connector.py").write_text(
        connector_source, encoding="utf-8"
    )

    monkeypatch.setattr("src.connectors.loader.CONNECTORS_DIR", temp_connectors)

    cfg = ConnectorConfig(
        name="ok",
        connector_id="temp_connector",
        config=[{"name": "token", "value": "abc"}],
    )
    try:
        tools = resolve_connector_tools(cfg)
        assert isinstance(tools, list)
        assert len(tools) == 1
    finally:
        sys.modules.pop("base_connector", None)


def test_resolve_connector_tools_no_baseconnector_subclass_raises(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
):
    connector_source = """
class NotConnector:
    def __init__(self):
        pass
"""
    base_source = """
def connector_tool(func):
    return func

class BaseConnector:
    pass
"""
    temp_connectors = tmp_path / "connectors"
    temp_connectors.mkdir(parents=True, exist_ok=True)
    (temp_connectors / "base_connector.py").write_text(base_source, encoding="utf-8")
    (temp_connectors / "bad_connector.py").write_text(
        connector_source, encoding="utf-8"
    )

    monkeypatch.setattr("src.connectors.loader.CONNECTORS_DIR", temp_connectors)

    cfg = ConnectorConfig(
        name="bad",
        connector_id="bad_connector",
        config=[],
    )
    try:
        with pytest.raises(ValueError):
            resolve_connector_tools(cfg)
    finally:
        sys.modules.pop("base_connector", None)


def test_teams_connector_exposes_no_tools_without_targets():
    connector = TeamsConnector(
        TEAMS_BOT_BASE_URL="http://localhost:3978",
        ALERT_API_KEY="secret",
    )

    assert connector.tool_names == []
    assert connector.get_tools() == []


def test_teams_connector_exposes_email_tool_only_when_email_configured():
    connector = TeamsConnector(
        TEAMS_BOT_BASE_URL="http://localhost:3978",
        ALERT_API_KEY="secret",
        EMAILS="user@example.com, other@example.com",
    )

    assert connector.tool_names == ["send_alert_by_email"]


def test_teams_connector_exposes_conversation_tool_only_when_conversation_configured():
    connector = TeamsConnector(
        TEAMS_BOT_BASE_URL="http://localhost:3978",
        ALERT_API_KEY="secret",
        CONVERSATION_IDS="19:test@thread.tacv2,19:other@thread.tacv2",
    )

    assert connector.tool_names == ["send_alert_by_conversation"]


def test_teams_connector_sends_email_alert_with_preconfigured_target(
    monkeypatch: pytest.MonkeyPatch,
):
    connector = TeamsConnector(
        TEAMS_BOT_BASE_URL="http://localhost:3978/",
        ALERT_API_KEY="secret",
        EMAILS="user@example.com,other@example.com",
    )

    class _Response:
        status_code = 200
        text = "ok"

        @staticmethod
        def json():
            return {"status": "ok", "message_sent": True}

    captured: dict[str, object] = {}

    def fake_call_api(**kwargs):
        captured.update(kwargs)
        return _Response()

    monkeypatch.setattr(connector, "call_api", fake_call_api)

    result = connector.send_alert_by_email("CPU is above 90%")

    assert result["status"] == "success"
    assert captured["url"] == "http://localhost:3978/api/alerts/by-email"
    assert captured["method"] == "POST"
    assert captured["headers"] == {
        "Content-Type": "application/json",
        "x-alert-key": "secret",
    }
    assert captured["json"] == {
        "emails": ["user@example.com", "other@example.com"],
        "message": "CPU is above 90%",
    }


def test_teams_connector_sends_conversation_alert_with_preconfigured_target(
    monkeypatch: pytest.MonkeyPatch,
):
    connector = TeamsConnector(
        TEAMS_BOT_BASE_URL="http://localhost:3978",
        ALERT_API_KEY="secret",
        CONVERSATION_IDS="19:test@thread.tacv2\n19:other@thread.tacv2",
    )

    class _Response:
        status_code = 200
        text = "ok"

        @staticmethod
        def json():
            return {"status": "ok", "sent_count": 1}

    captured_calls: list[dict[str, object]] = []

    def fake_call_api(**kwargs):
        captured_calls.append(kwargs)
        return _Response()

    monkeypatch.setattr(connector, "call_api", fake_call_api)

    result = connector.send_alert_by_conversation("Queue backlog detected")

    assert result["status"] == "success"
    assert result["requested_count"] == 2
    assert len(captured_calls) == 2
    assert captured_calls[0]["url"] == "http://localhost:3978/api/alerts"
    assert captured_calls[0]["method"] == "POST"
    assert captured_calls[0]["json"] == {
        "conversation_id": "19:test@thread.tacv2",
        "message": "Queue backlog detected",
    }
    assert captured_calls[1]["json"] == {
        "conversation_id": "19:other@thread.tacv2",
        "message": "Queue backlog detected",
    }


def test_resolve_connector_tools_teams_connector_filters_tools_by_config():
    cfg = ConnectorConfig(
        name="teams-email",
        connector_id="teams_connector",
        config=[
            {"name": "TEAMS_BOT_BASE_URL", "value": "http://localhost:3978"},
            {"name": "ALERT_API_KEY", "value": "secret"},
            {"name": "EMAILS", "value": "user@example.com,other@example.com"},
        ],
    )

    tools = resolve_connector_tools(cfg)

    assert len(tools) == 1
    assert tools[0].name == "send_alert_by_email"

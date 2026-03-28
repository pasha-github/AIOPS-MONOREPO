from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from database.models import ConnectorConfig
from utils.helper import cached_connector_info, resolve_connector_tools


def test_list_connectors_success(client: TestClient):
    response = client.get("/connectors/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    ids = {item["id"] for item in data}
    # Based on current repository connector files
    assert "datadog_connector" in ids
    assert "servicenow_connector" in ids


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

    temp_connectors = tmp_path / "connectors"
    temp_connectors.mkdir(parents=True, exist_ok=True)
    (temp_connectors / "base_connector.py").write_text(base_source, encoding="utf-8")
    (temp_connectors / "temp_connector.py").write_text(
        connector_source, encoding="utf-8"
    )

    monkeypatch.setattr("utils.helper.CONNECTORS_DIR", temp_connectors)

    cfg = ConnectorConfig(
        name="ok",
        connector_id="temp_connector",
        config=[{"name": "token", "value": "abc"}],
    )
    tools = resolve_connector_tools(cfg)
    assert isinstance(tools, list)
    assert len(tools) == 1


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

    monkeypatch.setattr("utils.helper.CONNECTORS_DIR", temp_connectors)

    cfg = ConnectorConfig(
        name="bad",
        connector_id="bad_connector",
        config=[],
    )
    with pytest.raises(ValueError):
        resolve_connector_tools(cfg)

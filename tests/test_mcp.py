from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from src.database.models import Agent, MCPServer, Model


@pytest.fixture
def fake_probe(monkeypatch: pytest.MonkeyPatch):
    async def _fake_probe(*args, **kwargs):
        url = args[0]
        return {
            "url": url,
            "auth_type": kwargs.get("auth_type", "none"),
            "metadata": {
                "name": "Demo MCP",
                "transport": "sse",
                "tool_count": 1,
                "resource_count": 1,
            },
            "tools": [
                {
                    "name": "list_tickets",
                    "description": "Lists tickets",
                    "input_schema": {"type": "object"},
                }
            ],
            "resources": [{"name": "tickets://open"}],
        }

    monkeypatch.setattr("src.routers.mcp.inspect_mcp_server", _fake_probe)


def test_test_mcp_server_returns_live_metadata(client: TestClient, fake_probe: None):
    response = client.post(
        "/mcp/test/",
        json={
            "server_url": "http://localhost:8100/sse",
            "auth_type": "bearer",
            "auth_secret": "secret",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["url"] == "http://localhost:8100/sse"
    assert data["metadata"]["tool_count"] == 1
    assert data["tools"][0]["name"] == "list_tickets"


def test_create_and_list_mcp_servers(client: TestClient, fake_probe: None):
    create_response = client.post(
        "/mcp/",
        json={
            "name": "Support MCP",
            "server_url": "http://localhost:8100/sse",
            "auth_type": "basic",
            "auth_username": "alice",
            "auth_secret": "wonderland",
            "description": "Support tools",
        },
    )
    assert create_response.status_code == 200
    data = create_response.json()
    assert data["name"] == "Support MCP"
    assert data["auth_type"] == "basic"
    assert data["auth_username"] == "alice"
    assert data["has_auth_secret"] is True
    assert data["tools"][0]["name"] == "list_tickets"

    list_response = client.get("/mcp/")
    assert list_response.status_code == 200
    listed = list_response.json()
    assert len(listed) == 1
    assert listed[0]["mcp_server_id"] == data["mcp_server_id"]


def test_get_mcp_server_not_found(client: TestClient):
    response = client.get(f"/mcp/{uuid4()}")
    assert response.status_code == 404
    assert response.json()["detail"] == "MCP server not found"


def test_patch_mcp_server_refreshes_metadata(client: TestClient, fake_probe: None):
    create_response = client.post(
        "/mcp/",
        json={
            "name": "Support MCP",
            "server_url": "http://localhost:8100/sse",
            "auth_type": "none",
        },
    )
    mcp_server_id = create_response.json()["mcp_server_id"]

    update_response = client.patch(
        f"/mcp/{mcp_server_id}",
        json={
            "server_url": "http://localhost:9100/mcp",
            "auth_type": "bearer",
            "auth_secret": "new-secret",
            "name": "Updated MCP",
        },
    )

    assert update_response.status_code == 200
    data = update_response.json()
    assert data["name"] == "Updated MCP"
    assert data["server_url"] == "http://localhost:9100/mcp"
    assert data["auth_type"] == "bearer"


def test_delete_mcp_server_success(client: TestClient, fake_probe: None):
    create_response = client.post(
        "/mcp/",
        json={
            "name": "Delete MCP",
            "server_url": "http://localhost:8100/sse",
            "auth_type": "none",
        },
    )
    mcp_server_id = create_response.json()["mcp_server_id"]

    delete_response = client.delete(f"/mcp/{mcp_server_id}")
    assert delete_response.status_code == 200
    assert delete_response.json() == {"success": True}


def test_delete_mcp_server_in_use_returns_409(
    client: TestClient, session, fake_probe: None
):
    session.add(
        Model(
            model_id="m1",
            provider="google",
            name="gemini-1.5-flash",
            api_key="encrypted-or-plain",
            description="shared model",
        )
    )
    mcp_server = MCPServer(
        name="Used MCP",
        server_url="http://localhost:8100/sse",
        auth_type="none",
        metadata_json={},
        tools_json=[],
        resources_json=[],
    )
    session.add(mcp_server)
    session.commit()
    session.refresh(mcp_server)

    session.add(
        Agent(
            agent_id="agent-using-mcp",
            name="Agent Using MCP",
            description="desc",
            instruction="instr",
            primary_use_global=False,
            primary_model_id="m1",
            mcp_server_ids=[str(mcp_server.mcp_server_id)],
        )
    )
    session.commit()

    response = client.delete(f"/mcp/{mcp_server.mcp_server_id}")
    assert response.status_code == 409
    assert response.json()["detail"] == "MCP server is in use by agent: Agent Using MCP"


def test_delete_mcp_server_in_use_by_skill_returns_409(
    client: TestClient, session, fake_probe: None
):
    mcp_server = MCPServer(
        name="Used by Skill MCP",
        server_url="http://localhost:8200/sse",
        auth_type="none",
        metadata_json={},
        tools_json=[{"name": "list_tickets"}],
        resources_json=[],
    )
    session.add(mcp_server)
    session.commit()
    session.refresh(mcp_server)

    client.post(
        "/skill/",
        json={
            "name": "mcp_skill_link",
            "description": "desc",
            "instructions": "instr",
            "mcp_server_ids": [str(mcp_server.mcp_server_id)],
        },
    )

    response = client.delete(f"/mcp/{mcp_server.mcp_server_id}")
    assert response.status_code == 409
    assert response.json()["detail"] == "MCP server is in use by skill: mcp_skill_link"

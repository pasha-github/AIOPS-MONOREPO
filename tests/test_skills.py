from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from src.database.models import Agent, ConnectorConfig, MCPServer, Skill


def _create_model(client: TestClient, model_id: str = "gemini-pro"):
    return client.post(
        "/llms/",
        json={
            "model_id": model_id,
            "provider": "google",
            "name": "gemini-1.5-pro",
            "api_key": "test-key",
            "description": "model",
        },
    )


def test_create_skill(client: TestClient):
    response = client.post(
        "/skill/",
        json={
            "name": "hello_skill",
            "description": "A hello skill",
            "instructions": "Say hello",
            "references": {"guide.md": "hello"},
            "assets": {"prompt.txt": "asset"},
            "scripts": {"run.py": "print('hello')"},
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "hello_skill"
    assert data["description"] == "A hello skill"
    assert data["instructions"] == "Say hello"
    assert data["references"] == {"guide.md": "hello"}
    assert data["assets"] == {"prompt.txt": "asset"}
    assert data["scripts"] == {"run.py": "print('hello')"}
    assert data["tools"] == []


def test_create_skill_validates_name(client: TestClient):
    response = client.post(
        "/skill/",
        json={
            "name": "Bad Name",
            "description": "A hello skill",
            "instructions": "Say hello",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Skill name must be kebab-case or snake_case"


def test_create_skill_validates_attached_tool_names(client: TestClient, session):
    connector = ConnectorConfig(
        connector_config_id=uuid4(),
        connector_id="example_connector",
        name="Example Config",
        config=[{"name": "API_KEY", "value": "abc123"}],
    )
    session.add(connector)
    session.commit()

    response = client.post(
        "/skill/",
        json={
            "name": "tool_skill",
            "description": "desc",
            "instructions": "instr",
            "tools": ["does_not_exist"],
            "connector_config_ids": [str(connector.connector_config_id)],
        },
    )

    assert response.status_code == 400
    assert "Unknown skill tools" in response.json()["detail"]


def test_create_skill_with_connector_and_mcp_tools(client: TestClient, session):
    connector = ConnectorConfig(
        connector_config_id=uuid4(),
        connector_id="example_connector",
        name="Example Config",
        config=[{"name": "API_KEY", "value": "abc123"}],
    )
    mcp_server = MCPServer(
        name="Docs MCP",
        server_url="http://localhost:9000/mcp",
        auth_type="none",
        tools_json=[{"name": "search_docs"}],
        resources_json=[],
        metadata_json={},
    )
    session.add(connector)
    session.add(mcp_server)
    session.commit()
    session.refresh(mcp_server)

    response = client.post(
        "/skill/",
        json={
            "name": "tool_skill",
            "description": "desc",
            "instructions": "instr",
            "tools": ["get_post", "search_docs"],
            "connector_config_ids": [str(connector.connector_config_id)],
            "mcp_server_ids": [str(mcp_server.mcp_server_id)],
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["tools"] == ["get_post", "search_docs"]


def test_list_and_get_skills(client: TestClient):
    create_response = client.post(
        "/skill/",
        json={
            "name": "lookup_skill",
            "description": "A lookup skill",
            "instructions": "Look things up",
        },
    )
    skill_id = create_response.json()["skill_id"]

    list_response = client.get("/skill/")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    get_response = client.get(f"/skill/{skill_id}")
    assert get_response.status_code == 200
    assert get_response.json()["name"] == "lookup_skill"


def test_update_skill_invalidates_attached_agents(
    client: TestClient, session, monkeypatch: pytest.MonkeyPatch
):
    _create_model(client)
    skill = Skill(
        name="update_skill",
        description="desc",
        instructions="instr",
    )
    session.add(skill)
    session.commit()
    session.refresh(skill)

    session.add(
        Agent(
            agent_id="agent-1",
            name="Agent 1",
            description="desc",
            instruction="instr",
            primary_use_global=False,
            primary_model_id="gemini-pro",
            skill_ids=[str(skill.skill_id)],
        )
    )
    session.commit()

    called = {"value": None}

    def fake_invalidate(agent_id: str):
        called["value"] = agent_id

    monkeypatch.setattr("src.skills.runtime.invalidate_cache", fake_invalidate)

    response = client.patch(
        f"/skill/{skill.skill_id}",
        json={"description": "updated"},
    )

    assert response.status_code == 200
    assert response.json()["description"] == "updated"
    assert called["value"] == "agent-1"


def test_delete_skill_in_use_returns_409(client: TestClient, session):
    _create_model(client)
    skill = Skill(
        name="used_skill",
        description="desc",
        instructions="instr",
    )
    session.add(skill)
    session.commit()
    session.refresh(skill)

    session.add(
        Agent(
            agent_id="agent-1",
            name="Agent 1",
            description="desc",
            instruction="instr",
            primary_use_global=False,
            primary_model_id="gemini-pro",
            skill_ids=[str(skill.skill_id)],
        )
    )
    session.commit()

    response = client.delete(f"/skill/{skill.skill_id}")
    assert response.status_code == 409
    assert response.json()["detail"] == "Skill is in use by one or more agents"


def test_delete_skill_success(client: TestClient):
    create_response = client.post(
        "/skill/",
        json={
            "name": "delete_skill",
            "description": "A delete skill",
            "instructions": "Delete me",
        },
    )
    skill_id = create_response.json()["skill_id"]

    response = client.delete(f"/skill/{skill_id}")
    assert response.status_code == 200
    assert response.json() == {"success": True}

from fastapi.testclient import TestClient
import pytest


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


def _create_agent(client: TestClient, agent_id: str = "a1", model_id: str = "gemini-pro"):
    return client.post(
        "/agent/",
        json={
            "agent_id": agent_id,
            "name": "Agent 1",
            "description": "desc",
            "instruction": "instr",
            "model_id": model_id,
            "isEnabled": True,
            "tools": "def t():\n    return 'x'",
            "mcp_servers": ["http://localhost:8000/sse"],
            "connector_config_ids": ["cfg-1"],
            "sub_agents": ["child-1"],
        },
    )


def test_create_agent(client: TestClient):
    client.post(
        "/llms/",
        json={
            "model_id": "gemini-pro",
            "provider": "google",
            "name": "gemini-1.5-pro",
            "api_key": "test-key",
            "description": "model",
        },
    )

    response = client.post(
        "/agent/",
        json={
            "agent_id": "test-agent",
            "name": "Test Agent",
            "description": "A test agent",
            "instruction": "You are a test agent.",
            "model_id": "gemini-pro",
            "isEnabled": True,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Agent"
    assert data["agent_id"] == "test-agent"


def test_list_agent_templates(client: TestClient):
    response = client.get("/agent/templates")
    assert response.status_code == 200
    data = response.json()
    template_ids = {template["template_id"] for template in data}
    assert template_ids == {"mq-agent", "servicenow-agent", "datadog-agent"}


def test_list_agents(client: TestClient):
    client.post(
        "/llms/",
        json={
            "model_id": "gemini-pro",
            "provider": "google",
            "name": "gemini",
            "api_key": "k",
            "description": "model",
        },
    )
    client.post(
        "/agent/",
        json={
            "agent_id": "a1",
            "name": "Agent 1",
            "description": "d",
            "instruction": "i",
            "model_id": "gemini-pro",
        },
    )

    response = client.get("/agent/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["name"] == "Agent 1"


def test_delete_agent_success(client: TestClient):
    client.post(
        "/llms/",
        json={"model_id": "m1", "provider": "p", "name": "n", "api_key": "k", "description": "model"},
    )
    client.post(
        "/agent/",
        json={
            "agent_id": "a1",
            "name": "A1",
            "description": "d",
            "instruction": "i",
            "model_id": "m1",
        },
    )

    response = client.delete("/agent/a1")
    assert response.status_code == 200
    assert response.json() == {"ok": True}

    response = client.get("/agent/")
    data = response.json()
    assert len(data) == 0


def test_delete_agent_not_found_404(client: TestClient):
    response = client.delete("/agent/does-not-exist")
    assert response.status_code == 404
    assert response.json()["detail"] == "Agent not found"


def test_update_agent_name_only(client: TestClient):
    client.post(
        "/llms/",
        json={
            "model_id": "gemini-pro",
            "provider": "google",
            "name": "gemini-1.5-pro",
            "api_key": "test-key",
            "description": "model",
        },
    )
    client.post(
        "/agent/",
        json={
            "agent_id": "a1",
            "name": "Agent 1",
            "description": "desc",
            "instruction": "instr",
            "model_id": "gemini-pro",
            "isEnabled": True,
        },
    )

    response = client.patch("/agent/a1", json={"name": "Agent 1 Updated"})
    assert response.status_code == 200
    data = response.json()
    assert data["agent_id"] == "a1"
    assert data["name"] == "Agent 1 Updated"
    assert data["description"] == "desc"
    assert data["instruction"] == "instr"


def test_create_agent_missing_required_field_422(client: TestClient):
    _create_model(client)
    response = client.post(
        "/agent/",
        json={
            "agent_id": "a1",
            "name": "Agent 1",
            "description": "desc",
            # missing instruction
            "model_id": "gemini-pro",
        },
    )
    assert response.status_code == 422


def test_create_agent_duplicate_agent_id_conflict(client: TestClient):
    _create_model(client)
    first = _create_agent(client, agent_id="dup-1")
    assert first.status_code == 200
    duplicate = _create_agent(client, agent_id="dup-1")
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "Agent already exists"


def test_list_agents_empty(client: TestClient):
    response = client.get("/agent/")
    assert response.status_code == 200
    assert response.json() == []


def test_update_agent_description_only(client: TestClient):
    _create_model(client)
    _create_agent(client)
    response = client.patch("/agent/a1", json={"description": "new-desc"})
    assert response.status_code == 200
    data = response.json()
    assert data["description"] == "new-desc"
    assert data["name"] == "Agent 1"


def test_update_agent_instruction_only(client: TestClient):
    _create_model(client)
    _create_agent(client)
    response = client.patch("/agent/a1", json={"instruction": "new-instr"})
    assert response.status_code == 200
    assert response.json()["instruction"] == "new-instr"


def test_update_agent_model_id_only(client: TestClient):
    _create_model(client, model_id="gemini-pro")
    _create_model(client, model_id="gemini-flash")
    _create_agent(client, model_id="gemini-pro")
    response = client.patch("/agent/a1", json={"model_id": "gemini-flash"})
    assert response.status_code == 200
    assert response.json()["model_id"] == "gemini-flash"


def test_update_agent_invalid_model_id_returns_400(client: TestClient):
    _create_model(client, model_id="gemini-pro")
    _create_agent(client, model_id="gemini-pro")
    response = client.patch("/agent/a1", json={"model_id": "does-not-exist"})
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid model_id"


def test_update_agent_status_only(client: TestClient):
    _create_model(client)
    _create_agent(client)
    response = client.patch("/agent/a1", json={"isEnabled": False})
    assert response.status_code == 200
    assert response.json()["isEnabled"] is False


def test_update_agent_tools_only(client: TestClient):
    _create_model(client)
    _create_agent(client)
    response = client.patch("/agent/a1", json={"tools": "def ping():\n    return 'pong'"})
    assert response.status_code == 200
    assert "ping" in response.json()["tools"]


def test_update_agent_mcp_servers_only(client: TestClient):
    _create_model(client)
    _create_agent(client)
    response = client.patch("/agent/a1", json={"mcp_servers": ["http://localhost:9000/sse"]})
    assert response.status_code == 200
    assert response.json()["mcp_servers"] == ["http://localhost:9000/sse"]


def test_update_agent_connector_config_ids_only(client: TestClient):
    _create_model(client)
    _create_agent(client)
    response = client.patch("/agent/a1", json={"connector_config_ids": ["cfg-2", "cfg-3"]})
    assert response.status_code == 200
    assert response.json()["connector_config_ids"] == ["cfg-2", "cfg-3"]


def test_update_agent_sub_agents_only(client: TestClient):
    _create_model(client)
    _create_agent(client)
    response = client.patch("/agent/a1", json={"sub_agents": ["child-2"]})
    assert response.status_code == 200
    assert response.json()["sub_agents"] == ["child-2"]


def test_update_agent_multiple_fields(client: TestClient):
    _create_model(client)
    _create_agent(client)
    response = client.patch(
        "/agent/a1",
        json={
            "name": "Agent Updated",
            "description": "desc-updated",
            "instruction": "instr-updated",
            "isEnabled": False,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Agent Updated"
    assert data["description"] == "desc-updated"
    assert data["instruction"] == "instr-updated"
    assert data["isEnabled"] is False


def test_update_agent_not_found_404(client: TestClient):
    response = client.patch("/agent/does-not-exist", json={"name": "x"})
    assert response.status_code == 404
    assert response.json()["detail"] == "Agent not found"


def test_update_agent_empty_body_no_change(client: TestClient):
    _create_model(client)
    _create_agent(client)
    response = client.patch("/agent/a1", json={})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Agent 1"
    assert data["description"] == "desc"
    assert data["instruction"] == "instr"
    assert data["model_id"] == "gemini-pro"
    assert data["isEnabled"] is True


def test_update_agent_overwrites_list_fields(client: TestClient):
    _create_model(client)
    _create_agent(client)
    response = client.patch(
        "/agent/a1",
        json={
            "mcp_servers": ["http://localhost:9001/sse"],
            "connector_config_ids": ["cfg-new"],
            "sub_agents": ["child-new"],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["mcp_servers"] == ["http://localhost:9001/sse"]
    assert data["connector_config_ids"] == ["cfg-new"]
    assert data["sub_agents"] == ["child-new"]


def test_update_agent_invalidates_cache(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    _create_model(client)
    _create_agent(client)

    called = {"value": None}

    def fake_invalidate(agent_id: str):
        called["value"] = agent_id

    monkeypatch.setattr("routers.agents.invalidate_cache", fake_invalidate)

    response = client.patch("/agent/a1", json={"name": "x"})
    assert response.status_code == 200
    assert called["value"] == "a1"


def test_delete_agent_invalidates_cache(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    _create_model(client)
    _create_agent(client)

    called = {"value": None}

    def fake_invalidate(agent_id: str):
        called["value"] = agent_id

    monkeypatch.setattr("routers.agents.invalidate_cache", fake_invalidate)

    response = client.delete("/agent/a1")
    assert response.status_code == 200
    assert called["value"] == "a1"


def test_create_agent_with_invalid_model_id_returns_400(client: TestClient):
    response = client.post(
        "/agent/",
        json={
            "agent_id": "invalid-model-agent",
            "name": "Invalid Model Agent",
            "description": "desc",
            "instruction": "instr",
            "model_id": "does-not-exist",
            "isEnabled": True,
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid model_id"


def test_update_agent_invalid_isenabled_type_422(client: TestClient):
    _create_model(client)
    _create_agent(client)

    response = client.patch("/agent/a1", json={"isEnabled": "not-a-bool"})
    assert response.status_code == 422


def test_update_agent_invalid_mcp_servers_type_422(client: TestClient):
    _create_model(client)
    _create_agent(client)

    response = client.patch("/agent/a1", json={"mcp_servers": "http://localhost:8000/sse"})
    assert response.status_code == 422


def test_update_agent_succeeds_without_existing_cache_entry(client: TestClient):
    _create_model(client)
    _create_agent(client)

    response = client.patch("/agent/a1", json={"description": "updated-without-cache"})
    assert response.status_code == 200
    assert response.json()["description"] == "updated-without-cache"


def test_update_agent_allows_self_sub_agent_current_behavior(client: TestClient):
    _create_model(client)
    _create_agent(client, agent_id="self-agent")

    response = client.patch("/agent/self-agent", json={"sub_agents": ["self-agent"]})
    assert response.status_code == 200
    assert response.json()["sub_agents"] == ["self-agent"]


def test_update_agent_allows_duplicate_sub_agents_current_behavior(client: TestClient):
    _create_model(client)
    _create_agent(client)

    response = client.patch("/agent/a1", json={"sub_agents": ["child-dup", "child-dup"]})
    assert response.status_code == 200
    assert response.json()["sub_agents"] == ["child-dup", "child-dup"]

def _create_automation_agent(client: TestClient, agent_id: str = "a-auto", model_id: str = "gemini-pro"):
    return client.post(
        "/agent/",
        json={
            "agent_id": agent_id,
            "name": "Auto Agent",
            "description": "desc",
            "instruction": "instr",
            "model_id": model_id,
            "isEnabled": True,
            "type": "automation"
        },
    )

def test_create_webhook(client: TestClient):
    _create_model(client)
    _create_automation_agent(client)
    res = client.post("/agent/a-auto/webhooks", json={"prompt": "hello"})
    assert res.status_code == 200
    assert "webhook_id" in res.json()

def test_create_webhook_invalid_agent_type(client: TestClient):
    _create_model(client)
    _create_agent(client, agent_id="a-normal") # type=agent by default
    res = client.post("/agent/a-normal/webhooks", json={"prompt": "hello"})
    assert res.status_code == 400

def test_list_and_delete_webhooks(client: TestClient):
    _create_model(client)
    _create_automation_agent(client)
    res = client.post("/agent/a-auto/webhooks", json={"prompt": "hello"})
    wh_id = res.json()["webhook_id"]
    
    list_res = client.get("/agent/a-auto/webhook")
    assert len(list_res.json()) == 1
    
    del_res = client.delete(f"/agent/a-auto/webhook/{wh_id}")
    assert del_res.status_code == 200
    
    list_res = client.get("/agent/a-auto/webhook")
    assert len(list_res.json()) == 0

def test_create_job(client: TestClient):
    _create_model(client)
    _create_automation_agent(client)
    res = client.post("/agent/a-auto/jobs", json={
        "prompt": "job hello",
        "cron_expression": "*/5 * * * *"
    })
    assert res.status_code == 200
    assert "job_id" in res.json()

def test_create_job_missing_schedule(client: TestClient):
    _create_model(client)
    _create_automation_agent(client)
    res = client.post("/agent/a-auto/jobs", json={
        "prompt": "job hello"
    })
    assert res.status_code == 400

def test_list_and_delete_jobs(client: TestClient):
    _create_model(client)
    _create_automation_agent(client)
    res = client.post("/agent/a-auto/jobs", json={
        "prompt": "job hello",
        "interval_seconds": 60
    })
    j_id = res.json()["job_id"]
    
    list_res = client.get("/agent/a-auto/jobs")
    assert len(list_res.json()) == 1
    
    del_res = client.delete(f"/agent/a-auto/jobs/{j_id}")
    assert del_res.status_code == 200

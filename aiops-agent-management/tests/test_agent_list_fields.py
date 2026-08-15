"""
Tests for list field behaviour on agent create/update:
- Sending [] wipes the list
- Omitting the field leaves it unchanged
- Sending a new list overwrites the old one

Also covers:
- Delete agent cascades to webhooks and jobs
- Job created with both cron and interval (cron wins at API level)
- Webhook invoke with no body falls back to stored prompt
"""

from fastapi.testclient import TestClient


def _create_model(client: TestClient, model_id: str = "m1"):
    client.post(
        "/llms/",
        json={
            "model_id": model_id,
            "provider": "google",
            "name": "gemini-1.5-pro",
            "api_key": "test-key",
            "description": "model",
        },
    )


def _create_agent(client: TestClient, agent_id: str = "a1", **extra):
    payload = {
        "agent_id": agent_id,
        "name": "Agent",
        "description": "desc",
        "primary_use_global": False,
        "primary_model_id": "m1",
        "isEnabled": True,
    }
    payload.update(extra)
    return client.post("/agent/", json=payload)


def _create_automation_agent(client: TestClient, agent_id: str = "auto"):
    client.post(
        "/agent/",
        json={
            "agent_id": agent_id,
            "name": "Auto",
            "description": "desc",
            "primary_use_global": False,
            "primary_model_id": "m1",
            "isEnabled": True,
            "type": "automation",
        },
    )


# ---------------------------------------------------------------------------
# List fields: connector_config_ids
# ---------------------------------------------------------------------------


def test_create_agent_with_connector_config_ids(client: TestClient):
    _create_model(client)
    res = _create_agent(client, connector_config_ids=["cfg-1", "cfg-2"])
    assert res.status_code == 200
    assert res.json()["connector_config_ids"] == ["cfg-1", "cfg-2"]


def test_update_agent_connector_config_ids_overwrites(client: TestClient):
    _create_model(client)
    _create_agent(client, connector_config_ids=["old-cfg"])
    res = client.patch("/agent/a1", json={"connector_config_ids": ["new-cfg"]})
    assert res.status_code == 200
    assert res.json()["connector_config_ids"] == ["new-cfg"]


def test_update_agent_connector_config_ids_empty_list_wipes(client: TestClient):
    _create_model(client)
    _create_agent(client, connector_config_ids=["cfg-1"])
    res = client.patch("/agent/a1", json={"connector_config_ids": []})
    assert res.status_code == 200
    assert res.json()["connector_config_ids"] == []


def test_update_agent_omit_connector_config_ids_leaves_unchanged(client: TestClient):
    _create_model(client)
    _create_agent(client, connector_config_ids=["keep-me"])
    res = client.patch("/agent/a1", json={"name": "New Name"})
    assert res.status_code == 200
    assert res.json()["connector_config_ids"] == ["keep-me"]


# ---------------------------------------------------------------------------
# List fields: mcp_servers
# ---------------------------------------------------------------------------


def test_create_agent_with_mcp_servers(client: TestClient):
    _create_model(client)
    res = _create_agent(client, mcp_servers=["http://mcp1/sse", "http://mcp2/sse"])
    assert res.status_code == 200
    assert res.json()["mcp_servers"] == ["http://mcp1/sse", "http://mcp2/sse"]


def test_update_agent_mcp_servers_overwrites(client: TestClient):
    _create_model(client)
    _create_agent(client, mcp_servers=["http://old/sse"])
    res = client.patch("/agent/a1", json={"mcp_servers": ["http://new/sse"]})
    assert res.status_code == 200
    assert res.json()["mcp_servers"] == ["http://new/sse"]


def test_update_agent_mcp_servers_empty_list_wipes(client: TestClient):
    _create_model(client)
    _create_agent(client, mcp_servers=["http://mcp/sse"])
    res = client.patch("/agent/a1", json={"mcp_servers": []})
    assert res.status_code == 200
    assert res.json()["mcp_servers"] == []


def test_update_agent_omit_mcp_servers_leaves_unchanged(client: TestClient):
    _create_model(client)
    _create_agent(client, mcp_servers=["http://keep/sse"])
    res = client.patch("/agent/a1", json={"name": "Updated"})
    assert res.status_code == 200
    assert res.json()["mcp_servers"] == ["http://keep/sse"]


# ---------------------------------------------------------------------------
# List fields: sub_agents
# ---------------------------------------------------------------------------


def test_update_agent_sub_agents_empty_list_wipes(client: TestClient):
    _create_model(client)
    _create_agent(client, sub_agents=["child-1"])
    res = client.patch("/agent/a1", json={"sub_agents": []})
    assert res.status_code == 200
    assert res.json()["sub_agents"] == []


def test_update_agent_omit_sub_agents_leaves_unchanged(client: TestClient):
    _create_model(client)
    _create_agent(client, sub_agents=["child-1"])
    res = client.patch("/agent/a1", json={"name": "Updated"})
    assert res.status_code == 200
    assert res.json()["sub_agents"] == ["child-1"]


# ---------------------------------------------------------------------------
# Delete agent — cascade to webhooks and jobs
# ---------------------------------------------------------------------------


def test_delete_agent_cascade_webhooks_structural():
    """
    Structural: delete_agent must explicitly delete associated webhooks,
    otherwise orphan webhooks remain accessible after the agent is gone.
    SQLite does not enforce FK cascades — the endpoint must do it explicitly.
    """
    import inspect

    import src.routers.agents as agents_module

    source = inspect.getsource(agents_module.delete_agent)
    assert "Webhook" in source or "webhook" in source.lower(), (
        "delete_agent must explicitly delete associated webhooks — "
        "orphan webhooks remain after agent deletion without explicit cleanup"
    )


def test_delete_agent_cascade_jobs_structural():
    """
    Structural: delete_agent must explicitly delete associated jobs,
    otherwise orphan jobs keep firing after the agent is deleted.
    SQLite does not enforce FK cascades — the endpoint must do it explicitly.
    """
    import inspect

    import src.routers.agents as agents_module

    source = inspect.getsource(agents_module.delete_agent)
    assert "Job" in source or "job" in source.lower(), (
        "delete_agent must explicitly delete associated jobs — "
        "orphan jobs keep firing after agent deletion without explicit cleanup"
    )


# ---------------------------------------------------------------------------
# Job with both cron and interval — cron wins
# ---------------------------------------------------------------------------


def test_create_job_cron_wins_over_interval(client: TestClient):
    _create_model(client)
    _create_automation_agent(client)
    res = client.post(
        "/agent/auto/jobs",
        json={
            "prompt": "both",
            "cron_expression": "0 * * * *",
            "interval_seconds": 60,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["cron_expression"] == "0 * * * *"


# ---------------------------------------------------------------------------
# Webhook invoke — no body falls back to stored prompt
# ---------------------------------------------------------------------------


def test_invoke_webhook_no_body_uses_stored_prompt(client: TestClient, monkeypatch):
    _create_model(client)
    _create_automation_agent(client)
    wh_id = client.post(
        "/agent/auto/webhooks", json={"prompt": "stored prompt"}
    ).json()["webhook_id"]

    captured = []

    async def fake_bg(agent_id, prompt):
        captured.append(prompt)

    monkeypatch.setattr("src.routers.agents._invoke_agent_session_background", fake_bg)

    res = client.post(f"/agent/auto/webhook/invoke/{wh_id}")
    assert res.status_code == 200
    assert captured == ["stored prompt"]


def test_invoke_webhook_body_overrides_stored_prompt(client: TestClient, monkeypatch):
    _create_model(client)
    _create_automation_agent(client)
    wh_id = client.post("/agent/auto/webhooks", json={"prompt": "stored"}).json()[
        "webhook_id"
    ]

    captured = []

    async def fake_bg(agent_id, prompt):
        captured.append(prompt)

    monkeypatch.setattr("src.routers.agents._invoke_agent_session_background", fake_bg)

    res = client.post(
        f"/agent/auto/webhook/invoke/{wh_id}", json={"prompt": "override"}
    )
    assert res.status_code == 200
    assert captured == ["override"]

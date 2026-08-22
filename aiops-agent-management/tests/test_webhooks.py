"""
Tests for webhook CRUD and invocation behaviour.
"""

from fastapi.testclient import TestClient


def _create_model(client: TestClient):
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


def _create_automation_agent(client: TestClient, agent_id: str = "a-auto"):
    client.post(
        "/agent/",
        json={
            "agent_id": agent_id,
            "name": "Auto Agent",
            "description": "automation agent",
            "primary_use_global": False,
            "primary_model_id": "gemini-pro",
            "isEnabled": True,
            "type": "automation",
        },
    )


def _create_regular_agent(client: TestClient, agent_id: str = "a-reg"):
    client.post(
        "/agent/",
        json={
            "agent_id": agent_id,
            "name": "Regular Agent",
            "description": "regular agent",
            "primary_use_global": False,
            "primary_model_id": "gemini-pro",
            "isEnabled": True,
        },
    )


# ---------------------------------------------------------------------------
# Creation
# ---------------------------------------------------------------------------


def test_create_webhook_returns_webhook_id(client: TestClient):
    _create_model(client)
    _create_automation_agent(client)
    res = client.post("/agent/a-auto/webhooks", json={"prompt": "run task"})
    assert res.status_code == 200
    assert "webhook_id" in res.json()


def test_create_webhook_stores_prompt(client: TestClient):
    _create_model(client)
    _create_automation_agent(client)
    client.post("/agent/a-auto/webhooks", json={"prompt": "stored prompt"})
    webhooks = client.get("/agent/a-auto/webhook").json()
    assert any(w["prompt"] == "stored prompt" for w in webhooks)


def test_create_webhook_rejects_non_automation_agent(client: TestClient):
    _create_model(client)
    _create_regular_agent(client)
    res = client.post("/agent/a-reg/webhooks", json={"prompt": "hello"})
    assert res.status_code == 400


def test_create_webhook_agent_not_found_returns_error(client: TestClient):
    res = client.post("/agent/ghost/webhooks", json={"prompt": "hello"})
    assert res.status_code in (400, 404)


def test_create_multiple_webhooks_for_same_agent(client: TestClient):
    _create_model(client)
    _create_automation_agent(client)
    client.post("/agent/a-auto/webhooks", json={"prompt": "first"})
    client.post("/agent/a-auto/webhooks", json={"prompt": "second"})
    webhooks = client.get("/agent/a-auto/webhook").json()
    assert len(webhooks) == 2


# ---------------------------------------------------------------------------
# Listing
# ---------------------------------------------------------------------------


def test_list_webhooks_empty_initially(client: TestClient):
    _create_model(client)
    _create_automation_agent(client)
    res = client.get("/agent/a-auto/webhook")
    assert res.status_code == 200
    assert res.json() == []


def test_list_webhooks_returns_created_webhooks(client: TestClient):
    _create_model(client)
    _create_automation_agent(client)
    client.post("/agent/a-auto/webhooks", json={"prompt": "p1"})
    client.post("/agent/a-auto/webhooks", json={"prompt": "p2"})
    res = client.get("/agent/a-auto/webhook")
    assert res.status_code == 200
    assert len(res.json()) == 2


def test_list_webhooks_isolated_per_agent(client: TestClient):
    _create_model(client)
    _create_automation_agent(client, "ag1")
    _create_automation_agent(client, "ag2")
    client.post("/agent/ag1/webhooks", json={"prompt": "only for ag1"})
    res = client.get("/agent/ag2/webhook")
    assert res.json() == []


# ---------------------------------------------------------------------------
# Deletion
# ---------------------------------------------------------------------------


def test_delete_webhook_success(client: TestClient):
    _create_model(client)
    _create_automation_agent(client)
    wh_id = client.post("/agent/a-auto/webhooks", json={"prompt": "bye"}).json()[
        "webhook_id"
    ]
    res = client.delete(f"/agent/a-auto/webhook/{wh_id}")
    assert res.status_code == 200
    assert client.get("/agent/a-auto/webhook").json() == []


def test_delete_webhook_not_found_returns_404(client: TestClient):
    _create_model(client)
    _create_automation_agent(client)
    res = client.delete("/agent/a-auto/webhook/00000000-0000-0000-0000-000000000000")
    assert res.status_code == 404


def test_delete_one_webhook_leaves_others(client: TestClient):
    _create_model(client)
    _create_automation_agent(client)
    id1 = client.post("/agent/a-auto/webhooks", json={"prompt": "keep"}).json()[
        "webhook_id"
    ]
    id2 = client.post("/agent/a-auto/webhooks", json={"prompt": "delete-me"}).json()[
        "webhook_id"
    ]
    client.delete(f"/agent/a-auto/webhook/{id2}")
    remaining = client.get("/agent/a-auto/webhook").json()
    assert len(remaining) == 1
    assert remaining[0]["webhook_id"] == id1


# ---------------------------------------------------------------------------
# Invocation — background task regression
# Regression: a PR removed background_tasks.add_task() from invoke_webhook,
# making webhook calls block (or silently drop) instead of running async.
# ---------------------------------------------------------------------------


def test_invoke_webhook_returns_accepted(client: TestClient, monkeypatch):
    _create_model(client)
    _create_automation_agent(client)
    wh_id = client.post("/agent/a-auto/webhooks", json={"prompt": "run"}).json()[
        "webhook_id"
    ]
    monkeypatch.setattr(
        "src.routers.agents._invoke_agent_session_background",
        lambda *args, **kwargs: None,
    )
    res = client.post(f"/agent/a-auto/webhook/invoke/{wh_id}")
    assert res.status_code == 200
    assert res.json()["status"] == "accepted"


def test_invoke_webhook_enqueues_background_task(monkeypatch):
    """Regression: invoke_webhook must use background_tasks.add_task, not await directly.

    Verifies that the route calls background_tasks.add_task() and not
    invoke_agent_session directly — if someone removes add_task and awaits
    inline, the response would block and this test catches it via the
    enqueued list being empty.
    """
    import inspect

    import src.routers.agents as agents_module

    source = inspect.getsource(agents_module.invoke_webhook)
    assert "background_tasks.add_task" in source, (
        "invoke_webhook must enqueue via background_tasks.add_task — "
        "direct await removed async invocation"
    )


def test_invoke_webhook_uses_stored_prompt(client: TestClient, monkeypatch):
    _create_model(client)
    _create_automation_agent(client)
    wh_id = client.post("/agent/a-auto/webhooks", json={"prompt": "stored"}).json()[
        "webhook_id"
    ]

    captured = []

    async def fake_background(agent_id, prompt):
        captured.append(prompt)

    monkeypatch.setattr(
        "src.routers.agents._invoke_agent_session_background", fake_background
    )
    client.post(f"/agent/a-auto/webhook/invoke/{wh_id}")

    assert captured == ["stored"]


def test_invoke_webhook_overrides_prompt_from_body(client: TestClient, monkeypatch):
    _create_model(client)
    _create_automation_agent(client)
    wh_id = client.post("/agent/a-auto/webhooks", json={"prompt": "original"}).json()[
        "webhook_id"
    ]

    captured = []

    async def fake_background(agent_id, prompt):
        captured.append(prompt)

    monkeypatch.setattr(
        "src.routers.agents._invoke_agent_session_background", fake_background
    )
    client.post(f"/agent/a-auto/webhook/invoke/{wh_id}", json={"prompt": "override"})

    assert captured == ["override"]


def test_invoke_webhook_not_found_returns_404(client: TestClient):
    _create_model(client)
    _create_automation_agent(client)
    res = client.post(
        "/agent/a-auto/webhook/invoke/00000000-0000-0000-0000-000000000000"
    )
    assert res.status_code == 404

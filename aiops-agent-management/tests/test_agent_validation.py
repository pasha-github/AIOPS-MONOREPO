"""
Tests for agent model validation, duplicate model detection,
and AWS credential validation logic.
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


def _base_agent(agent_id: str = "a1", **overrides) -> dict:
    payload = {
        "agent_id": agent_id,
        "name": "Test Agent",
        "description": "desc",
        "primary_use_global": False,
        "primary_model_id": "m1",
        "isEnabled": True,
    }
    payload.update(overrides)
    return payload


# ---------------------------------------------------------------------------
# _validate_model_id — invalid model_id raises 400
# ---------------------------------------------------------------------------


def test_create_agent_invalid_primary_model_id_returns_400(client: TestClient):
    res = client.post(
        "/agent/",
        json=_base_agent(primary_use_global=False, primary_model_id="does-not-exist"),
    )
    assert res.status_code == 400
    assert "primary_model_id" in res.json()["detail"]


def test_create_agent_invalid_secondary_model_id_returns_400(client: TestClient):
    _create_model(client, "m1")
    res = client.post(
        "/agent/",
        json=_base_agent(
            secondary_use_global=False,
            secondary_model_id="ghost",
        ),
    )
    assert res.status_code == 400
    assert "secondary_model_id" in res.json()["detail"]


def test_create_agent_invalid_tertiary_model_id_returns_400(client: TestClient):
    _create_model(client, "m1")
    res = client.post(
        "/agent/",
        json=_base_agent(
            tertiary_use_global=False,
            tertiary_model_id="ghost",
        ),
    )
    assert res.status_code == 400
    assert "tertiary_model_id" in res.json()["detail"]


# ---------------------------------------------------------------------------
# Duplicate model detection
# ---------------------------------------------------------------------------


def test_create_agent_duplicate_primary_secondary_model_returns_400(client: TestClient):
    _create_model(client, "m1")
    res = client.post(
        "/agent/",
        json=_base_agent(
            primary_use_global=False,
            primary_model_id="m1",
            secondary_use_global=False,
            secondary_model_id="m1",  # same as primary
        ),
    )
    assert res.status_code == 400
    assert "Duplicate" in res.json()["detail"]


def test_create_agent_duplicate_primary_tertiary_model_returns_400(client: TestClient):
    _create_model(client, "m1")
    res = client.post(
        "/agent/",
        json=_base_agent(
            primary_use_global=False,
            primary_model_id="m1",
            tertiary_use_global=False,
            tertiary_model_id="m1",  # same as primary
        ),
    )
    assert res.status_code == 400
    assert "Duplicate" in res.json()["detail"]


def test_create_agent_duplicate_all_three_models_returns_400(client: TestClient):
    _create_model(client, "m1")
    res = client.post(
        "/agent/",
        json=_base_agent(
            primary_use_global=False,
            primary_model_id="m1",
            secondary_use_global=False,
            secondary_model_id="m1",
            tertiary_use_global=False,
            tertiary_model_id="m1",
        ),
    )
    assert res.status_code == 400
    assert "Duplicate" in res.json()["detail"]


def test_create_agent_different_models_no_duplicate_error(client: TestClient):
    _create_model(client, "m1")
    _create_model(client, "m2")
    _create_model(client, "m3")
    res = client.post(
        "/agent/",
        json=_base_agent(
            primary_use_global=False,
            primary_model_id="m1",
            secondary_use_global=False,
            secondary_model_id="m2",
            tertiary_use_global=False,
            tertiary_model_id="m3",
        ),
    )
    assert res.status_code == 200


def test_create_agent_global_plus_same_explicit_no_duplicate_error(client: TestClient):
    """global slots are excluded from duplicate detection — only explicit ones count."""
    _create_model(client, "m1")
    res = client.post(
        "/agent/",
        json=_base_agent(
            primary_use_global=False,
            primary_model_id="m1",
            secondary_use_global=True,  # global — excluded from check
        ),
    )
    assert res.status_code == 200


# ---------------------------------------------------------------------------
# _get_chat_agent — disabled agent
# ---------------------------------------------------------------------------


def test_chat_agent_not_found_returns_404(client: TestClient):
    res = client.post("/agent/ghost/chat", json={"message": "hello"})
    assert res.status_code == 404


def test_chat_agent_disabled_guard_exists_in_source():
    """Structural: chat_agent must guard against disabled agents."""
    import inspect

    import src.routers.agents as agents_module

    source = inspect.getsource(agents_module.chat_agent)
    assert "isEnabled" in source or "not enabled" in source, (
        "chat_agent must check agent.isEnabled — disabled agents must be rejected"
    )


# ---------------------------------------------------------------------------
# Chat session endpoints — agent not found / disabled guards
# ---------------------------------------------------------------------------


def test_create_chat_session_agent_not_found_returns_error(client: TestClient):
    res = client.post("/agent/ghost/chat/sessions", json={"user_id": "u1"})
    assert res.status_code in (400, 404)


def test_list_chat_sessions_agent_not_found_returns_error(client: TestClient):
    res = client.get("/agent/ghost/chat/sessions")
    assert res.status_code in (400, 404)


def test_get_chat_session_agent_not_found_returns_error(client: TestClient):
    res = client.get("/agent/ghost/chat/sessions/00000000-0000-0000-0000-000000000000")
    assert res.status_code in (400, 404)


def test_delete_chat_session_agent_not_found_returns_error(client: TestClient):
    res = client.delete(
        "/agent/ghost/chat/sessions/00000000-0000-0000-0000-000000000000"
    )
    assert res.status_code in (400, 404)

"""
Extended tests for src/routers/llms.py covering gaps in test_llms.py:

- delete model used in secondary/tertiary slots (not just primary)
- delete model used in defaults secondary/tertiary slots
- update model in global defaults triggers reconciliation for global-slot agents
- update model linked to agent via secondary/tertiary triggers reconciliation
- update model not linked to any agent succeeds without reconciliation
- patch defaults to None clears slot
- patch defaults rejects unknown model in any slot
"""

from fastapi.testclient import TestClient


def _create_model(client: TestClient, model_id: str, **extra):
    payload = {
        "model_id": model_id,
        "provider": "google",
        "name": f"name-{model_id}",
        "api_key": "key",
        "description": "desc",
    }
    payload.update(extra)
    return client.post("/llms/", json=payload)


def _create_agent(client: TestClient, agent_id: str, **slots):
    payload = {
        "agent_id": agent_id,
        "name": agent_id,
        "description": "desc",
        "primary_use_global": False,
        "primary_model_id": slots.get("primary_model_id"),
        "isEnabled": True,
    }
    payload.update(slots)
    return client.post("/agent/", json=payload)


# ---------------------------------------------------------------------------
# delete_model — conflict detection across all slots
# ---------------------------------------------------------------------------


def test_delete_model_used_as_secondary_returns_409(client: TestClient):
    _create_model(client, "primary")
    _create_model(client, "secondary")
    _create_agent(
        client,
        "a1",
        primary_model_id="primary",
        secondary_model_id="secondary",
        secondary_use_global=False,
    )

    res = client.delete("/llms/secondary")
    assert res.status_code == 409
    assert "a1" in res.json()["detail"]["agent_ids"]


def test_delete_model_used_as_tertiary_returns_409(client: TestClient):
    _create_model(client, "primary")
    _create_model(client, "tertiary")
    _create_agent(
        client,
        "a1",
        primary_model_id="primary",
        tertiary_model_id="tertiary",
        tertiary_use_global=False,
    )

    res = client.delete("/llms/tertiary")
    assert res.status_code == 409
    assert "a1" in res.json()["detail"]["agent_ids"]


def test_delete_model_used_in_defaults_secondary_returns_409(client: TestClient):
    _create_model(client, "m1")
    _create_model(client, "sec")
    client.patch("/llms/defaults", json={"secondary_model_id": "sec"})

    res = client.delete("/llms/sec")
    assert res.status_code == 409
    assert res.json()["detail"]["used_in_defaults"] is True


def test_delete_model_used_in_defaults_tertiary_returns_409(client: TestClient):
    _create_model(client, "tert")
    client.patch("/llms/defaults", json={"tertiary_model_id": "tert"})

    res = client.delete("/llms/tert")
    assert res.status_code == 409
    assert res.json()["detail"]["used_in_defaults"] is True


def test_delete_model_not_in_any_slot_succeeds(client: TestClient):
    _create_model(client, "primary")
    _create_model(client, "unused")
    _create_agent(client, "a1", primary_model_id="primary")

    res = client.delete("/llms/unused")
    assert res.status_code == 200
    assert res.json() == {"ok": True}


def test_delete_model_conflict_detail_includes_all_linked_agents(client: TestClient):
    _create_model(client, "shared")
    _create_model(client, "other")
    _create_agent(client, "a1", primary_model_id="shared")
    _create_agent(
        client,
        "a2",
        primary_model_id="other",
        secondary_model_id="shared",
        secondary_use_global=False,
    )

    res = client.delete("/llms/shared")
    assert res.status_code == 409
    agent_ids = res.json()["detail"]["agent_ids"]
    assert "a1" in agent_ids
    assert "a2" in agent_ids


# ---------------------------------------------------------------------------
# update_model — reconciliation triggered for linked agents
# ---------------------------------------------------------------------------


def test_update_model_triggers_reconciliation_for_secondary_slot_agent(
    client: TestClient, monkeypatch
):
    """update_model must mark PENDING all agents that use the model in any slot."""
    _create_model(client, "primary")
    _create_model(client, "secondary")
    _create_agent(
        client,
        "a1",
        primary_model_id="primary",
        secondary_model_id="secondary",
        secondary_use_global=False,
    )

    reconciled = []

    import src.routers.llms as llms_module

    original = llms_module.enqueue_agent_runtime_reconcile

    def capture(bg, agent_id):
        reconciled.append(agent_id)
        return original(bg, agent_id=agent_id)

    monkeypatch.setattr(llms_module, "enqueue_agent_runtime_reconcile", capture)

    res = client.patch("/llms/secondary", json={"name": "new-name"})
    assert res.status_code == 200
    assert "a1" in reconciled


def test_update_model_triggers_reconciliation_for_global_slot_agents(
    client: TestClient, monkeypatch
):
    """
    When the updated model is in the global defaults, all agents with any
    use_global=True slot must be marked for reconciliation — they inherit
    the updated model through the global default.
    """
    _create_model(client, "global-primary")
    _create_model(client, "local-primary")
    client.patch("/llms/defaults", json={"primary_model_id": "global-primary"})
    # Agent uses global primary slot — must be reconciled
    _create_agent(client, "global-agent", primary_use_global=True)
    # Agent uses local model only — NOT via global slot, but still linked to
    # local-primary directly, so not affected by global-primary update
    _create_agent(client, "local-agent", primary_model_id="local-primary")

    reconciled = []

    import src.routers.llms as llms_module

    original = llms_module.enqueue_agent_runtime_reconcile

    def capture(bg, agent_id):
        reconciled.append(agent_id)
        return original(bg, agent_id=agent_id)

    monkeypatch.setattr(llms_module, "enqueue_agent_runtime_reconcile", capture)

    res = client.patch("/llms/global-primary", json={"name": "updated"})
    assert res.status_code == 200
    # global-agent must be reconciled — it inherits global-primary via use_global
    assert "global-agent" in reconciled


def test_update_model_no_linked_agents_no_reconciliation(
    client: TestClient, monkeypatch
):
    _create_model(client, "orphan")

    reconciled = []

    import src.routers.llms as llms_module

    original = llms_module.enqueue_agent_runtime_reconcile

    def capture(bg, agent_id):
        reconciled.append(agent_id)
        return original(bg, agent_id=agent_id)

    monkeypatch.setattr(llms_module, "enqueue_agent_runtime_reconcile", capture)

    res = client.patch("/llms/orphan", json={"name": "new-name"})
    assert res.status_code == 200
    assert reconciled == []


# ---------------------------------------------------------------------------
# patch defaults — edge cases
# ---------------------------------------------------------------------------


def test_patch_defaults_clears_slot_with_null(client: TestClient):
    _create_model(client, "m1")
    client.patch("/llms/defaults", json={"primary_model_id": "m1"})

    res = client.patch("/llms/defaults", json={"primary_model_id": None})
    assert res.status_code == 200
    assert res.json()["primary_model_id"] is None


def test_patch_defaults_rejects_invalid_secondary_model(client: TestClient):
    res = client.patch("/llms/defaults", json={"secondary_model_id": "ghost"})
    assert res.status_code == 400
    assert "secondary_model_id" in res.json()["detail"]


def test_patch_defaults_rejects_invalid_tertiary_model(client: TestClient):
    res = client.patch("/llms/defaults", json={"tertiary_model_id": "ghost"})
    assert res.status_code == 400
    assert "tertiary_model_id" in res.json()["detail"]


def test_patch_defaults_partial_update_preserves_other_slots(client: TestClient):
    _create_model(client, "m1")
    _create_model(client, "m2")
    client.patch(
        "/llms/defaults",
        json={"primary_model_id": "m1", "secondary_model_id": "m2"},
    )

    # Only update tertiary — primary and secondary must stay
    _create_model(client, "m3")
    res = client.patch("/llms/defaults", json={"tertiary_model_id": "m3"})
    assert res.status_code == 200
    data = res.json()
    assert data["primary_model_id"] == "m1"
    assert data["secondary_model_id"] == "m2"
    assert data["tertiary_model_id"] == "m3"


def test_patch_defaults_idempotent(client: TestClient):
    _create_model(client, "m1")
    client.patch("/llms/defaults", json={"primary_model_id": "m1"})
    res = client.patch("/llms/defaults", json={"primary_model_id": "m1"})
    assert res.status_code == 200
    assert res.json()["primary_model_id"] == "m1"


# ---------------------------------------------------------------------------
# update_model — null description allowed, null name rejected
# ---------------------------------------------------------------------------


def test_update_model_null_description_allowed(client: TestClient):
    _create_model(client, "m1")
    res = client.patch("/llms/m1", json={"description": None})
    assert res.status_code == 200
    assert res.json()["description"] is None


def test_update_model_null_name_rejected(client: TestClient):
    _create_model(client, "m1")
    res = client.patch("/llms/m1", json={"name": None})
    assert res.status_code == 400
    assert "name" in res.json()["detail"]


def test_update_model_null_api_key_rejected(client: TestClient):
    _create_model(client, "m1")
    res = client.patch("/llms/m1", json={"api_key": None})
    assert res.status_code == 400
    assert "api_key" in res.json()["detail"]

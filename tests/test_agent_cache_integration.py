"""
Integration tests verifying that agent update/delete operations correctly
invalidate the agent cache AND the ADK runner.

These tests exist specifically to catch the regression where only
cache.remove_agent() was called (old bug) without _invalidate_runner_cache(),
leaving a stale runner alive.
"""

import pytest
from fastapi.testclient import TestClient

from src.agent_runtime.adk.cache import cache


def _create_model(client: TestClient, model_id: str = "gemini-pro"):
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


def _create_agent(client: TestClient, agent_id: str = "a1"):
    client.post(
        "/agent/",
        json={
            "agent_id": agent_id,
            "name": "Agent One",
            "description": "desc",
            "primary_use_global": False,
            "primary_model_id": "gemini-pro",
            "isEnabled": True,
        },
    )


# ---------------------------------------------------------------------------
# Update triggers full invalidation (cache + runner)
# ---------------------------------------------------------------------------


def test_update_agent_clears_agent_cache(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    _create_model(client)
    _create_agent(client)

    # Pre-populate the cache to simulate a previously loaded agent
    cache.set_agent("a1", object())
    monkeypatch.setattr(
        "src.agent_runtime.adk.adk_app._invalidate_runner_cache", lambda _: None
    )

    client.patch("/agent/a1", json={"name": "Updated Name"})

    assert cache.get_agent("a1") is None


def test_update_agent_calls_runner_invalidation(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    _create_model(client)
    _create_agent(client)
    cache.set_agent("a1", object())

    runner_calls = []

    def fake_runner_invalidate(app_name):
        runner_calls.append(app_name)

    monkeypatch.setattr(
        "src.agent_runtime.adk.adk_app._invalidate_runner_cache",
        fake_runner_invalidate,
    )

    client.patch("/agent/a1", json={"name": "New Name"})

    assert "a1" in runner_calls


def test_update_agent_without_cache_entry_does_not_raise(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    _create_model(client)
    _create_agent(client)

    # Make sure nothing is cached
    cache.remove_agent("a1")
    monkeypatch.setattr(
        "src.agent_runtime.adk.adk_app._invalidate_runner_cache", lambda _: None
    )

    # Should succeed even if agent was never loaded into cache
    res = client.patch("/agent/a1", json={"name": "Clean"})
    assert res.status_code == 200


# ---------------------------------------------------------------------------
# Delete triggers full invalidation (cache + runner)
# ---------------------------------------------------------------------------


def test_delete_agent_clears_agent_cache(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    _create_model(client)
    _create_agent(client)
    cache.set_agent("a1", object())
    monkeypatch.setattr(
        "src.agent_runtime.adk.adk_app._invalidate_runner_cache", lambda _: None
    )

    client.delete("/agent/a1")

    assert cache.get_agent("a1") is None


def test_delete_agent_calls_runner_invalidation(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    _create_model(client)
    _create_agent(client)
    cache.set_agent("a1", object())

    runner_calls = []

    def fake_runner_invalidate(app_name):
        runner_calls.append(app_name)

    monkeypatch.setattr(
        "src.agent_runtime.adk.adk_app._invalidate_runner_cache",
        fake_runner_invalidate,
    )

    client.delete("/agent/a1")

    assert "a1" in runner_calls


def test_delete_only_invalidates_target_agent_cache(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
):
    _create_model(client)
    _create_agent(client, "del-me")
    _create_agent(client, "keep-me")

    cache.set_agent("del-me", object())
    cache.set_agent("keep-me", object())

    monkeypatch.setattr(
        "src.agent_runtime.adk.adk_app._invalidate_runner_cache", lambda _: None
    )

    client.delete("/agent/del-me")

    assert cache.get_agent("del-me") is None
    assert cache.get_agent("keep-me") is not None
    cache.remove_agent("keep-me")


# ---------------------------------------------------------------------------
# Regression: using cache.remove_agent alone is NOT sufficient
# This test documents why invalidate_cache() must be used everywhere
# ---------------------------------------------------------------------------


def test_regression_cache_remove_alone_does_not_clean_runner(monkeypatch):
    """
    If code calls cache.remove_agent() directly instead of invalidate_cache(),
    the runner is not cleaned up. This test documents the correct expectation:
    runner cleanup must happen alongside cache removal.
    """
    cache.set_agent("stale", object())

    runner_cleaned = {"value": False}

    def fake_runner_invalidate(app_name):
        runner_cleaned["value"] = True

    monkeypatch.setattr(
        "src.agent_runtime.adk.adk_app._invalidate_runner_cache",
        fake_runner_invalidate,
    )

    # Simulate old bug: only remove from agent cache, skip runner
    cache.remove_agent("stale")

    # Agent cache is empty but runner was NOT cleaned — this is the bug
    assert cache.get_agent("stale") is None
    assert runner_cleaned["value"] is False  # runner still stale

    # Correct fix: use invalidate_cache() which does both
    cache.set_agent("stale", object())
    from src.agent_runtime.adk.adk_app import invalidate_cache

    invalidate_cache("stale")
    assert cache.get_agent("stale") is None
    assert runner_cleaned["value"] is True  # runner now cleaned

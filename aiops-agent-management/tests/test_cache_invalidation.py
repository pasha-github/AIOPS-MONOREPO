"""
Tests for the full cache invalidation flow: agent cache + ADK runner cleanup.

The bug that motivated these tests: cache.remove_agent() was called directly
without _invalidate_runner_cache(), leaving a stale runner alive after an agent
update. invalidate_cache() in adk_app.py is the correct call — it does both.
"""

from src.agent_runtime.adk.adk_app import invalidate_cache
from src.agent_runtime.adk.cache import AgentCache, cache

# ---------------------------------------------------------------------------
# AgentCache unit tests
# ---------------------------------------------------------------------------


def test_cache_singleton():
    a = AgentCache()
    b = AgentCache()
    assert a is b


def test_cache_set_and_get():
    cache.set_agent("x", "agent-obj")
    assert cache.get_agent("x") == "agent-obj"
    cache.remove_agent("x")


def test_cache_get_missing_returns_none():
    cache.remove_agent("nonexistent")
    assert cache.get_agent("nonexistent") is None


def test_cache_remove_existing():
    cache.set_agent("to-remove", object())
    cache.remove_agent("to-remove")
    assert cache.get_agent("to-remove") is None


def test_cache_remove_missing_is_noop():
    # Should not raise
    cache.remove_agent("never-existed")


def test_cache_overwrite():
    obj1 = object()
    obj2 = object()
    cache.set_agent("ow", obj1)
    cache.set_agent("ow", obj2)
    assert cache.get_agent("ow") is obj2
    cache.remove_agent("ow")


def test_cache_multiple_agents_isolated():
    cache.set_agent("a", "agent-a")
    cache.set_agent("b", "agent-b")
    cache.remove_agent("a")
    assert cache.get_agent("a") is None
    assert cache.get_agent("b") == "agent-b"
    cache.remove_agent("b")


# ---------------------------------------------------------------------------
# invalidate_cache() integration tests
# ---------------------------------------------------------------------------


def test_invalidate_cache_noop_when_agent_not_in_cache(monkeypatch):
    cache.remove_agent("ghost")
    runner_called = {"value": False}

    def fake_runner_invalidate(app_name):
        runner_called["value"] = True

    monkeypatch.setattr(
        "src.agent_runtime.adk.adk_app._invalidate_runner_cache",
        fake_runner_invalidate,
    )

    invalidate_cache("ghost")
    assert runner_called["value"] is False


def test_invalidate_cache_removes_from_agent_cache(monkeypatch):
    cache.set_agent("agent-del", object())
    monkeypatch.setattr(
        "src.agent_runtime.adk.adk_app._invalidate_runner_cache", lambda _: None
    )

    invalidate_cache("agent-del")
    assert cache.get_agent("agent-del") is None


def test_invalidate_cache_calls_runner_cleanup(monkeypatch):
    cache.set_agent("agent-run", object())
    called_with = {"app_name": None}

    def fake_runner_invalidate(app_name):
        called_with["app_name"] = app_name

    monkeypatch.setattr(
        "src.agent_runtime.adk.adk_app._invalidate_runner_cache",
        fake_runner_invalidate,
    )

    invalidate_cache("agent-run")
    assert called_with["app_name"] == "agent-run"


def test_invalidate_cache_does_both_steps(monkeypatch):
    """Regression: cache.remove_agent alone (old bug) left runner stale."""
    cache.set_agent("both-steps", object())
    steps = []

    def fake_runner_invalidate(app_name):
        steps.append("runner")

    monkeypatch.setattr(
        "src.agent_runtime.adk.adk_app._invalidate_runner_cache",
        fake_runner_invalidate,
    )

    invalidate_cache("both-steps")

    assert cache.get_agent("both-steps") is None, "agent cache not cleared"
    assert "runner" in steps, "runner cleanup not called"


def test_invalidate_cache_multiple_agents_independent(monkeypatch):
    cache.set_agent("keep", object())
    cache.set_agent("remove-me", object())
    monkeypatch.setattr(
        "src.agent_runtime.adk.adk_app._invalidate_runner_cache", lambda _: None
    )

    invalidate_cache("remove-me")

    assert cache.get_agent("remove-me") is None
    assert cache.get_agent("keep") is not None
    cache.remove_agent("keep")


def test_invalidate_cache_idempotent(monkeypatch):
    """Calling twice on the same id should not raise."""
    cache.set_agent("idem", object())
    monkeypatch.setattr(
        "src.agent_runtime.adk.adk_app._invalidate_runner_cache", lambda _: None
    )

    invalidate_cache("idem")
    invalidate_cache("idem")  # second call: cache miss → noop, no exception

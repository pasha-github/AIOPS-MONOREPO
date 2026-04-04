from src.agent_runtime.adk.adk_app import invalidate_cache
from src.agent_runtime.adk.cache import cache


def test_invalidate_cache_noop_when_agent_not_cached(monkeypatch):
    # Ensure cache miss for this id
    cache.remove_agent("missing-agent")

    called = {"value": False}

    def fake_invalidate_runner_cache(app_name: str):
        called["value"] = True

    monkeypatch.setattr(
        "src.agent_runtime.adk.adk_app._invalidate_runner_cache",
        fake_invalidate_runner_cache,
    )

    invalidate_cache("missing-agent")
    assert called["value"] is False


def test_invalidate_cache_removes_agent_and_marks_runner_cleanup(monkeypatch):
    cache.set_agent("agent-1", object())

    called = {"app_name": None}

    def fake_invalidate_runner_cache(app_name: str):
        called["app_name"] = app_name

    monkeypatch.setattr(
        "src.agent_runtime.adk.adk_app._invalidate_runner_cache",
        fake_invalidate_runner_cache,
    )

    invalidate_cache("agent-1")

    assert cache.get_agent("agent-1") is None
    assert called["app_name"] == "agent-1"

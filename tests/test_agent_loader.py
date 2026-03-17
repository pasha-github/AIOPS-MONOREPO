import os
from types import SimpleNamespace

import pytest

import utils.agent_loader as agent_loader_module
from utils.agent_loader import DatabaseAgentLoader


class _FakeResult:
    def __init__(self, first_value=None, all_value=None):
        self._first_value = first_value
        self._all_value = all_value or []

    def first(self):
        return self._first_value

    def all(self):
        return self._all_value


class _FakeSession:
    def __init__(self, agent_config=None, model_config=None, list_ids=None, connector_map=None):
        self.agent_config = agent_config
        self.model_config = model_config
        self.list_ids = list_ids
        self.connector_map = connector_map or {}

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def exec(self, _statement):
        if self.list_ids is not None:
            return _FakeResult(all_value=self.list_ids)
        return _FakeResult(first_value=self.agent_config)

    def get(self, model_cls, key):
        name = getattr(model_cls, "__name__", "")
        if name == "Model":
            return self.model_config
        if name == "ConnectorConfig":
            return self.connector_map.get(str(key))
        return None


class _FakeCache:
    def __init__(self, initial=None):
        self._store = dict(initial or {})

    def get_agent(self, agent_id):
        return self._store.get(agent_id)

    def set_agent(self, agent_id, agent):
        self._store[agent_id] = agent

    def remove_agent(self, agent_id):
        self._store.pop(agent_id, None)


def _agent_cfg(**kwargs):
    defaults = {
        "agent_id": "main",
        "name": "Main",
        "description": "desc",
        "instruction": "instr",
        "model_id": "m1",
        "tools": None,
        "mcp_servers": [],
        "connector_config_ids": [],
        "sub_agents": [],
        "isEnabled": True,
        "type": "agent",
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _model_cfg(**kwargs):
    defaults = {
        "model_id": "m1",
        "provider": "google",
        "name": "gemini-1.5-pro",
        "api_key": "encrypted-key",
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _patch_common_runtime(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(agent_loader_module, "decrypt_secret", lambda _: "decrypted-key")
    monkeypatch.setattr(agent_loader_module, "resolve_connector_tools", lambda _cfg: ["connector_tool"])
    monkeypatch.setattr(agent_loader_module, "SseConnectionParams", lambda url: {"url": url, "kind": "sse"})
    monkeypatch.setattr(agent_loader_module, "StreamableHTTPConnectionParams", lambda url: {"url": url, "kind": "mcp"})
    monkeypatch.setattr(agent_loader_module, "McpToolset", lambda connection_params: {"mcp": connection_params})
    monkeypatch.setattr(agent_loader_module, "AgentTool", lambda agent: {"sub_agent": agent})

    class _FakeLiteLlm:
        def __init__(self, model):
            self.model = model

    class _FakeLlmAgent:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

    monkeypatch.setattr(agent_loader_module, "LiteLlm", _FakeLiteLlm)
    monkeypatch.setattr(agent_loader_module, "LlmAgent", _FakeLlmAgent)


def test_agent_loader_returns_none_when_agent_missing(monkeypatch: pytest.MonkeyPatch):
    _patch_common_runtime(monkeypatch)
    monkeypatch.setattr(agent_loader_module, "cache", _FakeCache())
    monkeypatch.setattr(agent_loader_module, "Session", lambda _engine: _FakeSession(agent_config=None))

    loader = DatabaseAgentLoader()
    assert loader.load_agent("missing") is None


def test_agent_loader_returns_none_when_agent_disabled(monkeypatch: pytest.MonkeyPatch):
    _patch_common_runtime(monkeypatch)
    cfg = _agent_cfg(isEnabled=False)
    monkeypatch.setattr(agent_loader_module, "cache", _FakeCache())
    monkeypatch.setattr(agent_loader_module, "Session", lambda _engine: _FakeSession(agent_config=cfg))

    loader = DatabaseAgentLoader()
    assert loader.load_agent("main") is None


def test_agent_loader_returns_none_when_model_missing(monkeypatch: pytest.MonkeyPatch):
    _patch_common_runtime(monkeypatch)
    cfg = _agent_cfg(isEnabled=True)
    monkeypatch.setattr(agent_loader_module, "cache", _FakeCache())
    monkeypatch.setattr(
        agent_loader_module, "Session", lambda _engine: _FakeSession(agent_config=cfg, model_config=None)
    )

    loader = DatabaseAgentLoader()
    assert loader.load_agent("main") is None


def test_agent_loader_uses_cache_when_available(monkeypatch: pytest.MonkeyPatch):
    _patch_common_runtime(monkeypatch)
    cached = object()
    fake_cache = _FakeCache(initial={"main": cached})
    monkeypatch.setattr(agent_loader_module, "cache", fake_cache)
    monkeypatch.setattr(agent_loader_module, "Session", lambda _engine: _FakeSession(agent_config=None))

    loader = DatabaseAgentLoader()
    assert loader.load_agent("main") is cached


def test_agent_loader_sets_provider_api_env_var(monkeypatch: pytest.MonkeyPatch):
    _patch_common_runtime(monkeypatch)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    cfg = _agent_cfg()
    model = _model_cfg(provider="google")
    fake_cache = _FakeCache()
    monkeypatch.setattr(agent_loader_module, "cache", fake_cache)
    monkeypatch.setattr(
        agent_loader_module, "Session", lambda _engine: _FakeSession(agent_config=cfg, model_config=model)
    )

    loader = DatabaseAgentLoader()
    agent = loader.load_agent("main")
    assert agent is not None
    assert os.environ.get("GOOGLE_API_KEY") == "decrypted-key"


def test_agent_loader_sets_bedrock_env_var(monkeypatch: pytest.MonkeyPatch):
    _patch_common_runtime(monkeypatch)
    monkeypatch.delenv("AWS_BEARER_TOKEN_BEDROCK", raising=False)
    cfg = _agent_cfg()
    model = _model_cfg(provider="bedrock")
    monkeypatch.setattr(agent_loader_module, "cache", _FakeCache())
    monkeypatch.setattr(
        agent_loader_module, "Session", lambda _engine: _FakeSession(agent_config=cfg, model_config=model)
    )

    loader = DatabaseAgentLoader()
    agent = loader.load_agent("main")
    assert agent is not None
    assert os.environ.get("AWS_BEARER_TOKEN_BEDROCK") == "decrypted-key"


def test_agent_loader_google_model_path(monkeypatch: pytest.MonkeyPatch):
    _patch_common_runtime(monkeypatch)
    cfg = _agent_cfg()
    model = _model_cfg(provider="google", name="gemini-2.0-flash")
    monkeypatch.setattr(agent_loader_module, "cache", _FakeCache())
    monkeypatch.setattr(
        agent_loader_module, "Session", lambda _engine: _FakeSession(agent_config=cfg, model_config=model)
    )

    loader = DatabaseAgentLoader()
    agent = loader.load_agent("main")
    assert agent.kwargs["model"] == "gemini-2.0-flash"


def test_agent_loader_non_google_model_path(monkeypatch: pytest.MonkeyPatch):
    _patch_common_runtime(monkeypatch)
    cfg = _agent_cfg()
    model = _model_cfg(provider="openai", name="gpt-4.1")
    monkeypatch.setattr(agent_loader_module, "cache", _FakeCache())
    monkeypatch.setattr(
        agent_loader_module, "Session", lambda _engine: _FakeSession(agent_config=cfg, model_config=model)
    )

    loader = DatabaseAgentLoader()
    agent = loader.load_agent("main")
    assert getattr(agent.kwargs["model"], "model", "") == "openai/gpt-4.1"


def test_agent_loader_exec_tools_success(monkeypatch: pytest.MonkeyPatch):
    _patch_common_runtime(monkeypatch)
    cfg = _agent_cfg(tools="def my_tool():\n    return 'ok'")
    model = _model_cfg()
    monkeypatch.setattr(agent_loader_module, "cache", _FakeCache())
    monkeypatch.setattr(
        agent_loader_module, "Session", lambda _engine: _FakeSession(agent_config=cfg, model_config=model)
    )

    loader = DatabaseAgentLoader()
    agent = loader.load_agent("main")
    tool_names = [getattr(t, "__name__", "") for t in agent.kwargs["tools"] if callable(t)]
    assert "my_tool" in tool_names


def test_agent_loader_exec_tools_failure_handled(monkeypatch: pytest.MonkeyPatch):
    _patch_common_runtime(monkeypatch)
    cfg = _agent_cfg(tools="def bad(")  # invalid code
    model = _model_cfg()
    monkeypatch.setattr(agent_loader_module, "cache", _FakeCache())
    monkeypatch.setattr(
        agent_loader_module, "Session", lambda _engine: _FakeSession(agent_config=cfg, model_config=model)
    )

    loader = DatabaseAgentLoader()
    agent = loader.load_agent("main")
    assert agent is not None


def test_agent_loader_mcp_url_validation(monkeypatch: pytest.MonkeyPatch):
    _patch_common_runtime(monkeypatch)
    cfg = _agent_cfg(mcp_servers=["http://invalid-url"])
    model = _model_cfg()
    monkeypatch.setattr(agent_loader_module, "cache", _FakeCache())
    monkeypatch.setattr(
        agent_loader_module, "Session", lambda _engine: _FakeSession(agent_config=cfg, model_config=model)
    )

    loader = DatabaseAgentLoader()
    agent = loader.load_agent("main")
    # Invalid MCP URL should be ignored, not crash agent creation.
    assert agent is not None


def test_agent_loader_sub_agent_self_reference_skipped(monkeypatch: pytest.MonkeyPatch):
    _patch_common_runtime(monkeypatch)
    cfg = _agent_cfg(sub_agents=["main"])
    model = _model_cfg()
    monkeypatch.setattr(agent_loader_module, "cache", _FakeCache())
    monkeypatch.setattr(
        agent_loader_module, "Session", lambda _engine: _FakeSession(agent_config=cfg, model_config=model)
    )

    created_sub_wrappers = []
    monkeypatch.setattr(agent_loader_module, "AgentTool", lambda agent: created_sub_wrappers.append(agent) or {"a": agent})

    loader = DatabaseAgentLoader()
    agent = loader.load_agent("main")
    assert agent is not None
    assert created_sub_wrappers == []


def test_agent_loader_duplicate_sub_agents_skipped(monkeypatch: pytest.MonkeyPatch):
    _patch_common_runtime(monkeypatch)
    cfg = _agent_cfg(sub_agents=["sub1", "sub1"])
    model = _model_cfg()
    monkeypatch.setattr(agent_loader_module, "cache", _FakeCache())
    monkeypatch.setattr(
        agent_loader_module, "Session", lambda _engine: _FakeSession(agent_config=cfg, model_config=model)
    )

    original_load_agent = DatabaseAgentLoader.load_agent

    def _wrapped(self, name):
        if name == "main":
            return original_load_agent(self, name)
        return object()

    monkeypatch.setattr(DatabaseAgentLoader, "load_agent", _wrapped)

    wrapped_sub_agents = []
    monkeypatch.setattr(
        agent_loader_module,
        "AgentTool",
        lambda agent: wrapped_sub_agents.append(agent) or {"wrapped": agent},
    )

    loader = DatabaseAgentLoader()
    agent = loader.load_agent("main")
    assert agent is not None
    assert len(wrapped_sub_agents) == 1

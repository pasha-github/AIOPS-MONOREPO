import os
from types import SimpleNamespace
from uuid import uuid4

import pytest

import src.agent_runtime.adk.agent_loader as agent_loader_module
from src.agent_runtime.adk.agent_loader import DatabaseAgentLoader


class _FakeResult:
    def __init__(self, first_value=None, all_value=None):
        self._first_value = first_value
        self._all_value = all_value or []

    def first(self):
        return self._first_value

    def all(self):
        return self._all_value


class _FakeSession:
    def __init__(
        self,
        agent_config=None,
        model_config=None,
        list_ids=None,
        connector_map=None,
        mcp_map=None,
        model_map=None,
        defaults_config=None,
    ):
        self.agent_config = agent_config
        self.model_config = model_config
        self.list_ids = list_ids
        self.connector_map = connector_map or {}
        self.mcp_map = mcp_map or {}
        self.model_map = model_map or {}
        self.defaults_config = defaults_config

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
            if key in self.model_map:
                return self.model_map[key]
            return self.model_config
        if name == "ModelDefaults":
            return self.defaults_config
        if name == "ConnectorConfig":
            return self.connector_map.get(str(key))
        if name == "MCPServer":
            return self.mcp_map.get(str(key))
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
        "primary_use_global": False,
        "primary_model_id": "m1",
        "secondary_use_global": False,
        "secondary_model_id": None,
        "tertiary_use_global": False,
        "tertiary_model_id": None,
        "tools": None,
        "mcp_servers": [],
        "mcp_server_ids": [],
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
    monkeypatch.setattr(
        agent_loader_module, "decrypt_secret", lambda _: "decrypted-key"
    )
    monkeypatch.setattr(
        agent_loader_module, "resolve_connector_tools", lambda _cfg: ["connector_tool"]
    )
    monkeypatch.setattr(
        agent_loader_module,
        "build_mcp_connection_params",
        lambda url, headers=None: {
            "url": url,
            "headers": headers or {},
            "kind": "sse" if url.endswith("/sse") else "mcp",
        },
    )
    monkeypatch.setattr(
        agent_loader_module,
        "build_mcp_auth_headers",
        lambda auth_type, bearer_token=None, username=None, password=None: {
            "auth_type": auth_type,
            "bearer_token": bearer_token,
            "username": username,
            "password": password,
        }
        if auth_type != "none"
        else {},
    )
    monkeypatch.setattr(
        agent_loader_module,
        "McpToolset",
        lambda connection_params: {"mcp": connection_params},
    )
    monkeypatch.setattr(
        agent_loader_module, "AgentTool", lambda agent: {"sub_agent": agent}
    )

    class _FakeLiteLlm:
        def __init__(self, model, **kwargs):
            self.model = model
            self.kwargs = kwargs

    class _FakeLlmAgent:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

    monkeypatch.setattr(agent_loader_module, "LiteLlm", _FakeLiteLlm)
    monkeypatch.setattr(agent_loader_module, "LlmAgent", _FakeLlmAgent)


def test_agent_loader_returns_none_when_agent_missing(monkeypatch: pytest.MonkeyPatch):
    _patch_common_runtime(monkeypatch)
    monkeypatch.setattr(agent_loader_module, "cache", _FakeCache())
    monkeypatch.setattr(
        agent_loader_module, "Session", lambda _engine: _FakeSession(agent_config=None)
    )

    loader = DatabaseAgentLoader()
    assert loader.load_agent("missing") is None


def test_agent_loader_returns_none_when_agent_disabled(monkeypatch: pytest.MonkeyPatch):
    _patch_common_runtime(monkeypatch)
    cfg = _agent_cfg(isEnabled=False)
    monkeypatch.setattr(agent_loader_module, "cache", _FakeCache())
    monkeypatch.setattr(
        agent_loader_module, "Session", lambda _engine: _FakeSession(agent_config=cfg)
    )

    loader = DatabaseAgentLoader()
    assert loader.load_agent("main") is None


def test_agent_loader_returns_none_when_model_missing(monkeypatch: pytest.MonkeyPatch):
    _patch_common_runtime(monkeypatch)
    cfg = _agent_cfg(isEnabled=True)
    monkeypatch.setattr(agent_loader_module, "cache", _FakeCache())
    monkeypatch.setattr(
        agent_loader_module,
        "Session",
        lambda _engine: _FakeSession(agent_config=cfg, model_config=None),
    )

    loader = DatabaseAgentLoader()
    assert loader.load_agent("main") is None


def test_agent_loader_uses_cache_when_available(monkeypatch: pytest.MonkeyPatch):
    _patch_common_runtime(monkeypatch)
    cached = object()
    fake_cache = _FakeCache(initial={"main": cached})
    monkeypatch.setattr(agent_loader_module, "cache", fake_cache)
    monkeypatch.setattr(
        agent_loader_module, "Session", lambda _engine: _FakeSession(agent_config=None)
    )

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
        agent_loader_module,
        "Session",
        lambda _engine: _FakeSession(agent_config=cfg, model_config=model),
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
        agent_loader_module,
        "Session",
        lambda _engine: _FakeSession(agent_config=cfg, model_config=model),
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
        agent_loader_module,
        "Session",
        lambda _engine: _FakeSession(agent_config=cfg, model_config=model),
    )

    loader = DatabaseAgentLoader()
    agent = loader.load_agent("main")
    assert getattr(agent.kwargs["model"], "model", "") == "gemini/gemini-2.0-flash"
    assert agent.kwargs["model"].kwargs["fallbacks"] == []


def test_agent_loader_does_not_attach_session_summary_callback(
    monkeypatch: pytest.MonkeyPatch,
):
    _patch_common_runtime(monkeypatch)
    cfg = _agent_cfg()
    model = _model_cfg(provider="google", name="gemini-2.0-flash")
    monkeypatch.setattr(agent_loader_module, "cache", _FakeCache())
    monkeypatch.setattr(
        agent_loader_module,
        "Session",
        lambda _engine: _FakeSession(agent_config=cfg, model_config=model),
    )

    loader = DatabaseAgentLoader()
    agent = loader.load_agent("main")
    assert "before_model_callback" not in agent.kwargs


def test_agent_loader_non_google_model_path(monkeypatch: pytest.MonkeyPatch):
    _patch_common_runtime(monkeypatch)
    cfg = _agent_cfg()
    model = _model_cfg(provider="openai", name="gpt-4.1")
    monkeypatch.setattr(agent_loader_module, "cache", _FakeCache())
    monkeypatch.setattr(
        agent_loader_module,
        "Session",
        lambda _engine: _FakeSession(agent_config=cfg, model_config=model),
    )

    loader = DatabaseAgentLoader()
    agent = loader.load_agent("main")
    assert getattr(agent.kwargs["model"], "model", "") == "openai/gpt-4.1"
    assert agent.kwargs["model"].kwargs["fallbacks"] == []


def test_agent_loader_exec_tools_success(monkeypatch: pytest.MonkeyPatch):
    _patch_common_runtime(monkeypatch)
    cfg = _agent_cfg(tools="def my_tool():\n    return 'ok'")
    model = _model_cfg()
    monkeypatch.setattr(agent_loader_module, "cache", _FakeCache())
    monkeypatch.setattr(
        agent_loader_module,
        "Session",
        lambda _engine: _FakeSession(agent_config=cfg, model_config=model),
    )

    loader = DatabaseAgentLoader()
    agent = loader.load_agent("main")
    tool_names = [
        getattr(t, "__name__", "") for t in agent.kwargs["tools"] if callable(t)
    ]
    assert "my_tool" in tool_names


def test_agent_loader_exec_tools_failure_handled(monkeypatch: pytest.MonkeyPatch):
    _patch_common_runtime(monkeypatch)
    cfg = _agent_cfg(tools="def bad(")  # invalid code
    model = _model_cfg()
    monkeypatch.setattr(agent_loader_module, "cache", _FakeCache())
    monkeypatch.setattr(
        agent_loader_module,
        "Session",
        lambda _engine: _FakeSession(agent_config=cfg, model_config=model),
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
        agent_loader_module,
        "Session",
        lambda _engine: _FakeSession(agent_config=cfg, model_config=model),
    )

    loader = DatabaseAgentLoader()
    agent = loader.load_agent("main")
    # Invalid MCP URL should be ignored, not crash agent creation.
    assert agent is not None


def test_agent_loader_resolves_registered_mcp_servers(
    monkeypatch: pytest.MonkeyPatch,
):
    _patch_common_runtime(monkeypatch)
    mcp_server_id = str(uuid4())
    cfg = _agent_cfg(mcp_server_ids=[mcp_server_id])
    model = _model_cfg()
    mcp_server = SimpleNamespace(
        mcp_server_id=mcp_server_id,
        server_url="http://localhost:8100/mcp",
        auth_type="bearer",
        auth_username=None,
        auth_secret="encrypted-token",
    )
    monkeypatch.setattr(agent_loader_module, "cache", _FakeCache())
    monkeypatch.setattr(
        agent_loader_module,
        "Session",
        lambda _engine: _FakeSession(
            agent_config=cfg,
            model_config=model,
            mcp_map={mcp_server_id: mcp_server},
        ),
    )

    loader = DatabaseAgentLoader()
    agent = loader.load_agent("main")
    assert agent is not None
    registered_mcp_tools = [
        tool for tool in agent.kwargs["tools"] if isinstance(tool, dict) and "mcp" in tool
    ]
    assert registered_mcp_tools[0]["mcp"]["url"] == "http://localhost:8100/mcp"
    assert registered_mcp_tools[0]["mcp"]["headers"]["auth_type"] == "bearer"


def test_agent_loader_sub_agent_self_reference_skipped(monkeypatch: pytest.MonkeyPatch):
    _patch_common_runtime(monkeypatch)
    cfg = _agent_cfg(sub_agents=["main"])
    model = _model_cfg()
    monkeypatch.setattr(agent_loader_module, "cache", _FakeCache())
    monkeypatch.setattr(
        agent_loader_module,
        "Session",
        lambda _engine: _FakeSession(agent_config=cfg, model_config=model),
    )

    created_sub_wrappers = []
    monkeypatch.setattr(
        agent_loader_module,
        "AgentTool",
        lambda agent: created_sub_wrappers.append(agent) or {"a": agent},
    )

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
        agent_loader_module,
        "Session",
        lambda _engine: _FakeSession(agent_config=cfg, model_config=model),
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


def test_agent_loader_uses_global_defaults_for_model_stack(
    monkeypatch: pytest.MonkeyPatch,
):
    _patch_common_runtime(monkeypatch)
    cfg = _agent_cfg(
        model_id=None,
        primary_use_global=True,
        primary_model_id=None,
        secondary_use_global=True,
        secondary_model_id=None,
        tertiary_use_global=True,
        tertiary_model_id=None,
    )
    primary = _model_cfg(model_id="m1", provider="google", name="gemini-2.0-flash")
    secondary = _model_cfg(model_id="m2", provider="openai", name="gpt-4.1-mini")
    tertiary = _model_cfg(model_id="m3", provider="anthropic", name="claude-haiku")
    defaults = SimpleNamespace(
        primary_model_id="m1",
        secondary_model_id="m2",
        tertiary_model_id="m3",
    )
    monkeypatch.setattr(agent_loader_module, "cache", _FakeCache())
    monkeypatch.setattr(
        agent_loader_module,
        "Session",
        lambda _engine: _FakeSession(
            agent_config=cfg,
            model_map={"m1": primary, "m2": secondary, "m3": tertiary},
            defaults_config=defaults,
        ),
    )

    loader = DatabaseAgentLoader()
    agent = loader.load_agent("main")
    assert getattr(agent.kwargs["model"], "model", "") == "gemini/gemini-2.0-flash"
    assert agent.kwargs["model"].kwargs["fallbacks"] == [
        "openai/gpt-4.1-mini",
        "anthropic/claude-haiku",
    ]

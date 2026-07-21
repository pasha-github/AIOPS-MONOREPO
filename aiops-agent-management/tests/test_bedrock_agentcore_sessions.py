import asyncio
import io
import json
from typing import Any

import pytest
import yaml

from src.agent_runtime.bedrock_agentcore import service
from src.database.models import Agent


class _FakeAgentCoreClient:
    def __init__(self, responses: list[dict[str, Any]]):
        self.responses = responses
        self.calls: list[dict[str, Any]] = []

    def invoke_agent_runtime(self, **kwargs):
        self.calls.append(kwargs)
        body = json.dumps(self.responses.pop(0)).encode("utf-8")
        return {"response": io.BytesIO(body)}


def _agent() -> Agent:
    return Agent(
        agent_id="a1",
        name="Agent 1",
        description="desc",
        instruction="instr",
        deployment_target="bedrock_agentcore",
        bedrock_agentcore_resource_arn="arn:aws:bedrock-agentcore:us-east-1:123:runtime/a1",
    )


def _patch_client(monkeypatch: pytest.MonkeyPatch, fake_client: _FakeAgentCoreClient):
    monkeypatch.setattr(service.boto3, "client", lambda *args, **kwargs: fake_client)


def _payload(call: dict[str, Any]) -> dict[str, Any]:
    return json.loads(call["payload"].decode("utf-8"))


def _expected_runtime_session_id(user_id: str) -> str:
    return service._user_runtime_session_id(_agent(), user_id)


def test_create_session_invokes_agentcore_runtime_action(
    monkeypatch: pytest.MonkeyPatch,
):
    fake_client = _FakeAgentCoreClient([{"session_id": "s1"}])
    _patch_client(monkeypatch, fake_client)

    session_id = asyncio.run(service.create_session(_agent(), user_id="u1"))

    assert session_id == "s1"
    assert (
        fake_client.calls[0]["agentRuntimeArn"]
        == _agent().bedrock_agentcore_resource_arn
    )
    assert fake_client.calls[0]["runtimeSessionId"] == _expected_runtime_session_id(
        "u1"
    )
    assert _payload(fake_client.calls[0]) == {
        "action": "create_session",
        "user_id": "u1",
        "session_id": _payload(fake_client.calls[0])["session_id"],
    }


def test_list_sessions_invokes_agentcore_runtime_action(
    monkeypatch: pytest.MonkeyPatch,
):
    fake_client = _FakeAgentCoreClient(
        [{"sessions": [{"id": "s1", "user_id": "u1", "events": []}]}]
    )
    _patch_client(monkeypatch, fake_client)

    sessions = asyncio.run(service.list_sessions(_agent(), user_id="u1"))

    assert sessions == [{"id": "s1", "user_id": "u1", "events": []}]
    assert fake_client.calls[0]["runtimeSessionId"] == _expected_runtime_session_id(
        "u1"
    )
    assert _payload(fake_client.calls[0]) == {
        "action": "list_sessions",
        "user_id": "u1",
    }


def test_get_session_invokes_agentcore_runtime_action(
    monkeypatch: pytest.MonkeyPatch,
):
    fake_client = _FakeAgentCoreClient(
        [{"session": {"id": "s1", "user_id": "u1", "events": []}}]
    )
    _patch_client(monkeypatch, fake_client)

    session = asyncio.run(service.get_session(_agent(), user_id="u1", session_id="s1"))

    assert session == {"id": "s1", "user_id": "u1", "events": []}
    assert fake_client.calls[0]["runtimeSessionId"] == _expected_runtime_session_id(
        "u1"
    )
    assert _payload(fake_client.calls[0]) == {
        "action": "get_session",
        "user_id": "u1",
        "session_id": "s1",
    }


def test_delete_session_invokes_agentcore_runtime_action(
    monkeypatch: pytest.MonkeyPatch,
):
    fake_client = _FakeAgentCoreClient([{"ok": True, "session_id": "s1"}])
    _patch_client(monkeypatch, fake_client)

    asyncio.run(service.delete_session(_agent(), user_id="u1", session_id="s1"))

    assert fake_client.calls[0]["runtimeSessionId"] == _expected_runtime_session_id(
        "u1"
    )
    assert _payload(fake_client.calls[0]) == {
        "action": "delete_session",
        "user_id": "u1",
        "session_id": "s1",
    }


def test_clear_bedrock_agentcore_config_removes_stale_runtime_ids(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
):
    config_path = tmp_path / ".bedrock_agentcore.yaml"
    build_config_path = (
        tmp_path
        / ".build"
        / "bedrock_agentcore"
        / "cloudflare_agent"
        / ".bedrock_agentcore.yaml"
    )
    build_config_path.parent.mkdir(parents=True)
    config_text = """
default_agent: cloudflare_agent
agents:
  cloudflare_agent:
    bedrock_agentcore:
      agent_id: cloudflare_agent-abc
      agent_arn: arn:aws:bedrock-agentcore:us-east-1:123:runtime/cloudflare_agent-abc
      agent_session_id: session-1
    aws:
      region: us-east-1
"""
    config_path.write_text(
        config_text,
        encoding="utf-8",
    )
    build_config_path.write_text(config_text, encoding="utf-8")
    monkeypatch.setattr(service, "BEDROCK_AGENTCORE_CONFIG_FILE", config_path)
    monkeypatch.setattr(
        service, "BEDROCK_BUILD_ROOT", tmp_path / ".build" / "bedrock_agentcore"
    )

    service._clear_bedrock_agentcore_config("cloudflare_agent")

    for cleared_config_path in (config_path, build_config_path):
        config = yaml.safe_load(cleared_config_path.read_text(encoding="utf-8"))
        bedrock_config = config["agents"]["cloudflare_agent"]["bedrock_agentcore"]
        assert bedrock_config["agent_id"] is None
        assert bedrock_config["agent_arn"] is None
        assert bedrock_config["agent_session_id"] is None
        assert config["agents"]["cloudflare_agent"]["aws"]["region"] == "us-east-1"


def test_prepare_bedrock_agentcore_build_context_stages_minimal_runtime(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
):
    project_root = tmp_path / "project"
    runtime_dir = project_root / "src" / "agent_runtime" / "bedrock_agentcore"
    connectors_dir = project_root / "src" / "connectors"
    build_root = project_root / ".build" / "bedrock_agentcore"

    for directory in (
        runtime_dir,
        connectors_dir,
        project_root / "tests",
        project_root / "docs",
        project_root / "src" / "database",
        project_root / "src" / "agent_runtime" / "adk",
        project_root / "src" / "routers",
    ):
        directory.mkdir(parents=True)

    files = {
        project_root / "src" / "__init__.py": "",
        runtime_dir / "__init__.py": "",
        runtime_dir / "main.py": "print('main')\n",
        runtime_dir / "agent.py": "print('agent')\n",
        runtime_dir / "bedrock_agentcore_requirements.txt": "cloudpickle\n",
        runtime_dir / "Dockerfile": "FROM python:3.12-slim\n",
        connectors_dir / "base_connector.py": "class BaseConnector: pass\n",
        connectors_dir / "datadog_connector.py": "class DatadogConnector: pass\n",
        connectors_dir / "loader.py": "from src.database.models import Agent\n",
        connectors_dir / "connector.md": "# connector docs\n",
        project_root / "tests" / "test_api.py": "def test_api(): pass\n",
        project_root / "docs" / "todo.md": "todo\n",
        project_root / "src" / "database" / "models.py": "class Agent: pass\n",
        project_root / "src" / "agent_runtime" / "adk" / "agent_loader.py": "",
        project_root / "src" / "routers" / "agents.py": "",
        project_root / "main.py": "print('app')\n",
    }
    for path, content in files.items():
        path.write_text(content, encoding="utf-8")

    monkeypatch.setattr(service, "PROJECT_ROOT", project_root)
    monkeypatch.setattr(service, "RUNTIME_APP_DIR", runtime_dir)
    monkeypatch.setattr(service, "CONNECTORS_DIR", connectors_dir)
    monkeypatch.setattr(
        service,
        "ENTRYPOINT_FILE",
        runtime_dir / "main.py",
    )
    monkeypatch.setattr(
        service,
        "REQUIREMENTS_FILE",
        runtime_dir / "bedrock_agentcore_requirements.txt",
    )
    monkeypatch.setattr(service, "DOCKERFILE_FILE", runtime_dir / "Dockerfile")
    monkeypatch.setattr(service, "BEDROCK_BUILD_ROOT", build_root)

    build_context = service._prepare_bedrock_agentcore_build_context("agent_a")

    assert (build_context / "Dockerfile").read_text(encoding="utf-8") == (
        "FROM python:3.12-slim\n"
    )
    assert (build_context / "src" / "__init__.py").exists()
    assert (
        build_context / "src" / "agent_runtime" / "bedrock_agentcore" / "main.py"
    ).exists()
    assert (
        build_context / "src" / "agent_runtime" / "bedrock_agentcore" / "agent.py"
    ).exists()
    assert (
        build_context
        / "src"
        / "agent_runtime"
        / "bedrock_agentcore"
        / "bedrock_agentcore_requirements.txt"
    ).exists()
    assert (build_context / "src" / "connectors" / "base_connector.py").exists()
    assert (build_context / "src" / "connectors" / "datadog_connector.py").exists()

    assert not (build_context / "src" / "connectors" / "loader.py").exists()
    assert not (build_context / "src" / "connectors" / "connector.md").exists()
    assert not (build_context / "tests").exists()
    assert not (build_context / "docs").exists()
    assert not (build_context / "src" / "database").exists()
    assert not (build_context / "src" / "agent_runtime" / "adk").exists()
    assert not (build_context / "src" / "routers").exists()
    assert not (build_context / "main.py").exists()

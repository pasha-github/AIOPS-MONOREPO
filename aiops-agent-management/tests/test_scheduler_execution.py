"""
Tests for scheduler job execution logic — _check_api_conditions and execute_job.
These use mocking to avoid real HTTP calls and DB/agent invocations.
"""

import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest


def _fake_job(url=None, conditions=None, condition_operator="AND", job_id="j1"):
    """Return a minimal job-like object for scheduler tests."""
    return SimpleNamespace(
        url=url,
        method="GET",
        headers={},
        body=None,
        conditions=conditions or [],
        condition_operator=condition_operator,
        job_id=job_id,
    )


def _fake_http_client(status_code=200, json_body=None, raise_exc=None):
    """Return a fake httpx.AsyncClient context manager."""
    _json_body = json_body if json_body is not None else {}

    class FakeResponse:
        def __init__(self):
            self.status_code = status_code

        def json(self):
            if raise_exc:
                raise raise_exc
            return _json_body

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def request(self, **kwargs):
            if raise_exc and isinstance(raise_exc, ConnectionError):
                raise raise_exc
            return FakeResponse()

    return FakeClient


# ---------------------------------------------------------------------------
# _check_api_conditions
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_check_api_conditions_no_url_returns_true():
    from src.utils.scheduler import _check_api_conditions

    assert await _check_api_conditions(_fake_job(url=None)) is True


@pytest.mark.anyio
async def test_check_api_conditions_passes_when_conditions_met(monkeypatch):
    import httpx

    from src.utils.scheduler import _check_api_conditions

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: _fake_http_client(200)())
    job = _fake_job(
        url="http://example.com/api",
        conditions=[{"type": "status_code", "operator": "eq", "value": 200}],
    )
    assert await _check_api_conditions(job) is True


@pytest.mark.anyio
async def test_check_api_conditions_fails_when_conditions_not_met(monkeypatch):
    import httpx

    from src.utils.scheduler import _check_api_conditions

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: _fake_http_client(500)())
    job = _fake_job(
        url="http://example.com/api",
        conditions=[{"type": "status_code", "operator": "eq", "value": 200}],
    )
    assert await _check_api_conditions(job) is False


@pytest.mark.anyio
async def test_check_api_conditions_non_json_response_uses_empty_body(monkeypatch):
    """Non-JSON responses must not crash — body falls back to {}."""
    import httpx

    from src.utils.scheduler import _check_api_conditions

    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kwargs: _fake_http_client(200, raise_exc=ValueError("not json"))(),
    )
    # conditions empty → always True regardless of body
    job = _fake_job(url="http://example.com/api")
    assert await _check_api_conditions(job) is True


@pytest.mark.anyio
async def test_check_api_conditions_network_error_returns_false(monkeypatch):
    """Network failures must return False, not raise."""
    import httpx

    from src.utils.scheduler import _check_api_conditions

    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kwargs: _fake_http_client(raise_exc=ConnectionError("down"))(),
    )
    job = _fake_job(url="http://example.com/api")
    assert await _check_api_conditions(job) is False


# ---------------------------------------------------------------------------
# execute_job
# ---------------------------------------------------------------------------


@pytest.mark.anyio
async def test_execute_job_skips_when_job_not_in_db(monkeypatch):
    """Job deleted after scheduling must be skipped without error."""
    from src.utils import scheduler as sched_module

    monkeypatch.setattr(
        sched_module, "Session", lambda engine: _FakeSessionCtx(job=None)
    )

    invoked = []

    async def fake_invoke(agent_id, prompt):
        invoked.append(agent_id)

    monkeypatch.setattr(sched_module, "invoke_agent_session", fake_invoke)

    await sched_module.execute_job(
        "agent-x", "hello", "00000000-0000-0000-0000-000000000000"
    )
    assert invoked == []


@pytest.mark.anyio
async def test_execute_job_invokes_agent_when_no_url(monkeypatch):
    """Jobs without a URL condition must always invoke the agent."""
    from src.utils import scheduler as sched_module

    fake_job = MagicMock()
    fake_job.url = None
    fake_job.agent_id = "agent-1"
    fake_job.prompt = "run now"
    fake_job.job_id = uuid.UUID("00000000-0000-0000-0000-000000000001")

    monkeypatch.setattr(
        sched_module, "Session", lambda engine: _FakeSessionCtx(job=fake_job)
    )

    invoked = []

    async def fake_invoke(agent_id, prompt):
        invoked.append((agent_id, prompt))

    monkeypatch.setattr(sched_module, "invoke_agent_session", fake_invoke)

    await sched_module.execute_job(
        "agent-1", "run now", "00000000-0000-0000-0000-000000000001"
    )
    assert invoked == [("agent-1", "run now")]


@pytest.mark.anyio
async def test_execute_job_skips_agent_when_conditions_fail(monkeypatch):
    """Jobs with failing API conditions must not invoke the agent."""
    from src.utils import scheduler as sched_module

    fake_job = MagicMock()
    fake_job.url = "http://example.com"
    fake_job.agent_id = "agent-2"
    fake_job.prompt = "check"
    fake_job.job_id = uuid.UUID("00000000-0000-0000-0000-000000000002")

    monkeypatch.setattr(
        sched_module, "Session", lambda engine: _FakeSessionCtx(job=fake_job)
    )

    async def fake_check_api(job):
        return False

    monkeypatch.setattr(sched_module, "_check_api_conditions", fake_check_api)

    invoked = []

    async def fake_invoke(agent_id, prompt):
        invoked.append(agent_id)

    monkeypatch.setattr(sched_module, "invoke_agent_session", fake_invoke)

    await sched_module.execute_job(
        "agent-2", "check", "00000000-0000-0000-0000-000000000002"
    )
    assert invoked == []


@pytest.mark.anyio
async def test_execute_job_catches_exception_without_raising(monkeypatch):
    """execute_job must not let exceptions propagate — scheduler would stop."""
    from src.utils import scheduler as sched_module

    fake_job = MagicMock()
    fake_job.url = None
    fake_job.job_id = uuid.UUID("00000000-0000-0000-0000-000000000003")

    monkeypatch.setattr(
        sched_module, "Session", lambda engine: _FakeSessionCtx(job=fake_job)
    )

    async def fake_invoke(agent_id, prompt):
        raise RuntimeError("agent exploded")

    monkeypatch.setattr(sched_module, "invoke_agent_session", fake_invoke)

    # Must not raise
    await sched_module.execute_job(
        "agent-3", "prompt", "00000000-0000-0000-0000-000000000003"
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


class _FakeSessionCtx:
    """Minimal context manager that returns a fixed job from session.get()."""

    def __init__(self, job):
        self._job = job

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def get(self, model, pk):
        return self._job

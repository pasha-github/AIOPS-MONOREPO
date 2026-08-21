"""
Tests for scheduled job CRUD and scheduler trigger building.
"""

import pytest
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from fastapi.testclient import TestClient

from src.utils.scheduler import build_job_trigger

# ---------------------------------------------------------------------------
# build_job_trigger unit tests (no DB / HTTP needed)
# ---------------------------------------------------------------------------


def _make_job(**kwargs):
    """Return a minimal Job-like object for trigger tests."""

    class FakeJob:
        pass

    j = FakeJob()
    j.cron_expression = kwargs.get("cron_expression")
    j.interval_seconds = kwargs.get("interval_seconds")
    return j


def test_build_job_trigger_cron():
    job = _make_job(cron_expression="*/5 * * * *")
    trigger = build_job_trigger(job)
    assert isinstance(trigger, CronTrigger)


def test_build_job_trigger_interval():
    job = _make_job(interval_seconds=30)
    trigger = build_job_trigger(job)
    assert isinstance(trigger, IntervalTrigger)


def test_build_job_trigger_cron_takes_priority_over_interval():
    job = _make_job(cron_expression="0 * * * *", interval_seconds=60)
    trigger = build_job_trigger(job)
    assert isinstance(trigger, CronTrigger)


def test_build_job_trigger_invalid_cron_raises():
    job = _make_job(cron_expression="/5 * * * *")
    with pytest.raises(ValueError, match="Invalid cron_expression"):
        build_job_trigger(job)


def test_build_job_trigger_no_schedule_raises():
    job = _make_job()
    with pytest.raises(ValueError, match="Either cron_expression or interval_seconds"):
        build_job_trigger(job)


def test_build_job_trigger_various_valid_crons():
    valid = [
        "0 0 * * *",  # daily midnight
        "*/15 * * * *",  # every 15 min
        "0 9 * * 1",  # Monday 9am
        "0 12 1 * *",  # 1st of month noon
    ]
    for expr in valid:
        job = _make_job(cron_expression=expr)
        assert isinstance(build_job_trigger(job), CronTrigger), f"Failed for: {expr}"


# ---------------------------------------------------------------------------
# Job API endpoint tests
# ---------------------------------------------------------------------------


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


# Creation


def test_create_job_cron_returns_job_id(client: TestClient):
    _create_model(client)
    _create_automation_agent(client)
    res = client.post(
        "/agent/a-auto/jobs",
        json={"prompt": "check status", "cron_expression": "*/5 * * * *"},
    )
    assert res.status_code == 200
    assert "job_id" in res.json()


def test_create_job_interval_returns_job_id(client: TestClient):
    _create_model(client)
    _create_automation_agent(client)
    res = client.post(
        "/agent/a-auto/jobs",
        json={"prompt": "ping", "interval_seconds": 60},
    )
    assert res.status_code == 200
    assert "job_id" in res.json()


def test_create_job_stores_prompt(client: TestClient):
    _create_model(client)
    _create_automation_agent(client)
    client.post(
        "/agent/a-auto/jobs",
        json={"prompt": "stored prompt", "interval_seconds": 120},
    )
    jobs = client.get("/agent/a-auto/jobs").json()
    assert any(j["prompt"] == "stored prompt" for j in jobs)


def test_create_job_invalid_cron_returns_400(client: TestClient):
    _create_model(client)
    _create_automation_agent(client)
    res = client.post(
        "/agent/a-auto/jobs",
        json={"prompt": "bad", "cron_expression": "not-a-cron"},
    )
    assert res.status_code == 400
    assert "Invalid cron_expression" in res.json()["detail"]


def test_create_job_missing_schedule_returns_400(client: TestClient):
    _create_model(client)
    _create_automation_agent(client)
    res = client.post("/agent/a-auto/jobs", json={"prompt": "no schedule"})
    assert res.status_code == 400


def test_create_job_agent_not_found_returns_error(client: TestClient):
    res = client.post(
        "/agent/ghost/jobs",
        json={"prompt": "x", "interval_seconds": 60},
    )
    assert res.status_code in (400, 404)


def test_create_job_invalid_cron_not_persisted(client: TestClient):
    _create_model(client)
    _create_automation_agent(client)
    client.post(
        "/agent/a-auto/jobs",
        json={"prompt": "bad", "cron_expression": "/5 * * * *"},
    )
    assert client.get("/agent/a-auto/jobs").json() == []


# Listing


def test_list_jobs_empty_initially(client: TestClient):
    _create_model(client)
    _create_automation_agent(client)
    res = client.get("/agent/a-auto/jobs")
    assert res.status_code == 200
    assert res.json() == []


def test_list_jobs_returns_created_jobs(client: TestClient):
    _create_model(client)
    _create_automation_agent(client)
    client.post(
        "/agent/a-auto/jobs",
        json={"prompt": "j1", "interval_seconds": 60},
    )
    client.post(
        "/agent/a-auto/jobs",
        json={"prompt": "j2", "cron_expression": "0 * * * *"},
    )
    res = client.get("/agent/a-auto/jobs")
    assert res.status_code == 200
    assert len(res.json()) == 2


def test_list_jobs_isolated_per_agent(client: TestClient):
    _create_model(client)
    _create_automation_agent(client, "ag1")
    _create_automation_agent(client, "ag2")
    client.post(
        "/agent/ag1/jobs",
        json={"prompt": "only ag1", "interval_seconds": 60},
    )
    assert client.get("/agent/ag2/jobs").json() == []


# Deletion


def test_delete_job_success(client: TestClient):
    _create_model(client)
    _create_automation_agent(client)
    j_id = client.post(
        "/agent/a-auto/jobs",
        json={"prompt": "bye", "interval_seconds": 60},
    ).json()["job_id"]
    res = client.delete(f"/agent/a-auto/jobs/{j_id}")
    assert res.status_code == 200
    assert client.get("/agent/a-auto/jobs").json() == []


def test_delete_job_not_found_returns_404(client: TestClient):
    _create_model(client)
    _create_automation_agent(client)
    res = client.delete("/agent/a-auto/jobs/00000000-0000-0000-0000-000000000000")
    assert res.status_code == 404


def test_delete_one_job_leaves_others(client: TestClient):
    _create_model(client)
    _create_automation_agent(client)
    id1 = client.post(
        "/agent/a-auto/jobs", json={"prompt": "keep", "interval_seconds": 60}
    ).json()["job_id"]
    id2 = client.post(
        "/agent/a-auto/jobs", json={"prompt": "gone", "interval_seconds": 90}
    ).json()["job_id"]
    client.delete(f"/agent/a-auto/jobs/{id2}")
    remaining = client.get("/agent/a-auto/jobs").json()
    assert len(remaining) == 1
    assert remaining[0]["job_id"] == id1

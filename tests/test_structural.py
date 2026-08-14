"""
Structural regression tests — assert that critical functions are written
in a specific way that cannot be verified by behavior alone.

Each test here exists because a real bug was caused (or could be caused)
by a developer refactoring the implementation in a way that silently breaks
async safety, error handling, or cache consistency.
"""

import inspect

import src.routers.agents as agents_module
import src.utils.scheduler as scheduler_module

# ---------------------------------------------------------------------------
# Webhook invocation — must be a background task
# ---------------------------------------------------------------------------


def test_invoke_webhook_uses_background_task_not_direct_await():
    """
    Regression: a PR replaced background_tasks.add_task() with a direct await,
    making webhook invocations block the HTTP response and breaking async behaviour.
    """
    source = inspect.getsource(agents_module.invoke_webhook)
    assert "background_tasks.add_task" in source, (
        "invoke_webhook must enqueue via background_tasks.add_task — "
        "direct await blocks the response and removes async invocation"
    )


# ---------------------------------------------------------------------------
# Background wrapper — must catch all exceptions
# ---------------------------------------------------------------------------


def test_invoke_agent_session_background_has_exception_handler():
    """
    Background tasks run outside the request/response cycle — unhandled
    exceptions are silently swallowed by FastAPI. The wrapper must catch
    and log them, otherwise failures are invisible.
    """
    source = inspect.getsource(agents_module._invoke_agent_session_background)
    assert "except" in source, (
        "_invoke_agent_session_background must have a try/except — "
        "unhandled exceptions in background tasks are silently dropped"
    )


def test_invoke_agent_session_background_logs_on_exception():
    """Errors must be logged, not just caught and ignored."""
    source = inspect.getsource(agents_module._invoke_agent_session_background)
    assert "logger.error" in source, (
        "_invoke_agent_session_background must log errors — "
        "silent except blocks make failures invisible in production"
    )


# ---------------------------------------------------------------------------
# Agent update — must invalidate cache
# ---------------------------------------------------------------------------


def test_update_agent_calls_invalidate_cache_not_remove_agent():
    """
    Regression: cache.remove_agent() was called directly instead of
    invalidate_cache(), leaving the ADK runner stale after an agent update.
    invalidate_cache() does both: removes from cache AND cleans up the runner.
    """
    source = inspect.getsource(agents_module.update_agent)
    assert "invalidate_cache" in source, (
        "update_agent must call invalidate_cache() — "
        "cache.remove_agent() alone leaves the ADK runner stale"
    )
    assert "cache.remove_agent" not in source, (
        "update_agent must not call cache.remove_agent() directly — "
        "use invalidate_cache() which also cleans up the runner"
    )


def test_delete_agent_calls_invalidate_cache_not_remove_agent():
    """
    delete_agent must call invalidate_cache() to clean up both the agent
    cache and the ADK runner. Without this, a deleted agent's runner stays
    alive and can still receive requests.
    """
    source = inspect.getsource(agents_module.delete_agent)
    assert "invalidate_cache" in source, (
        "delete_agent must call invalidate_cache() — "
        "without it the ADK runner for the deleted agent stays alive"
    )
    assert "cache.remove_agent" not in source, (
        "delete_agent must not call cache.remove_agent() directly — "
        "use invalidate_cache() which also cleans up the runner"
    )


# ---------------------------------------------------------------------------
# Scheduler — execute_job must await invoke_agent_session
# ---------------------------------------------------------------------------


def test_execute_job_awaits_invoke_agent_session():
    """
    execute_job must await invoke_agent_session, not call it synchronously.
    A sync call would return a coroutine object without executing it,
    silently doing nothing.
    """
    source = inspect.getsource(scheduler_module.execute_job)
    assert "await invoke_agent_session" in source, (
        "execute_job must await invoke_agent_session — "
        "a non-awaited call returns a coroutine and silently does nothing"
    )


def test_execute_job_has_exception_handler():
    """
    Scheduler jobs run outside any request context — unhandled exceptions
    crash the job silently. execute_job must catch all exceptions and log them.
    """
    source = inspect.getsource(scheduler_module.execute_job)
    assert "except" in source, (
        "execute_job must have a try/except — "
        "unhandled exceptions in scheduler jobs crash silently"
    )


def test_execute_job_logs_on_exception():
    """Scheduler errors must be logged so ops can detect failed jobs."""
    source = inspect.getsource(scheduler_module.execute_job)
    assert "logger.error" in source, (
        "execute_job must log errors — "
        "silent failures in scheduled jobs are undetectable in production"
    )


# ---------------------------------------------------------------------------
# Scheduler — execute_job must check job existence before running
# ---------------------------------------------------------------------------


def test_execute_job_checks_job_exists_before_invoking():
    """
    execute_job receives a job_id string from APScheduler. If the job was
    deleted from the DB after being scheduled, it must skip gracefully
    rather than invoking the agent with a phantom job.
    """
    source = inspect.getsource(scheduler_module.execute_job)
    assert "job is None" in source or "if not job" in source, (
        "execute_job must guard against missing jobs — "
        "a deleted job must be skipped, not cause a runtime error"
    )


# ---------------------------------------------------------------------------
# Scheduler trigger builder — must raise on missing schedule
# ---------------------------------------------------------------------------


def test_build_job_trigger_raises_on_no_schedule():
    """
    build_job_trigger must raise ValueError when neither cron_expression
    nor interval_seconds is provided — not silently return None or a
    default trigger that fires unexpectedly.
    """
    source = inspect.getsource(scheduler_module.build_job_trigger)
    assert "raise ValueError" in source, (
        "build_job_trigger must raise ValueError when no schedule is given — "
        "returning None or a default trigger causes silent misfires"
    )


# ---------------------------------------------------------------------------
# Background wrapper — must call invoke_agent_session
# ---------------------------------------------------------------------------


def test_invoke_agent_session_background_calls_invoke_agent_session():
    """
    If someone replaces invoke_agent_session with another function inside
    the background wrapper, background webhooks silently call nothing useful.
    """
    source = inspect.getsource(agents_module._invoke_agent_session_background)
    assert "invoke_agent_session" in source, (
        "_invoke_agent_session_background must call invoke_agent_session — "
        "swapping it out silently breaks all webhook/background invocations"
    )


# ---------------------------------------------------------------------------
# execute_job — must call invoke_agent_session
# ---------------------------------------------------------------------------


def test_execute_job_calls_invoke_agent_session():
    """
    execute_job must call invoke_agent_session to actually run the agent.
    Replacing it with another function silently breaks all scheduled jobs.
    """
    source = inspect.getsource(scheduler_module.execute_job)
    assert "invoke_agent_session" in source, (
        "execute_job must call invoke_agent_session — "
        "swapping it out silently breaks all scheduled job invocations"
    )


# ---------------------------------------------------------------------------
# reload_jobs — must clear old jobs before reloading
# ---------------------------------------------------------------------------


def test_reload_jobs_removes_all_jobs_before_reloading():
    """
    reload_jobs must call scheduler.remove_all_jobs() before adding new ones.
    Without this, deleted jobs keep firing after a reload.
    """
    source = inspect.getsource(scheduler_module.reload_jobs)
    assert "remove_all_jobs" in source, (
        "reload_jobs must call scheduler.remove_all_jobs() — "
        "without it deleted jobs keep firing after a reload"
    )


def test_reload_jobs_returns_early_when_scheduler_not_running():
    """
    reload_jobs must guard against calling scheduler methods when not running —
    APScheduler raises if you call remove_all_jobs() on a stopped scheduler.
    """
    source = inspect.getsource(scheduler_module.reload_jobs)
    assert "scheduler.running" in source, (
        "reload_jobs must check scheduler.running before acting — "
        "calling remove_all_jobs on a stopped scheduler raises"
    )

import asyncio
import logging
from uuid import UUID

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlmodel import Session, select

from src.database.database import engine
from src.database.models import Job
from src.routers.agents import invoke_agent_session
from src.utils.condition_evaluator import evaluate_conditions

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

scheduler = AsyncIOScheduler()
_background_tasks = set()


def build_job_trigger(job: Job):
    if job.cron_expression:
        try:
            return CronTrigger.from_crontab(job.cron_expression)
        except ValueError as exc:
            raise ValueError(
                f"Invalid cron_expression '{job.cron_expression}': {exc}"
            ) from exc
    if job.interval_seconds:
        return IntervalTrigger(seconds=job.interval_seconds)
    raise ValueError("Either cron_expression or interval_seconds must be provided")


async def _check_api_conditions(job: Job) -> bool:
    """Call the configured URL and evaluate conditions. Returns True if agent should fire."""
    if not job.url:
        return True
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method=job.method or "GET",
                url=job.url,
                headers=job.headers or {},
                json=job.body,
            )
        try:
            body = response.json()
        except Exception:
            body = {}

        passed = evaluate_conditions(
            conditions=job.conditions or [],
            operator=job.condition_operator or "AND",
            status_code=response.status_code,
            body=body,
        )
        logger.info(
            "[SCHEDULER] Job %s API check %s (status=%s)",
            job.job_id,
            "PASSED" if passed else "SKIPPED",
            response.status_code,
        )
        return passed
    except Exception as exc:
        logger.error("Job %s API check failed: %s", job.job_id, exc)
        return False


async def execute_job(agent_id: str, prompt: str, job_id: str):
    logger.info("[SCHEDULER] Job %s firing for agent %s", job_id, agent_id)
    try:
        with Session(engine) as session:
            job = session.get(Job, UUID(job_id))
            if job is None:
                logger.warning("[SCHEDULER] Job %s not found — skipping", job_id)
                return

        if job.url and not await _check_api_conditions(job):
            return

        logger.info("[SCHEDULER] Job %s invoking agent %s", job_id, agent_id)
        await invoke_agent_session(agent_id, prompt)
        logger.info("[SCHEDULER] Job %s completed", job_id)
    except Exception as e:
        logger.error("[SCHEDULER] Job %s failed: %s", job_id, e)


async def reload_jobs():
    """Clear existing jobs and reload from database"""
    if not scheduler.running:
        return

    scheduler.remove_all_jobs()

    with Session(engine) as session:
        jobs = session.exec(select(Job)).all()
        for job in jobs:
            job_id_str = str(job.job_id)
            trigger = build_job_trigger(job)

            scheduler.add_job(
                execute_job,
                trigger=trigger,
                args=[job.agent_id, job.prompt, job_id_str],
                id=job_id_str,
                replace_existing=True,
            )

    total = len(scheduler.get_jobs())
    logger.info("[SCHEDULER] Reloaded — %d job(s) active", total)


def start_scheduler() -> None:
    if not scheduler.running:
        scheduler.start()
        try:
            loop = asyncio.get_running_loop()
            task = loop.create_task(reload_jobs())
            _background_tasks.add(task)
            task.add_done_callback(_background_tasks.discard)
        except RuntimeError:
            pass

import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlmodel import Session, select

from database.database import engine
from database.models import Job
from routers.agents import invoke_agent_session

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


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


async def execute_job(agent_id: str, prompt: dict):
    try:
        await invoke_agent_session(agent_id, prompt)
    except Exception as e:
        logger.error(f"Failed to execute job for agent {agent_id}: {e}")


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
                args=[job.agent_id, job.prompt],
                id=job_id_str,
                replace_existing=True,
            )


def start_scheduler():
    if not scheduler.running:
        scheduler.start()
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(reload_jobs())
        except RuntimeError:
            pass

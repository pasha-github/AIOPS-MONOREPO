import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlmodel import Session, select
from database.database import engine
from database.models import Job
from routers.agents import invoke_agent_session
import asyncio

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

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
            if job.cron_expression:
                trigger = CronTrigger.from_crontab(job.cron_expression)
            elif job.interval_seconds:
                trigger = IntervalTrigger(seconds=job.interval_seconds)
            else:
                continue
                
            scheduler.add_job(
                execute_job,
                trigger=trigger,
                args=[job.agent_id, job.prompt],
                id=job_id_str,
                replace_existing=True
            )

def start_scheduler():
    if not scheduler.running:
        scheduler.start()
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(reload_jobs())
        except RuntimeError:
            pass

import json
import logging
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from google.genai import types
from pydantic import BaseModel
from sqlmodel import Session, select

from database.database import get_session
from database.models import Agent, Job, Model, Webhook
from utils.adk_app import adk_web_server_instance, invalidate_cache

router = APIRouter(prefix="/agent", tags=["agent"])
TEMPLATES_FILE = (
    Path(__file__).resolve().parent.parent / "static" / "agent_templates.json"
)

logger = logging.getLogger(__name__)


class AgentCreate(BaseModel):
    agent_id: str
    name: str
    description: str
    instruction: str
    model_id: str
    tools: str | None = None
    mcp_servers: list[str] = []
    connector_config_ids: list[str] = []
    isEnabled: bool = True
    sub_agents: list[str] = []
    type: str | None = "agent"


class AgentPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    instruction: str | None = None
    model_id: str | None = None
    tools: str | None = None
    mcp_servers: list[str] | None = None
    connector_config_ids: list[str] | None = None
    isEnabled: bool | None = None
    sub_agents: list[str] | None = None


class WebhookCreate(BaseModel):
    prompt: str


class WebhookResponse(BaseModel):
    webhook_id: UUID
    agent_id: str
    prompt: str


class JobCreate(BaseModel):
    prompt: str
    cron_expression: str | None = None
    interval_seconds: int | None = None


class JobResponse(BaseModel):
    job_id: UUID
    agent_id: str
    prompt: str
    cron_expression: str | None = None
    interval_seconds: int | None = None


class WebhookInvoke(BaseModel):
    prompt: str | None = None


class AgentTemplate(BaseModel):
    template_id: str
    name: str
    description: str
    instruction: str


@router.get("/templates", response_model=list[AgentTemplate])
def list_agent_templates():
    with TEMPLATES_FILE.open("r", encoding="utf-8") as templates_file:
        templates = json.load(templates_file)
    return templates


@router.post("/", response_model=Agent)
def create_agent(agent: AgentCreate, session: Session = Depends(get_session)):
    if session.get(Agent, agent.agent_id):
        raise HTTPException(status_code=409, detail="Agent already exists")

    if not session.get(Model, agent.model_id):
        raise HTTPException(status_code=400, detail="Invalid model_id")

    db_agent = Agent.model_validate(agent)
    session.add(db_agent)
    session.commit()
    session.refresh(db_agent)
    return db_agent


@router.get("/", response_model=list[Agent])
def list_agents(session: Session = Depends(get_session)):
    agents = session.exec(select(Agent)).all()
    return agents


@router.patch("/{agent_id}", response_model=Agent)
def update_agent(
    agent_id: str, patch_data: AgentPatch, session: Session = Depends(get_session)
):
    agent = session.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    updates = patch_data.model_dump(exclude_unset=True)
    if "model_id" in updates and (
        updates["model_id"] is None or not session.get(Model, updates["model_id"])
    ):
        raise HTTPException(status_code=400, detail="Invalid model_id")

    for key, value in updates.items():
        setattr(agent, key, value)

    session.add(agent)
    session.commit()
    session.refresh(agent)

    invalidate_cache(agent.agent_id)
    return agent


@router.delete("/{agent_id}")
def delete_agent(agent_id: str, session: Session = Depends(get_session)):
    agent = session.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    session.delete(agent)
    session.commit()
    # Remove from cache
    # Since cache keys might be names or IDs, we should be consistent.
    # AgentLoader uses names for set/get. Models have IDs.
    # If agent_id != name, we need to know the name to remove from cache.
    # Assuming we remove by name as that's what loader uses.
    if agent.agent_id:
        invalidate_cache(agent.agent_id)

    return {"ok": True}


# --- Webhooks ---
@router.post("/{agent_id}/webhooks", response_model=WebhookResponse)
def create_webhook(
    agent_id: str, webhook: WebhookCreate, session: Session = Depends(get_session)
):
    agent = session.get(Agent, agent_id)
    if not agent or agent.type != "automation":
        raise HTTPException(
            status_code=400, detail="Agent not found or not an automation agent"
        )
    db_webhook = Webhook(agent_id=agent_id, prompt=webhook.prompt)
    session.add(db_webhook)
    session.commit()
    session.refresh(db_webhook)
    return db_webhook


@router.get("/{agent_id}/webhook", response_model=list[WebhookResponse])
def list_webhooks(agent_id: str, session: Session = Depends(get_session)):
    webhooks = session.exec(select(Webhook).where(Webhook.agent_id == agent_id)).all()
    return webhooks


@router.delete("/{agent_id}/webhook/{webhook_id}")
def delete_webhook(
    agent_id: str, webhook_id: UUID, session: Session = Depends(get_session)
):
    webhook = session.get(Webhook, webhook_id)
    if not webhook or webhook.agent_id != agent_id:
        raise HTTPException(status_code=404, detail="Webhook not found")
    session.delete(webhook)
    session.commit()
    return {"ok": True}


async def invoke_agent_session(agent_id: str, prompt: str):
    user_id = "user"

    session_res = await adk_web_server_instance.session_service.create_session(
        app_name=agent_id, user_id=user_id
    )

    session_id = session_res.id

    runner = await adk_web_server_instance.get_runner_async(agent_id)
    events = []
    try:
        async for event in runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=types.Content(role="user", parts=[types.Part(text=prompt)]),
        ):
            events.append(event)
    except Exception as e:
        logger.error(e)

    return events


@router.post("/{agent_id}/webhook/invoke/{webhook_id}")
async def invoke_webhook(
    agent_id: str,
    webhook_id: UUID,
    session: Session = Depends(get_session),
    body: WebhookInvoke | None = None,
):
    webhook = session.get(Webhook, webhook_id)
    if not webhook or webhook.agent_id != agent_id:
        raise HTTPException(status_code=404, detail="Webhook not found")
    try:
        final_prompt = body.prompt if body and body.prompt else webhook.prompt
        result = await invoke_agent_session(agent_id, final_prompt)
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# --- Jobs ---
@router.post("/{agent_id}/jobs", response_model=JobResponse)
async def create_job(
    agent_id: str, job: JobCreate, session: Session = Depends(get_session)
):
    agent = session.get(Agent, agent_id)
    if not agent or agent.type != "automation":
        raise HTTPException(
            status_code=400, detail="Agent not found or not an automation agent"
        )
    if not job.cron_expression and not job.interval_seconds:
        raise HTTPException(
            status_code=400,
            detail="Either cron_expression or interval_seconds must be provided",
        )

    from utils.scheduler import build_job_trigger

    try:
        build_job_trigger(
            Job(
                agent_id=agent_id,
                prompt=job.prompt,
                cron_expression=job.cron_expression,
                interval_seconds=job.interval_seconds,
            )
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    db_job = Job(
        agent_id=agent_id,
        prompt=job.prompt,
        cron_expression=job.cron_expression,
        interval_seconds=job.interval_seconds,
    )
    session.add(db_job)
    session.commit()
    session.refresh(db_job)

    from utils.scheduler import reload_jobs

    await reload_jobs()

    return db_job


@router.get("/{agent_id}/jobs", response_model=list[JobResponse])
def list_jobs(agent_id: str, session: Session = Depends(get_session)):
    jobs = session.exec(select(Job).where(Job.agent_id == agent_id)).all()
    return jobs


@router.delete("/{agent_id}/jobs/{job_id}")
async def delete_job(
    agent_id: str, job_id: UUID, session: Session = Depends(get_session)
):
    from utils.cache import cache
    from utils.scheduler import scheduler

    job = session.get(Job, job_id)
    if not job or job.agent_id != agent_id:
        raise HTTPException(status_code=404, detail="Job not found")
    logger.info("BEFORE DELETE")
    logger.info(
        f"[DeleteJob] agent_id={agent_id} job_id={job_id} "
        f"agent_cached={cache.get_agent(agent_id) is not None} "
        f"cache_keys={list(cache._cache.keys())} "
        f"scheduler_job_present={scheduler.get_job(str(job_id)) is not None if scheduler.running else False} "
        f"scheduler_job_ids={[job.id for job in scheduler.get_jobs()] if scheduler.running else []}"
    )
    session.delete(job)
    session.commit()

    from utils.scheduler import reload_jobs

    await reload_jobs()
    logger.info("AFTER DELETE")
    logger.info(
        f"[DeleteJob] agent_id={agent_id} job_id={job_id} "
        f"agent_cached={cache.get_agent(agent_id) is not None} "
        f"cache_keys={list(cache._cache.keys())} "
        f"scheduler_job_present={scheduler.get_job(str(job_id)) is not None if scheduler.running else False} "
        f"scheduler_job_ids={[job.id for job in scheduler.get_jobs()] if scheduler.running else []}"
    )

    return {"ok": True}

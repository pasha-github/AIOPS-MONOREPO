from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from database.database import get_session
from database.models import Agent, Model, Webhook, Job
from typing import List, Optional, Dict, Any
import httpx
from uuid import UUID
from pydantic import BaseModel
from utils.adk_app import invalidate_cache

router = APIRouter(prefix="/agent", tags=["agent"])

class AgentCreate(BaseModel):
    agent_id: str
    name: str
    description: str
    instruction: str
    model_id: str
    tools: Optional[str] = None
    mcp_servers: List[str] = []
    connector_config_ids: List[str] = []
    isEnabled: bool = True
    sub_agents: List[str] = []
    type: Optional[str] = "agent"

class AgentPatch(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    instruction: Optional[str] = None
    model_id: Optional[str] = None
    tools: Optional[str] = None
    mcp_servers: Optional[List[str]] = None
    connector_config_ids: Optional[List[str]] = None
    isEnabled: Optional[bool] = None
    sub_agents: Optional[List[str]] = None

class WebhookCreate(BaseModel):
    prompt: str

class WebhookResponse(BaseModel):
    webhook_id: UUID
    agent_id: str
    prompt: str

class JobCreate(BaseModel):
    prompt: str
    cron_expression: Optional[str] = None
    interval_seconds: Optional[int] = None

class JobResponse(BaseModel):
    job_id: UUID
    agent_id: str
    prompt: str
    cron_expression: Optional[str] = None
    interval_seconds: Optional[int] = None

class WebhookInvoke(BaseModel):
    prompt: Optional[str] = None
    
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

@router.get("/", response_model=List[Agent])
def list_agents(session: Session = Depends(get_session)):
    agents = session.exec(select(Agent)).all()
    return agents

@router.patch("/{agent_id}", response_model=Agent)
def update_agent(agent_id: str, patch_data: AgentPatch, session: Session = Depends(get_session)):
    agent = session.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    updates = patch_data.model_dump(exclude_unset=True)
    if "model_id" in updates:
        if updates["model_id"] is None or not session.get(Model, updates["model_id"]):
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
def create_webhook(agent_id: str, webhook: WebhookCreate, session: Session = Depends(get_session)):
    agent = session.get(Agent, agent_id)
    if not agent or agent.type != "automation":
        raise HTTPException(status_code=400, detail="Agent not found or not an automation agent")
    db_webhook = Webhook(agent_id=agent_id, prompt=webhook.prompt)
    session.add(db_webhook)
    session.commit()
    session.refresh(db_webhook)
    return db_webhook

@router.get("/{agent_id}/webhook", response_model=List[WebhookResponse])
def list_webhooks(agent_id: str, session: Session = Depends(get_session)):
    webhooks = session.exec(select(Webhook).where(Webhook.agent_id == agent_id)).all()
    return webhooks

@router.delete("/{agent_id}/webhook/{webhook_id}")
def delete_webhook(agent_id: str, webhook_id: UUID, session: Session = Depends(get_session)):
    webhook = session.get(Webhook, webhook_id)
    if not webhook or webhook.agent_id != agent_id:
        raise HTTPException(status_code=404, detail="Webhook not found")
    session.delete(webhook)
    session.commit()
    return {"ok": True}

async def invoke_agent_session(agent_id: str, prompt: str):
    user_id = "user"
    session_url = f"http://localhost:8000/agent-server/apps/{agent_id}/users/{user_id}/sessions"
    run_url = f"http://localhost:8000/agent-server/run"
    
    async with httpx.AsyncClient() as client:
        session_res = await client.post(session_url)
        session_res.raise_for_status()
        session_data = session_res.json()
        session_id = session_data["id"]
        
        run_payload = {
            "appName": agent_id,
            "userId": user_id,
            "sessionId": session_id,
            "newMessage": {
                "role": "user",
                "parts": [{"text": prompt}]
            },
            "streaming": False,
            "stateDelta": None
        }
            
        run_res = await client.post(run_url, json=run_payload, timeout=60.0)
        run_res.raise_for_status()
        return run_res.json()


@router.post("/{agent_id}/webhook/invoke/{webhook_id}")
async def invoke_webhook(agent_id: str, webhook_id: UUID, session: Session = Depends(get_session), body: Optional[WebhookInvoke] = None):
    webhook = session.get(Webhook, webhook_id)
    if not webhook or webhook.agent_id != agent_id:
        raise HTTPException(status_code=404, detail="Webhook not found")
    try:
        final_prompt = body.prompt if body and body.prompt else webhook.prompt
        result = await invoke_agent_session(agent_id, final_prompt)
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Jobs ---
@router.post("/{agent_id}/jobs", response_model=JobResponse)
def create_job(agent_id: str, job: JobCreate, session: Session = Depends(get_session)):
    agent = session.get(Agent, agent_id)
    if not agent or agent.type != "automation":
        raise HTTPException(status_code=400, detail="Agent not found or not an automation agent")
    if not job.cron_expression and not job.interval_seconds:
        raise HTTPException(status_code=400, detail="Either cron_expression or interval_seconds must be provided")
    
    db_job = Job(
        agent_id=agent_id,
        prompt=job.prompt,
        cron_expression=job.cron_expression,
        interval_seconds=job.interval_seconds
    )
    session.add(db_job)
    session.commit()
    session.refresh(db_job)
    
    from utils.scheduler import reload_jobs
    import asyncio
    
    # Reload jobs in the background safely using the current event loop
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(reload_jobs())
    except RuntimeError:
        pass # Loop not running or testing
        
    return db_job

@router.get("/{agent_id}/jobs", response_model=List[JobResponse])
def list_jobs(agent_id: str, session: Session = Depends(get_session)):
    jobs = session.exec(select(Job).where(Job.agent_id == agent_id)).all()
    return jobs

@router.delete("/{agent_id}/jobs/{job_id}")
def delete_job(agent_id: str, job_id: UUID, session: Session = Depends(get_session)):
    job = session.get(Job, job_id)
    if not job or job.agent_id != agent_id:
        raise HTTPException(status_code=404, detail="Job not found")
    session.delete(job)
    session.commit()
    
    from utils.scheduler import reload_jobs
    import asyncio
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(reload_jobs())
    except RuntimeError:
        pass
        
    return {"ok": True}

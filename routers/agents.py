from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from database.database import get_session
from database.models import Agent
from typing import List, Optional
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

@router.post("/", response_model=Agent)
def create_agent(agent: AgentCreate, session: Session = Depends(get_session)):
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

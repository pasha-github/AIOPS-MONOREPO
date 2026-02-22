from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from database.database import get_session
from database.models import Agent
from utils.cache import cache
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter(prefix="/agent", tags=["agent"])

class AgentCreate(BaseModel):
    agent_id: str
    name: str
    description: str
    instruction: str
    model_id: str
    tools: Optional[str] = None
    mcp_server_sse_config: Optional[str] = None
    isEnabled: bool = True

class AgentUpdate(BaseModel):
    agent_id: str # Added to identify which agent to patch, though path param is cleaner, user asked for body in PATCH /agent/
    isEnabled: bool

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
         cache.remove_agent(agent.agent_id)
    return {"ok": True}

@router.patch("/")
def update_agent(update_data: AgentUpdate, session: Session = Depends(get_session)):
    # User asked for PATCH /agent/ body {isEnabled}, implies identifying agent somehow.
    # Using agent_id in body as identifier.
    agent = session.get(Agent, update_data.agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    agent.isEnabled = update_data.isEnabled
    session.add(agent)
    session.commit()
    session.refresh(agent)
    
    # If disabled, remove from cache
    if not agent.isEnabled:
        cache.remove_agent(agent.agent_id)
        
    return agent

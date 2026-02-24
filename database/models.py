from typing import Optional, List
from sqlmodel import Field, SQLModel, Column, JSON
import json
from datetime import datetime

class Agent(SQLModel, table=True):
    agent_id: str = Field(primary_key=True)
    name: str
    description: str
    instruction: str
    model_id: str = Field(foreign_key="model.model_id")
    tools: Optional[str] = None # JSON string of tools code
    isEnabled: bool = True
    mcp_servers: List[str] = Field(default_factory=list, sa_column=Column(JSON)) # JSON List of MCP server URLs
    created_at: datetime = Field(default=datetime.now())
    updated_at: datetime = Field(default=datetime.now())
    tags: Optional[str] = None 
    status: str = "active" 


class Model(SQLModel, table=True):
    model_id: str = Field(primary_key=True)
    provider: str
    name: str
    api_key: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    description: Optional[str] = None
    isEnabled: bool = True
    

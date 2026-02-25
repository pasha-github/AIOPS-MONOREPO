from typing import Optional, List, Dict
from sqlmodel import Field, SQLModel, Column, JSON
import json
from datetime import datetime
from uuid import UUID, uuid4

class Agent(SQLModel, table=True):
    agent_id: str = Field(primary_key=True)
    name: str
    description: str
    instruction: str
    model_id: str = Field(foreign_key="model.model_id")
    tools: Optional[str] = None # JSON string of tools code
    isEnabled: bool = True
    connector_config_ids: List[str] = Field(default_factory=list, sa_column=Column(JSON))
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

class ConnectorConfig(SQLModel, table=True):
    connector_config_id: UUID =  Field(
        default_factory=uuid4,
        primary_key=True
    )
    name: str
    description: Optional[str] = None
    config: List[Dict[str, str]] = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default=datetime.now())
    updated_at: datetime = Field(default=datetime.now())
    connector_id: str
    

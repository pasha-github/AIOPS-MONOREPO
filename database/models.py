from typing import Optional, List
from sqlmodel import Field, SQLModel
import json

class Agent(SQLModel, table=True):
    agent_id: str = Field(primary_key=True)
    name: str
    description: str
    instruction: str
    model_id: str = Field(foreign_key="model.model_id")
    tools: Optional[str] = None # JSON string of tools code
    isEnabled: bool = True
    mcp_server_sse_config: Optional[str] = None # JSON string of MCP config

class Model(SQLModel, table=True):
    model_id: str = Field(primary_key=True)
    provider: str
    name: str
    api_key: str

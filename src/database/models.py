from datetime import datetime
from uuid import UUID, uuid4

from sqlmodel import JSON, Column, Field, SQLModel


class Agent(SQLModel, table=True):
    agent_id: str = Field(primary_key=True)
    name: str
    description: str
    instruction: str
    model_id: str = Field(foreign_key="model.model_id")
    tools: str | None = None  # JSON string of tools code
    isEnabled: bool = True
    connector_config_ids: list[str] = Field(
        default_factory=list, sa_column=Column(JSON)
    )
    mcp_servers: list[str] = Field(
        default_factory=list, sa_column=Column(JSON)
    )  # JSON List of MCP server URLs
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    tags: str | None = None
    sub_agents: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    status: str = "active"
    type: str = Field(default="agent")


class Model(SQLModel, table=True):
    model_id: str = Field(primary_key=True)
    provider: str
    name: str
    api_key: str
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    description: str | None = None
    isEnabled: bool = True


class ConnectorConfig(SQLModel, table=True):
    connector_config_id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str
    description: str | None = None
    config: list[dict[str, str]] = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    connector_id: str


class Webhook(SQLModel, table=True):
    webhook_id: UUID = Field(default_factory=uuid4, primary_key=True)
    agent_id: str = Field(foreign_key="agent.agent_id")
    prompt: str
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class Job(SQLModel, table=True):
    job_id: UUID = Field(default_factory=uuid4, primary_key=True)
    agent_id: str = Field(foreign_key="agent.agent_id")
    prompt: str
    cron_expression: str | None = None
    interval_seconds: int | None = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

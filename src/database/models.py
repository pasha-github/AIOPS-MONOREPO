from datetime import datetime
from typing import ClassVar
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, LargeBinary
from sqlmodel import JSON, Column, Field, SQLModel, UniqueConstraint


class Agent(SQLModel, table=True):
    agent_id: str = Field(primary_key=True)
    name: str
    description: str
    instruction: str = ""
    deployment_target: str = Field(default="internal")
    vertex_resource_name: str | None = None
    vertex_deployment_status: str | None = None
    vertex_deployment_error: str | None = None
    bedrock_agentcore_resource_arn: str | None = None
    bedrock_agentcore_deployment_status: str | None = None
    bedrock_agentcore_deployment_error: str | None = None
    aws_credential_id: UUID | None = Field(
        default=None,
        foreign_key="aws_credential.credential_id",
    )
    primary_use_global: bool = True
    primary_model_id: str | None = Field(default=None, foreign_key="model.model_id")
    secondary_use_global: bool = True
    secondary_model_id: str | None = Field(default=None, foreign_key="model.model_id")
    tertiary_use_global: bool = True
    tertiary_model_id: str | None = Field(default=None, foreign_key="model.model_id")
    tools: str | None = None  # JSON string of tools code
    isEnabled: bool = True
    connector_config_ids: list[str] = Field(
        default_factory=list, sa_column=Column(JSON)
    )
    skill_ids: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    mcp_server_ids: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    mcp_servers: list[str] = Field(
        default_factory=list, sa_column=Column(JSON)
    )  # JSON List of MCP server URLs
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    tags: str | None = None
    sub_agents: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    status: str = "active"
    type: str = Field(default="agent")
    prompt_role: str | None = None
    prompt_objectives: str | None = None
    prompt_behavior: str | None = None
    prompt_output_format: str | None = None
    prompt_constraints: str | None = None
    prompt_safety: str | None = None
    prompt_tools_instructions: str | None = None
    prompt_policy: str | None = None
    prompt_examples: str | None = None
    prompt_additional_info: str | None = None
    memory_enabled: bool = Field(default=False)
    memory_tool_type: str | None = None
    guardrail_sensitive_data: bool = Field(default=False)
    guardrails_config: dict | None = Field(default=None, sa_column=Column(JSON))
    knowledge_file_ids: list[str] = Field(default_factory=list, sa_column=Column(JSON))


class Model(SQLModel, table=True):
    model_id: str = Field(primary_key=True)
    provider: str
    name: str
    api_key: str
    extra_config: dict | None = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    description: str | None = None
    isEnabled: bool = True


class ModelDefaults(SQLModel, table=True):
    __tablename__: ClassVar[str] = "model_defaults"
    id: int = Field(default=1, primary_key=True)
    primary_model_id: str | None = Field(default=None, foreign_key="model.model_id")
    secondary_model_id: str | None = Field(default=None, foreign_key="model.model_id")
    tertiary_model_id: str | None = Field(default=None, foreign_key="model.model_id")


class AwsCredential(SQLModel, table=True):
    __tablename__: ClassVar[str] = "aws_credential"
    credential_id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str
    access_key_id: str
    secret_access_key: str
    session_token: str | None = None
    region: str
    is_default: bool = True
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class VertexConfig(SQLModel, table=True):
    __tablename__: ClassVar[str] = "vertex_config"
    id: int = Field(default=1, primary_key=True)
    project_id: str
    location: str
    staging_bucket: str
    service_account_json: str | None = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class ConnectorConfig(SQLModel, table=True):
    connector_config_id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str
    description: str | None = None
    config: list[dict[str, str]] = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    connector_id: str


class MCPServer(SQLModel, table=True):
    mcp_server_id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str
    server_url: str
    description: str | None = None
    auth_type: str = "none"
    auth_username: str | None = None
    auth_secret: str | None = None
    metadata_json: dict = Field(default_factory=dict, sa_column=Column(JSON))
    tools_json: list[dict] = Field(default_factory=list, sa_column=Column(JSON))
    resources_json: list[dict] = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class Skill(SQLModel, table=True):
    skill_id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str
    description: str
    instructions: str
    tools: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    references: dict[str, str] = Field(default_factory=dict, sa_column=Column(JSON))
    assets: dict[str, str] = Field(default_factory=dict, sa_column=Column(JSON))
    scripts: dict[str, str] = Field(default_factory=dict, sa_column=Column(JSON))
    connector_config_ids: list[str] = Field(
        default_factory=list, sa_column=Column(JSON)
    )
    mcp_server_ids: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


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
    # Optional API polling — if url is set, the agent is only triggered when conditions pass
    url: str | None = None
    method: str = "GET"
    headers: dict | None = Field(default=None, sa_column=Column(JSON))
    body: dict | None = Field(default=None, sa_column=Column(JSON))
    conditions: list | None = Field(default=None, sa_column=Column(JSON))
    condition_operator: str = "AND"


class ObservabilitySpan(SQLModel, table=True):
    __tablename__: ClassVar[str] = "observability_span"
    __table_args__ = (
        UniqueConstraint("agent_id", "session_id", "span_id", name="uq_span_session"),
    )

    observability_span_id: UUID = Field(default_factory=uuid4, primary_key=True)
    agent_id: str = Field(index=True)
    session_id: str = Field(index=True)
    name: str
    span_id: str
    trace_id: str
    start_time: int | None = Field(default=None, sa_column=Column(BigInteger))
    end_time: int | None = Field(default=None, sa_column=Column(BigInteger))
    attributes: dict = Field(default_factory=dict, sa_column=Column(JSON))
    parent_span_id: str | None = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class AgentFile(SQLModel, table=True):
    __tablename__: ClassVar[str] = "agent_file"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    filename: str
    content_type: str
    size: int
    content: bytes = Field(sa_column=Column(LargeBinary))
    created_at: datetime = Field(default_factory=datetime.now)


class ObservabilityTokenUsage(SQLModel, table=True):
    __tablename__: ClassVar[str] = "observability_token_usage"

    token_usage_id: UUID = Field(default_factory=uuid4, primary_key=True)
    agent_id: str = Field(index=True)
    session_id: str = Field(index=True)
    llm_model: str = Field(index=True)
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    invocation_id: str | None = None
    event_id: str | None = None
    created_at: datetime = Field(default_factory=datetime.now)

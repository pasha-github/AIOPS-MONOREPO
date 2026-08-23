from datetime import datetime
from typing import Any, ClassVar
from uuid import UUID, uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import BigInteger, LargeBinary
from sqlmodel import JSON, Column, Field, SQLModel, UniqueConstraint

from src.utils.constants import SOP_EMBEDDING_DIM

# Embedding column type. Real pgvector `vector(N)` on PostgreSQL (enables the
# HNSW ANN index + `<=>` cosine operator); transparent JSON fallback on SQLite
# (dev/CI) where the `vector` type does not exist. Same Python value (list[float])
# round-trips through both.
_EMBEDDING_COLUMN = JSON().with_variant(Vector(SOP_EMBEDDING_DIM), "postgresql")


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
    sub_agent_delegation_type: str = Field(
        default="task"
    )  # "task" = AgentTool, "full" = LlmAgent sub_agents
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
    job_type: str = Field(default="agent")  # "agent" | "ingestion"
    # agent_id/prompt are only set for agent jobs; ingestion jobs have neither.
    agent_id: str | None = Field(default=None, foreign_key="agent.agent_id")
    prompt: str | None = None
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


# ---------------------------------------------------------------------------
# SOP ingestion / retrieval
#
# Two planes (see docs/claude-ingestion.md, docs/claude-retrieval.md):
#   · Data plane (agent-readable): SopDocument, SopSection, SopElement,
#     SopSectionEmbedding — the parsed content agents search and read.
#   · Control plane (ingestion-only): IngestionSource (where SOPs come from)
#     and IngestedDocument (per-document provenance + change-detection). Agents
#     never read these tables.
#
# Two units, two roles (two-pass design):
#   · SopSection = retrieval / embedding unit. Returned WHOLE so a procedure is
#     never half-retrieved. Flat, keyed by reading-order `section_index`.
#   · SopElement = citation / edit unit. Verbatim, immutable text; the agent
#     cites and proposes edits at element granularity.
#
# Tenancy: NONE of these tables carry a tenant_id — the platform is
# single-tenant-per-deployment (one instance per client, like every other table
# here). Per-user visibility is enforced at RETRIEVAL (JWT role/group claims +
# the read-only `sop_reader` DB role granted on the data plane only), never at
# ingestion (which runs as a system identity). If intra-company segmentation is
# ever needed, add an `access_group` column on SopDocument and match it against
# JWT groups at retrieval — not a tenant_id.
#
# SOP sources live in their own IngestionSource table — NOT in ConnectorConfig.
#
# Embedding storage: `embedding` is a portable JSON list[float] for now (works
# on SQLite + Postgres). On Postgres, migrate to a pgvector `vector(dim)` column
# with a per-model ANN index when ANN search is enabled (needs the `pgvector`
# dependency + extension).
# ---------------------------------------------------------------------------


class SopDocument(SQLModel, table=True):
    """Agent-readable SOP. One row per logical document."""

    __tablename__: ClassVar[str] = "sop_document"

    sop_document_id: UUID = Field(default_factory=uuid4, primary_key=True)
    title: str
    description: str | None = None
    # SHA-256 over concatenated element texts (Pass 1). Validator anchor; null
    # until the real parser/storage runs.
    groundtruth_hash: str | None = None
    # Which Pass-2 path produced the sections: "normalized" | "fallback_flat".
    normalization_status: str = Field(default="fallback_flat")
    # Stable, human-readable identity; natural upsert key (globally unique —
    # single-tenant deployment).
    slug: str = Field(index=True, unique=True)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class SopSection(SQLModel, table=True):
    """Retrieval/embedding unit: a self-contained procedure (trigger + steps).

    Owns an ordered list of SopElement rows; Markdown is rendered from them on
    demand (store JSON, render Markdown). Re-ingestion is delete-all-for-document
    + reinsert, since parser refs are positional and not stable across runs.
    """

    __tablename__: ClassVar[str] = "sop_section"
    __table_args__ = (
        UniqueConstraint(
            "sop_document_id", "section_index", name="uq_sop_section_order"
        ),
    )

    sop_section_id: UUID = Field(default_factory=uuid4, primary_key=True)
    sop_document_id: UUID = Field(
        foreign_key="sop_document.sop_document_id",
        ondelete="CASCADE",
        index=True,
    )
    # Position in document reading order.
    section_index: int
    # Docling self_ref of the heading element that titles this section (Pass 2).
    title_element_ref: str | None = None
    # SHA-256 of this section's concatenated element text — skip re-embedding
    # when unchanged (compared against SopSectionEmbedding.source_text_hash).
    content_hash: str | None = None
    title: str | None = None
    # Error signature(s) for search; pg_trgm GIN index (PostgreSQL only).
    trigger_text: str | None = None
    # "table" | "image" | null (null means ordinary text section).
    section_type: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class SopElement(SQLModel, table=True):
    """Citation/edit unit: one verbatim text element of a section, in order.

    `text` is copied byte-for-byte from the layout parser and is immutable — the
    groundtruth. `element_ref` is NOT unique (a split bullet yields two rows that
    share `#/texts/N`); ordering is by (sop_section_id, element_index).
    """

    __tablename__: ClassVar[str] = "sop_element"
    __table_args__ = (
        UniqueConstraint(
            "sop_section_id", "element_index", name="uq_sop_element_order"
        ),
    )

    sop_element_id: UUID = Field(default_factory=uuid4, primary_key=True)
    sop_section_id: UUID = Field(
        foreign_key="sop_section.sop_section_id",
        ondelete="CASCADE",
        index=True,
    )
    # Docling self_ref (e.g. "#/texts/11"). Not unique — splits share it.
    element_ref: str
    # Order within the section.
    element_index: int
    # Char offsets into the original element text when Pass 2 split one element
    # into several (the substrings stay byte-identical). Null when not a split.
    char_start: int | None = None
    char_end: int | None = None
    # section_header | list_item | text | step
    label: str
    # Verbatim, immutable.
    text: str
    # Provenance: {page_no, bbox}.
    prov_json: dict = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class SopSectionEmbedding(SQLModel, table=True):
    """One embedding vector per (section, model). One vector covers the whole
    section (concat of its elements)."""

    __tablename__: ClassVar[str] = "sop_section_embedding"
    __table_args__ = (
        UniqueConstraint(
            "sop_section_id", "embedding_model", name="uq_sop_embedding_model"
        ),
    )

    sop_section_embedding_id: UUID = Field(default_factory=uuid4, primary_key=True)
    sop_section_id: UUID = Field(
        foreign_key="sop_section.sop_section_id",
        ondelete="CASCADE",
        index=True,
    )
    embedding_model: str
    dim: int
    # pgvector vector(SOP_EMBEDDING_DIM) on Postgres (HNSW ANN + `<=>`); JSON on
    # SQLite. Annotated Any because Postgres reads back a numpy array, JSON a list.
    embedding: Any = Field(default=None, sa_column=Column(_EMBEDDING_COLUMN))
    # Hash of the section text this vector was computed from (== section
    # content_hash at embed time); lets ingestion skip unchanged re-embeds.
    source_text_hash: str | None = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class IngestionSource(SQLModel, table=True):
    """A registered place SOPs are ingested from (control plane).

    Dedicated to ingestion — independent of the agent-facing ConnectorConfig
    registry. `source_type` selects the fetcher (sharepoint | confluence | …);
    `parser_backend` selects the parser (docling | azure | gcp | aws); `config`
    carries source credentials/settings as a list of {name, value} pairs.
    """

    __tablename__: ClassVar[str] = "ingestion_source"

    ingestion_source_id: UUID = Field(default_factory=uuid4, primary_key=True)
    source_name: str
    source_type: str = Field(default="sharepoint")
    config: list[dict[str, str]] = Field(default_factory=list, sa_column=Column(JSON))
    parser_backend: str = Field(default="docling")
    is_enabled: bool = True
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class IngestedDocument(SQLModel, table=True):
    """Ingestion-only provenance + change-detection for a SopDocument.

    One row per ingested source file (1:1 with SopDocument).
    """

    __tablename__: ClassVar[str] = "ingested_document"
    __table_args__ = (
        UniqueConstraint("ingestion_source_id", "path", name="uq_sop_source_location"),
        UniqueConstraint("sop_document_id", name="uq_ingested_document_doc"),
    )

    ingested_document_id: UUID = Field(default_factory=uuid4, primary_key=True)
    sop_document_id: UUID = Field(
        foreign_key="sop_document.sop_document_id",
        ondelete="CASCADE",
        index=True,
    )
    # The IngestionSource this document came from. RESTRICT: deleting a source
    # must not silently wipe ingest history.
    ingestion_source_id: UUID = Field(
        foreign_key="ingestion_source.ingestion_source_id",
        ondelete="RESTRICT",
        index=True,
    )
    path: str
    file_name: str
    mime_type: str | None = None
    # Change detection uses Graph API list metadata (no byte checksum):
    # source_modified (lastModifiedDateTime), version (eTag/cTag), size.
    source_modified: datetime | None = None
    size: int | None = None
    version: str | None = None
    # Direct browser-accessible URL to the original document (e.g. SharePoint
    # webUrl, OneDrive webUrl, Confluence _links.webui). Populated at ingest
    # time so retrieval never needs to touch the control-plane config.
    web_url: str | None = None
    last_ingested_at: datetime | None = None
    ingest_status: str = Field(default="pending")  # pending|ingested|error|skipped
    ingest_error: str | None = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

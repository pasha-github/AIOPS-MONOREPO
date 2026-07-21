import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from pydantic import BaseModel, ConfigDict
from sqlmodel import Session, select

from src.agent_runtime.adk.adk_app import chat_agent as chat_adk_agent
from src.agent_runtime.adk.adk_app import create_session as create_adk_session
from src.agent_runtime.adk.adk_app import delete_session as delete_adk_session
from src.agent_runtime.adk.adk_app import get_session as get_adk_session
from src.agent_runtime.adk.adk_app import list_sessions as list_adk_sessions
from src.agent_runtime.service import (
    enqueue_agent_runtime_reconcile,
    invoke_agent,
    mark_agent_runtime_pending,
)
from src.database.database import engine, get_session
from src.database.models import Agent, AwsCredential, Job, Model, VertexConfig, Webhook
from src.skills.runtime import validate_mcp_server_ids, validate_skill_ids
from src.utils.aws_credentials import get_default_aws_credential

router = APIRouter(prefix="/agent", tags=["agent"])
TEMPLATES_FILE = (
    Path(__file__).resolve().parent.parent.parent / "static" / "agent_templates.json"
)

logger = logging.getLogger(__name__)


class AgentCreate(BaseModel):
    agent_id: str
    name: str
    description: str
    deployment_target: Literal["internal", "adk", "vertex", "bedrock_agentcore"] = (
        "internal"
    )
    aws_credential_id: UUID | None = None
    primary_use_global: bool = True
    primary_model_id: str | None = None
    secondary_use_global: bool = True
    secondary_model_id: str | None = None
    tertiary_use_global: bool = True
    tertiary_model_id: str | None = None
    tools: str | None = None
    mcp_servers: list[str] = []
    mcp_server_ids: list[str] = []
    skill_ids: list[str] = []
    connector_config_ids: list[str] = []
    isEnabled: bool = True
    sub_agents: list[str] = []
    type: str | None = "agent"
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
    memory_enabled: bool = False
    memory_tool_type: str | None = None
    guardrail_sensitive_data: bool = False
    guardrails_config: dict | None = None
    knowledge_file_ids: list[str] = []


class AgentPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    deployment_target: (
        Literal["internal", "adk", "vertex", "bedrock_agentcore"] | None
    ) = None
    aws_credential_id: UUID | None = None
    primary_use_global: bool | None = None
    primary_model_id: str | None = None
    secondary_use_global: bool | None = None
    secondary_model_id: str | None = None
    tertiary_use_global: bool | None = None
    tertiary_model_id: str | None = None
    tools: str | None = None
    mcp_servers: list[str] | None = None
    mcp_server_ids: list[str] | None = None
    skill_ids: list[str] | None = None
    connector_config_ids: list[str] | None = None
    isEnabled: bool | None = None
    sub_agents: list[str] | None = None
    type: str | None = None
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
    memory_enabled: bool | None = None
    memory_tool_type: str | None = None
    guardrail_sensitive_data: bool | None = None
    guardrails_config: dict | None = None
    knowledge_file_ids: list[str] | None = None


class WebhookCreate(BaseModel):
    prompt: str


class WebhookResponse(BaseModel):
    webhook_id: UUID
    agent_id: str
    prompt: str


class ConditionSchema(BaseModel):
    type: str
    operator: str = "eq"
    field: str | None = None
    path: str | None = None
    value: Any = None


class JobCreate(BaseModel):
    prompt: str
    cron_expression: str | None = None
    interval_seconds: int | None = None
    # Optional API polling
    url: str | None = None
    method: str = "GET"
    headers: dict | None = None
    body: dict | None = None
    conditions: list[ConditionSchema] | None = None
    condition_operator: str = "AND"


class JobResponse(BaseModel):
    job_id: UUID
    agent_id: str
    prompt: str
    cron_expression: str | None = None
    interval_seconds: int | None = None
    url: str | None = None
    method: str = "GET"
    headers: dict | None = None
    body: dict | None = None
    conditions: list | None = None
    condition_operator: str = "AND"


class WebhookInvoke(BaseModel):
    prompt: str | None = None


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


class ChatSessionCreateResponse(BaseModel):
    session_id: str


class AgentTemplate(BaseModel):
    template_id: str
    name: str
    description: str
    instruction: str


class AgentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    agent_id: str
    name: str
    description: str
    instruction: str
    deployment_target: str = "internal"
    vertex_resource_name: str | None = None
    vertex_deployment_status: str | None = None
    vertex_deployment_error: str | None = None
    bedrock_agentcore_resource_arn: str | None = None
    bedrock_agentcore_deployment_status: str | None = None
    bedrock_agentcore_deployment_error: str | None = None
    aws_credential_id: UUID | None = None
    primary_use_global: bool = True
    primary_model_id: str | None = None
    secondary_use_global: bool = True
    secondary_model_id: str | None = None
    tertiary_use_global: bool = True
    tertiary_model_id: str | None = None
    tools: str | None = None
    isEnabled: bool = True
    connector_config_ids: list[str] = []
    skill_ids: list[str] = []
    mcp_server_ids: list[str] = []
    mcp_servers: list[str] = []
    created_at: datetime
    updated_at: datetime
    tags: str | None = None
    sub_agents: list[str] = []
    status: str = "active"
    type: str = "agent"
    memory_enabled: bool = False
    memory_tool_type: str | None = None
    vertex_stream_query_url: str | None = None
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
    guardrail_sensitive_data: bool = False
    guardrails_config: dict | None = None
    knowledge_file_ids: list[str] = []


def _vertex_stream_url(agent: Agent, config: VertexConfig | None) -> str | None:
    if (
        (agent.deployment_target or "internal").lower() != "vertex"
        or not agent.vertex_resource_name
        or config is None
        or not config.location
    ):
        return None
    resource_name = agent.vertex_resource_name
    location = config.location
    if resource_name.startswith("projects/"):
        return f"https://{location}-aiplatform.googleapis.com/v1/{resource_name}:streamQuery?alt=sse"
    return (
        f"https://{location}-aiplatform.googleapis.com/v1/"
        f"projects/{config.project_id}/locations/{location}/"
        f"reasoningEngines/{resource_name}:streamQuery?alt=sse"
    )


def _validate_model_id(session: Session, model_id: str | None, field_name: str):
    if model_id is None or session.get(Model, model_id) is None:
        raise HTTPException(status_code=400, detail=f"Invalid {field_name}")


def _validate_agent_model_settings(session: Session, payload: dict):
    slot_fields = (
        ("primary_use_global", "primary_model_id", "primary_model_id"),
        ("secondary_use_global", "secondary_model_id", "secondary_model_id"),
        ("tertiary_use_global", "tertiary_model_id", "tertiary_model_id"),
    )

    explicit_model_ids: list[str] = []
    for use_global_field, model_id_field, error_field in slot_fields:
        use_global = payload.get(use_global_field, True)
        model_id = payload.get(model_id_field)
        if use_global:
            continue
        _validate_model_id(session, model_id, error_field)
        assert model_id is not None
        explicit_model_ids.append(model_id)

    if len(explicit_model_ids) != len(set(explicit_model_ids)):
        raise HTTPException(
            status_code=400,
            detail="Duplicate manual model selections are not allowed",
        )


def _validate_agent_aws_credential_settings(session: Session, payload: dict) -> None:
    deployment_target = (payload.get("deployment_target") or "adk").lower()
    aws_credential_id = payload.get("aws_credential_id")

    if deployment_target != "bedrock_agentcore":
        return

    if aws_credential_id is None:
        raise HTTPException(
            status_code=400,
            detail="aws_credential_id is required for Bedrock AgentCore agents",
        )

    if session.get(AwsCredential, aws_credential_id) is None:
        raise HTTPException(status_code=400, detail="Invalid aws_credential_id")


def _apply_default_agent_aws_credential(session: Session, payload: dict) -> None:
    deployment_target = (payload.get("deployment_target") or "adk").lower()
    if deployment_target != "bedrock_agentcore" or payload.get("aws_credential_id"):
        return

    default_credential = get_default_aws_credential(session)
    if default_credential is not None:
        payload["aws_credential_id"] = default_credential.credential_id


@router.get("/templates", response_model=list[AgentTemplate])
def list_agent_templates():
    with TEMPLATES_FILE.open("r", encoding="utf-8") as templates_file:
        templates = json.load(templates_file)
    return templates


@router.post("/", response_model=Agent)
def create_agent(
    agent: AgentCreate,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    if session.get(Agent, agent.agent_id):
        raise HTTPException(status_code=409, detail="Agent already exists")

    agent_data = agent.model_dump()
    if (agent_data.get("deployment_target") or "").lower() == "adk":
        agent_data["deployment_target"] = "internal"
    _validate_agent_model_settings(session, agent_data)
    _apply_default_agent_aws_credential(session, agent_data)
    _validate_agent_aws_credential_settings(session, agent_data)
    validate_mcp_server_ids(session, agent_data.get("mcp_server_ids"))
    validate_skill_ids(session, agent_data.get("skill_ids"))

    db_agent = Agent.model_validate(agent_data)
    mark_agent_runtime_pending(db_agent)
    session.add(db_agent)
    session.commit()
    session.refresh(db_agent)
    enqueue_agent_runtime_reconcile(background_tasks, agent_id=db_agent.agent_id)
    return db_agent


@router.get("/", response_model=list[AgentResponse])
def list_agents(session: Session = Depends(get_session)):
    from src.agent_runtime.service import is_agent_runtime_reconcile_inflight
    from src.agent_runtime.vertex.service import reconcile_remote_deployment_state

    agents = session.exec(select(Agent)).all()
    vertex_config = session.exec(
        select(VertexConfig).where(VertexConfig.id == 1)
    ).first()

    for agent in agents:
        if is_agent_runtime_reconcile_inflight(agent.agent_id):
            continue
        try:
            reconcile_remote_deployment_state(agent, session)
        except Exception:
            logger.exception(
                "Failed to reconcile remote deployment state for agent %s",
                agent.agent_id,
            )

    return [
        AgentResponse(
            **agent.model_dump(),
            vertex_stream_query_url=_vertex_stream_url(agent, vertex_config),
        )
        for agent in agents
    ]


@router.patch("/{agent_id}", response_model=Agent)
def update_agent(
    agent_id: str,
    patch_data: AgentPatch,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    agent = session.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    previous_agent = Agent.model_validate(agent.model_dump())
    updates = patch_data.model_dump(exclude_unset=True)
    if (
        "deployment_target" in updates
        and (updates["deployment_target"] or "").lower() == "adk"
    ):
        updates["deployment_target"] = "internal"
    if (
        updates.get("isEnabled") is True
        and (agent.deployment_target or "").lower() == "bedrock_agentcore"
        and agent.bedrock_agentcore_deployment_status == "disabling"
    ):
        raise HTTPException(
            status_code=409,
            detail="Bedrock AgentCore agent is still disabling",
        )
    merged = agent.model_dump()
    merged.update(updates)
    _validate_agent_model_settings(session, merged)
    _apply_default_agent_aws_credential(session, merged)
    _validate_agent_aws_credential_settings(session, merged)
    validate_mcp_server_ids(session, merged.get("mcp_server_ids"))
    validate_skill_ids(session, merged.get("skill_ids"))

    for key, value in updates.items():
        setattr(agent, key, value)
    if (merged.get("deployment_target") or "").lower() == "bedrock_agentcore":
        agent.aws_credential_id = merged.get("aws_credential_id")

    mark_agent_runtime_pending(agent)
    session.add(agent)
    session.commit()
    session.refresh(agent)

    from src.agent_runtime.adk.adk_app import invalidate_cache

    invalidate_cache(agent_id)

    enqueue_agent_runtime_reconcile(
        background_tasks,
        agent_id=agent.agent_id,
        previous_agent=previous_agent,
    )
    return agent


@router.delete("/{agent_id}")
def delete_agent(
    agent_id: str,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    agent = session.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    agent_snapshot = Agent.model_validate(agent.model_dump())
    session.delete(agent)
    session.commit()
    enqueue_agent_runtime_reconcile(
        background_tasks,
        agent_id=None,
        previous_agent=agent_snapshot,
    )

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
    try:
        with Session(engine) as runtime_session:
            agent = runtime_session.get(Agent, agent_id)
            if agent is None:
                raise HTTPException(status_code=404, detail="Agent not found")
            if not agent.isEnabled:
                raise HTTPException(status_code=400, detail="Agent not enabled")
            return await invoke_agent(agent, prompt)
    except Exception as e:
        logger.error(e)
        raise


def _resolve_chat_user_id(
    request: Request, x_user_id: str | None = Header(default=None)
) -> str:
    # Stable user_id required
    if x_user_id:
        return x_user_id

    auth_subject = getattr(request.state, "user_id", None)
    if isinstance(auth_subject, str) and auth_subject:
        return auth_subject

    return "anonymous"


def _get_chat_agent(agent_id: str, runtime_session: Session) -> Agent:
    agent = runtime_session.get(Agent, agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    if not agent.isEnabled:
        raise HTTPException(status_code=400, detail="Agent not enabled")
    return agent


def _read_field(value: Any, field_name: str) -> Any:
    if isinstance(value, dict):
        return value.get(field_name)
    return getattr(value, field_name, None)


def _extract_chat_text(events: list[Any]) -> str:
    for event in reversed(events):
        error = _read_field(event, "error")
        if isinstance(error, str) and error:
            return f"Error: {error}"

        detail = _read_field(event, "detail")
        if isinstance(detail, str) and detail:
            return f"Error: {detail}"

        for field_name in ("result", "text"):
            value = _read_field(event, field_name)
            if isinstance(value, str) and value:
                return value

        content = _read_field(event, "content")
        parts = _read_field(content, "parts") or []
        for part in parts:
            text = _read_field(part, "text")
            if isinstance(text, str) and text:
                return text

    return ""


@router.post("/{agent_id}/chat")
async def chat_agent(
    agent_id: str,
    body: ChatRequest,
    user_id: str = Depends(_resolve_chat_user_id),
):
    with Session(engine) as runtime_session:
        agent = runtime_session.get(Agent, agent_id)
        if agent is None:
            raise HTTPException(status_code=404, detail="Agent not found")
        if not agent.isEnabled:
            raise HTTPException(status_code=400, detail="Agent not enabled")
        try:
            target = (agent.deployment_target or "internal").lower()
            if target == "adk":
                target = "internal"
            if target == "internal":
                events, session_id = await chat_adk_agent(
                    agent.agent_id,
                    body.message,
                    session_id=body.session_id,
                )
            elif target == "vertex":
                from src.agent_runtime.vertex.service import (
                    chat_agent as chat_vertex_agent,
                )

                events, session_id = await chat_vertex_agent(
                    agent,
                    body.message,
                    session_id=body.session_id,
                    user_id=user_id,
                )
            elif target == "bedrock_agentcore":
                from src.agent_runtime.bedrock_agentcore.service import (
                    chat_agent_invoke_script as chat_bedrock_agentcore_agent,
                )

                events, session_id = await chat_bedrock_agentcore_agent(
                    agent,
                    body.message,
                    session_id=body.session_id,
                    user_id=user_id,
                )
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported deployment_target '{agent.deployment_target}'",
                )

            return {
                "session_id": session_id,
                "text": _extract_chat_text(events),
                "events": events,
            }
        except Exception as exc:
            logger.exception("Agent chat failed for agent %s", agent_id)
            raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/{agent_id}/chat/sessions", response_model=ChatSessionCreateResponse)
async def create_agent_chat_session(
    agent_id: str,
    user_id: str = Depends(_resolve_chat_user_id),
):
    with Session(engine) as runtime_session:
        agent = _get_chat_agent(agent_id, runtime_session)
        try:
            target = (agent.deployment_target or "internal").lower()
            if target == "adk":
                target = "internal"
            if target == "internal":
                return {
                    "session_id": await create_adk_session(
                        agent.agent_id, user_id=user_id
                    )
                }
            if target == "vertex":
                from src.agent_runtime.vertex.service import (
                    create_session as create_vertex_session,
                )

                return {
                    "session_id": await create_vertex_session(agent, user_id=user_id)
                }
            if target == "bedrock_agentcore":
                from src.agent_runtime.bedrock_agentcore.service import (
                    create_session as create_bedrock_agentcore_session,
                )

                return {
                    "session_id": await create_bedrock_agentcore_session(
                        agent, user_id=user_id
                    )
                }
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported deployment_target '{agent.deployment_target}'",
            )
        except Exception as exc:
            logger.error(exc)
            raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/{agent_id}/chat/sessions")
async def list_agent_chat_sessions(
    agent_id: str,
    user_id: str = Depends(_resolve_chat_user_id),
):
    with Session(engine) as runtime_session:
        agent = _get_chat_agent(agent_id, runtime_session)
        try:
            target = (agent.deployment_target or "internal").lower()
            if target == "adk":
                target = "internal"
            if target == "internal":
                return await list_adk_sessions(agent.agent_id, user_id=user_id)
            if target == "vertex":
                from src.agent_runtime.vertex.service import (
                    list_sessions as list_vertex_sessions,
                )

                return await list_vertex_sessions(agent, user_id=user_id)
            if target == "bedrock_agentcore":
                from src.agent_runtime.bedrock_agentcore.service import (
                    list_sessions as list_bedrock_agentcore_sessions,
                )

                return await list_bedrock_agentcore_sessions(agent, user_id=user_id)
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported deployment_target '{agent.deployment_target}'",
            )
        except Exception as exc:
            logger.error(exc)
            raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/{agent_id}/chat/sessions/{session_id}")
async def get_agent_chat_session(
    agent_id: str,
    session_id: str,
    user_id: str = Depends(_resolve_chat_user_id),
):
    with Session(engine) as runtime_session:
        agent = _get_chat_agent(agent_id, runtime_session)
        try:
            target = (agent.deployment_target or "internal").lower()
            if target == "adk":
                target = "internal"
            if target == "internal":
                return await get_adk_session(
                    agent.agent_id, user_id=user_id, session_id=session_id
                )
            if target == "vertex":
                from src.agent_runtime.vertex.service import (
                    get_session as get_vertex_session,
                )

                return await get_vertex_session(
                    agent, user_id=user_id, session_id=session_id
                )
            if target == "bedrock_agentcore":
                from src.agent_runtime.bedrock_agentcore.service import (
                    get_session as get_bedrock_agentcore_session,
                )

                return await get_bedrock_agentcore_session(
                    agent, user_id=user_id, session_id=session_id
                )
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported deployment_target '{agent.deployment_target}'",
            )
        except Exception as exc:
            logger.error(exc)
            raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.delete("/{agent_id}/chat/sessions/{session_id}")
async def delete_agent_chat_session(
    agent_id: str,
    session_id: str,
    user_id: str = Depends(_resolve_chat_user_id),
):
    with Session(engine) as runtime_session:
        agent = _get_chat_agent(agent_id, runtime_session)
        try:
            target = (agent.deployment_target or "internal").lower()
            if target == "adk":
                target = "internal"
            if target == "internal":
                await delete_adk_session(
                    agent.agent_id, user_id=user_id, session_id=session_id
                )
            elif target == "vertex":
                from src.agent_runtime.vertex.service import (
                    delete_session as delete_vertex_session,
                )

                await delete_vertex_session(
                    agent, user_id=user_id, session_id=session_id
                )
            elif target == "bedrock_agentcore":
                from src.agent_runtime.bedrock_agentcore.service import (
                    delete_session as delete_bedrock_agentcore_session,
                )

                await delete_bedrock_agentcore_session(
                    agent, user_id=user_id, session_id=session_id
                )
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported deployment_target '{agent.deployment_target}'",
                )
            return {"ok": True}
        except Exception as exc:
            logger.error(exc)
            raise HTTPException(status_code=500, detail=str(exc)) from exc


async def _invoke_agent_session_background(agent_id: str, prompt: str):
    try:
        await invoke_agent_session(agent_id, prompt)
    except Exception as e:
        logger.error(
            "Background webhook invocation failed for %s: %s",
            agent_id,
            e,
            exc_info=True,
        )


@router.post("/{agent_id}/webhook/invoke/{webhook_id}")
async def invoke_webhook(
    agent_id: str,
    webhook_id: UUID,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    body: WebhookInvoke | None = None,
):
    webhook = session.get(Webhook, webhook_id)
    if not webhook or webhook.agent_id != agent_id:
        raise HTTPException(status_code=404, detail="Webhook not found")

    final_prompt = body.prompt if body and body.prompt else webhook.prompt
    background_tasks.add_task(_invoke_agent_session_background, agent_id, final_prompt)
    return {"status": "accepted", "message": "Webhook invocation started"}


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

    from src.utils.scheduler import build_job_trigger

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
        url=job.url,
        method=job.method,
        headers=job.headers,
        body=job.body,
        conditions=[c.model_dump() for c in job.conditions] if job.conditions else None,
        condition_operator=job.condition_operator,
    )
    session.add(db_job)
    session.commit()
    session.refresh(db_job)

    from src.utils.scheduler import reload_jobs

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
    from src.agent_runtime.adk.cache import cache
    from src.utils.scheduler import scheduler

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

    from src.utils.scheduler import reload_jobs

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

import concurrent.futures
import logging
import threading

from fastapi import BackgroundTasks
from sqlmodel import Session

from src.agent_runtime.adk.adk_app import invalidate_cache as invalidate_adk_cache
from src.agent_runtime.adk.adk_app import invoke_agent as invoke_adk_agent
from src.database.database import engine
from src.database.models import Agent

logger = logging.getLogger(__name__)

_reconcile_executor = concurrent.futures.ThreadPoolExecutor(
    max_workers=2, thread_name_prefix="agent-runtime"
)
_reconcile_lock = threading.Lock()
_reconcile_inflight: set[str] = set()


def _normalize_target(deployment_target: str | None) -> str:
    # Treat missing target as local internal runtime and map legacy "adk".
    target = (deployment_target or "internal").lower()
    return "internal" if target == "adk" else target


def _unsupported_target_error(agent: Agent) -> ValueError:
    return ValueError(f"Unsupported deployment_target '{agent.deployment_target}'")


def sync_agent_runtime(agent: Agent, session: Session) -> None:
    # Keep the runtime in sync with the database record.
    # Internal means local cache refresh, Vertex/Bedrock mean remote deploy/disable.
    target = _normalize_target(agent.deployment_target)
    if not agent.isEnabled:
        if target == "internal":
            invalidate_adk_cache(agent.agent_id)
            return
        if target == "vertex":
            from src.agent_runtime.vertex.service import (
                disable_agent as disable_vertex_agent,
            )

            disable_vertex_agent(agent, session)
            return
        if target == "bedrock_agentcore":
            from src.agent_runtime.bedrock_agentcore.service import (
                disable_agent as disable_bedrock_agentcore_agent,
            )

            disable_bedrock_agentcore_agent(agent, session)
            return
        raise _unsupported_target_error(agent)

    if target == "internal":
        invalidate_adk_cache(agent.agent_id)
        return
    if target == "vertex":
        from src.agent_runtime.vertex.service import deploy_agent as deploy_vertex_agent

        deploy_vertex_agent(agent, session)
        return
    if target == "bedrock_agentcore":
        from src.agent_runtime.bedrock_agentcore.service import (
            deploy_agent as deploy_bedrock_agentcore_agent,
        )

        deploy_bedrock_agentcore_agent(agent, session)
        return
    raise _unsupported_target_error(agent)


def cleanup_agent_runtime(agent: Agent) -> None:
    # Remove runtime state for the agent's previous deployment target.
    target = _normalize_target(agent.deployment_target)
    if target == "internal":
        invalidate_adk_cache(agent.agent_id)
        return
    if target == "vertex":
        from src.agent_runtime.vertex.service import (
            cleanup_agent as cleanup_vertex_agent,
        )

        cleanup_vertex_agent(agent)
        return
    if target == "bedrock_agentcore":
        from src.agent_runtime.bedrock_agentcore.service import (
            cleanup_agent as cleanup_bedrock_agentcore_agent,
        )

        cleanup_bedrock_agentcore_agent(agent)
        return
    raise _unsupported_target_error(agent)


async def invoke_agent(agent: Agent, prompt: str):
    # Route one-off invocation to the correct runtime backend.
    target = _normalize_target(agent.deployment_target)
    if target == "internal":
        return await invoke_adk_agent(agent.agent_id, prompt)
    if target == "vertex":
        from src.agent_runtime.vertex.service import invoke_agent as invoke_vertex_agent

        return await invoke_vertex_agent(agent, prompt)
    if target == "bedrock_agentcore":
        from src.agent_runtime.bedrock_agentcore.service import (
            invoke_agent as invoke_bedrock_agentcore_agent,
        )

        return await invoke_bedrock_agentcore_agent(agent, prompt)
    raise _unsupported_target_error(agent)


def mark_agent_runtime_pending(agent: Agent) -> None:
    target = _normalize_target(agent.deployment_target)
    if target == "internal":
        agent.vertex_resource_name = None
        agent.vertex_deployment_status = None
        agent.vertex_deployment_error = None
        agent.bedrock_agentcore_resource_arn = None
        agent.bedrock_agentcore_deployment_status = None
        agent.bedrock_agentcore_deployment_error = None
        return

    if target == "vertex":
        agent.vertex_deployment_status = "pending"
        agent.vertex_deployment_error = None
        agent.bedrock_agentcore_resource_arn = None
        agent.bedrock_agentcore_deployment_status = None
        agent.bedrock_agentcore_deployment_error = None
        return

    if target == "bedrock_agentcore":
        agent.bedrock_agentcore_deployment_status = (
            "pending" if agent.isEnabled else "disabling"
        )
        agent.bedrock_agentcore_deployment_error = None
        agent.vertex_resource_name = None
        agent.vertex_deployment_status = None
        agent.vertex_deployment_error = None
        return

    raise _unsupported_target_error(agent)


def reconcile_agent_runtime(
    agent_id: str | None,
    previous_agent_data: dict | None = None,
) -> None:
    # Reconcile the current agent first, then clean up the old runtime if the
    # deployment target changed or the record was deleted.
    previous_agent = (
        Agent.model_validate(previous_agent_data) if previous_agent_data else None
    )

    with Session(engine) as session:
        current_agent = session.get(Agent, agent_id) if agent_id is not None else None

        try:
            if current_agent is not None:
                sync_agent_runtime(current_agent, session)
        except Exception:
            logger.exception("Failed to sync runtime for agent %s", agent_id)
            return

        if previous_agent is None:
            return

        current_target = (
            _normalize_target(current_agent.deployment_target)
            if current_agent is not None
            else None
        )
        if current_target == _normalize_target(previous_agent.deployment_target):
            return

        try:
            cleanup_agent_runtime(previous_agent)
        except Exception:
            logger.exception(
                "Failed to clean up previous runtime for agent %s",
                previous_agent.agent_id,
            )


def is_agent_runtime_reconcile_inflight(agent_id: str) -> bool:
    with _reconcile_lock:
        return agent_id in _reconcile_inflight


def enqueue_agent_runtime_reconcile(
    background_tasks: BackgroundTasks,
    *,
    agent_id: str | None,
    previous_agent: Agent | None = None,
) -> None:
    # Snapshot the previous agent so the background thread does not depend on
    # ORM objects after the request has finished.
    previous_data = previous_agent.model_dump() if previous_agent is not None else None

    def _submit_reconcile():
        # Deduplicate in-flight work per agent to avoid stacking deploy jobs.
        key = agent_id or (previous_agent.agent_id if previous_agent else "unknown")
        with _reconcile_lock:
            if key in _reconcile_inflight:
                return
            _reconcile_inflight.add(key)

        def _run_reconcile():
            try:
                reconcile_agent_runtime(agent_id, previous_data)
            finally:
                # Always release the key even if deployment fails.
                with _reconcile_lock:
                    _reconcile_inflight.discard(key)

        _reconcile_executor.submit(_run_reconcile)

    # Starlette BackgroundTasks run inline after sending the response; keep that
    # callback tiny and non-blocking so the event loop isn't stalled by Vertex deploys.
    background_tasks.add_task(_submit_reconcile)

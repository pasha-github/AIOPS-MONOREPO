import asyncio
import inspect
import logging
from datetime import datetime
from typing import Any

from fastapi.routing import APIRoute
from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_response import LlmResponse
from google.adk.plugins.base_plugin import BasePlugin
from sqlmodel import Session, col, delete

from src.database.database import engine
from src.database.models import ObservabilitySpan, ObservabilityTokenUsage

logger = logging.getLogger(__name__)
_pending_trace_tasks: set[asyncio.Task] = set()


def _stringify_id(value: Any) -> str | None:
    if value is None:
        return None
    return str(value)


def _get_session_id_from_callback_context(callback_context: CallbackContext) -> str:
    invocation_context = getattr(callback_context, "_invocation_context", None)
    session = getattr(invocation_context, "session", None)
    session_id = getattr(session, "id", None)
    return str(session_id) if session_id else ""


def _get_agent_id_from_callback_context(callback_context: CallbackContext) -> str:
    invocation_context = getattr(callback_context, "_invocation_context", None)
    app_name = getattr(invocation_context, "app_name", None)
    return str(app_name or callback_context.agent_name)


def _get_attr(obj: Any, name: str, default: Any = None) -> Any:
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def _usage_value(usage_metadata: Any, *names: str) -> int:
    for name in names:
        value = _get_attr(usage_metadata, name)
        if value is not None:
            return int(value)
    return 0


def _event_id(llm_response: LlmResponse) -> str | None:
    event_id = getattr(llm_response, "id", None)
    return str(event_id) if event_id else None


def _model_name(callback_context: CallbackContext, llm_response: LlmResponse) -> str:
    model_version = getattr(llm_response, "model_version", None)
    if model_version:
        return str(model_version)

    invocation_context = getattr(callback_context, "_invocation_context", None)
    agent = getattr(invocation_context, "agent", None)
    model = getattr(agent, "model", None)
    model_name = getattr(model, "model", None)
    return str(model_name or "unknown")


async def _get_session_trace_from_adk_app(session_id: str) -> list[dict[str, Any]]:
    from src.agent_runtime.adk.adk_app import ADK_APP

    for route in ADK_APP.routes:
        if (
            isinstance(route, APIRoute)
            and route.path == "/debug/trace/session/{session_id}"
        ):
            endpoint = route.endpoint
            result = endpoint(session_id=session_id)
            if inspect.isawaitable(result):
                result = await result
            return list(result or [])

    logger.warning("ADK session trace route was not found.")
    return []


def _serialize_span(agent_id: str, session_id: str, span: dict[str, Any]):
    return ObservabilitySpan(
        agent_id=agent_id,
        session_id=session_id,
        name=str(span.get("name", "")),
        span_id=str(span.get("span_id")),
        trace_id=str(span.get("trace_id")),
        start_time=span.get("start_time"),
        end_time=span.get("end_time"),
        attributes=span.get("attributes") or {},
        parent_span_id=_stringify_id(span.get("parent_span_id")),
        updated_at=datetime.now(),
    )


async def _store_session_trace_after_export(agent_id: str, session_id: str) -> None:
    for delay_seconds in (0, 0.05, 0.2):
        if delay_seconds:
            await asyncio.sleep(delay_seconds)
        else:
            await asyncio.sleep(0)
        spans = await _get_session_trace_from_adk_app(str(session_id))
        if spans:
            break
    else:
        return

    try:
        with Session(engine) as db_session:
            db_session.exec(
                delete(ObservabilitySpan).where(
                    col(ObservabilitySpan.agent_id) == str(agent_id),
                    col(ObservabilitySpan.session_id) == str(session_id),
                )
            )
            db_session.add_all(
                [
                    _serialize_span(str(agent_id), str(session_id), span)
                    for span in spans
                ]
            )
            db_session.commit()
    except Exception:
        logger.exception("Failed to store ADK session spans.")


class AdkObservabilityPlugin(BasePlugin):
    def __init__(self, name: str = "adk_observability_plugin"):
        super().__init__(name=name)

    async def after_model_callback(
        self,
        *,
        callback_context: CallbackContext,
        llm_response: LlmResponse,
    ) -> LlmResponse | None:
        usage_metadata = getattr(llm_response, "usage_metadata", None)
        if not usage_metadata:
            return None

        input_tokens = _usage_value(
            usage_metadata, "prompt_token_count", "input_tokens"
        )
        output_tokens = _usage_value(
            usage_metadata,
            "candidates_token_count",
            "output_tokens",
        )
        total_tokens = _usage_value(usage_metadata, "total_token_count")
        if total_tokens == 0:
            total_tokens = input_tokens + output_tokens

        agent_id = _get_agent_id_from_callback_context(callback_context)
        session_id = _get_session_id_from_callback_context(callback_context)
        if not agent_id or not session_id:
            return None

        invocation_id = getattr(callback_context, "invocation_id", None)
        usage = ObservabilityTokenUsage(
            agent_id=agent_id,
            session_id=session_id,
            llm_model=_model_name(callback_context, llm_response),
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            invocation_id=str(invocation_id) if invocation_id else None,
            event_id=_event_id(llm_response),
        )

        try:
            with Session(engine) as session:
                session.add(usage)
                session.commit()
        except Exception:
            logger.exception("Failed to store ADK token usage.")

        return None

    async def after_run_callback(self, *, invocation_context) -> None:
        session = getattr(invocation_context, "session", None)
        session_id = getattr(session, "id", None)
        agent_id = getattr(invocation_context, "app_name", None)
        if not session_id or not agent_id:
            return None

        task = asyncio.create_task(
            _store_session_trace_after_export(str(agent_id), str(session_id)),
        )
        _pending_trace_tasks.add(task)
        task.add_done_callback(_pending_trace_tasks.discard)

        return None


plugin = AdkObservabilityPlugin()

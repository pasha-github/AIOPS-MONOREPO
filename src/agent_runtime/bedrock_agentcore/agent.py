import logging
import os
import sys
from pathlib import Path
from typing import Any

import cloudpickle
from google.adk.plugins.base_plugin import BasePlugin
from google.adk.runners import Runner
from google.adk.sessions import DatabaseSessionService
from google.genai import types

from src.plugins.session_summary_plugin import plugin as session_summary_plugin

logger = logging.getLogger(__name__)

AGENT_ID = os.environ["AGENT_ID"]
APP_NAME = os.environ.get("APP_NAME", AGENT_ID)
DEFAULT_USER_ID = os.environ.get("DEFAULT_USER_ID", "anonymous")
AGENT_BUNDLE_FILE = Path(__file__).with_name("agent_bundle.pkl")
PROJECT_SRC_DIR = Path(__file__).resolve().parents[2]
CONNECTORS_DIR = PROJECT_SRC_DIR / "connectors"
DATABASE_URL = os.environ.get("AGENT_SERVER_DATABASE_URL", " ")
if not DATABASE_URL or not DATABASE_URL.strip():
    raise RuntimeError("AGENT_SERVER_DATABASE_URL is required for AgentCore sessions")

for import_path in (PROJECT_SRC_DIR, CONNECTORS_DIR):
    import_path_str = str(import_path)
    if import_path_str not in sys.path:
        sys.path.insert(0, import_path_str)

logger.info(
    "AgentCore runtime config: agent_id=%s app_name=%s connectors_dir=%s "
    "connectors_dir_exists=%s database_url_set=%s",
    AGENT_ID,
    APP_NAME,
    CONNECTORS_DIR,
    CONNECTORS_DIR.exists(),
    bool(DATABASE_URL.strip()),
)
logger.info("Loading bundled ADK agent for AgentCore: %s", AGENT_ID)
if not AGENT_BUNDLE_FILE.exists():
    raise RuntimeError(
        f"Bundled Bedrock AgentCore agent not found: {AGENT_BUNDLE_FILE}"
    )

with AGENT_BUNDLE_FILE.open("rb") as bundle_file:
    root_agent = cloudpickle.load(bundle_file)
logger.info(
    "Bundled ADK agent loaded: type=%s name=%s tool_names=%s",
    type(root_agent).__name__,
    getattr(root_agent, "name", None),
    [
        getattr(tool, "name", repr(tool))
        for tool in getattr(root_agent, "tools", []) or []
    ],
)


def _summarize_tool_result(result: Any) -> Any:
    if isinstance(result, dict):
        summary: dict[str, Any] = {"keys": sorted(result.keys())}
        status = result.get("status")
        if status is not None:
            summary["status"] = status
        code = result.get("code")
        if code is not None:
            summary["code"] = code
        data = result.get("data")
        if isinstance(data, list):
            summary["data_count"] = len(data)
        elif isinstance(data, dict):
            summary["data_keys"] = sorted(data.keys())
        return summary
    if isinstance(result, list):
        return {"type": "list", "count": len(result)}
    return {"type": type(result).__name__}


class BedrockToolLoggingPlugin(BasePlugin):
    def __init__(self, name: str = "bedrock_tool_logging_plugin"):
        super().__init__(name=name)

    async def before_tool_callback(
        self,
        *,
        tool,
        tool_args: dict[str, Any],
        tool_context,
    ) -> None:
        logger.info(
            "AgentCore tool call start: tool=%s agent=%s function_call_id=%s arg_keys=%s",
            getattr(tool, "name", repr(tool)),
            getattr(tool_context, "agent_name", None),
            getattr(tool_context, "function_call_id", None),
            sorted(tool_args.keys()),
        )
        return None

    async def after_tool_callback(
        self,
        *,
        tool,
        tool_args: dict[str, Any],
        tool_context,
        result,
    ) -> None:
        logger.info(
            "AgentCore tool call finished: tool=%s agent=%s function_call_id=%s result=%s",
            getattr(tool, "name", repr(tool)),
            getattr(tool_context, "agent_name", None),
            getattr(tool_context, "function_call_id", None),
            _summarize_tool_result(result),
        )
        return None

    async def on_tool_error_callback(
        self,
        *,
        tool,
        tool_args: dict[str, Any],
        tool_context,
        error: Exception,
    ) -> None:
        logger.exception(
            "AgentCore tool call failed: tool=%s agent=%s function_call_id=%s error_type=%s",
            getattr(tool, "name", repr(tool)),
            getattr(tool_context, "agent_name", None),
            getattr(tool_context, "function_call_id", None),
            error.__class__.__name__,
        )
        return None


session_service = DatabaseSessionService(db_url=DATABASE_URL)
runner = Runner(
    agent=root_agent,
    app_name=APP_NAME,
    session_service=session_service,
    plugins=[session_summary_plugin, BedrockToolLoggingPlugin()],
)


def _serialize_value(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return _serialize_value(value.model_dump())
    if isinstance(value, dict):
        return {key: _serialize_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_serialize_value(item) for item in value]
    return value


def _serialize_session(session: Any) -> dict[str, Any] | None:
    if session is None:
        return None
    return _serialize_value(session)


async def create_session(user_id: str, session_id: str | None = None) -> dict[str, Any]:
    logger.info(
        "AgentCore create_session requested: user_id=%s requested_session_id=%s",
        user_id,
        session_id,
    )
    session = await session_service.create_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=session_id,
    )
    serialized = _serialize_session(session)
    if serialized is None:
        raise ValueError("AgentCore session creation did not return a session")
    return serialized


async def list_sessions(user_id: str | None = None) -> list[dict[str, Any]]:
    logger.info("AgentCore list_sessions requested: user_id=%s", user_id)
    response = await session_service.list_sessions(app_name=APP_NAME, user_id=user_id)
    sessions = getattr(response, "sessions", [])
    return [
        {
            "id": getattr(session, "id", None),
            "user_id": getattr(session, "user_id", None),
        }
        for session in sessions
    ]


async def get_session(user_id: str, session_id: str) -> dict[str, Any] | None:
    logger.info(
        "AgentCore get_session requested: user_id=%s session_id=%s",
        user_id,
        session_id,
    )
    session = await session_service.get_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=session_id,
    )
    return _serialize_session(session)


async def delete_session(user_id: str, session_id: str) -> None:
    logger.info(
        "AgentCore delete_session requested: user_id=%s session_id=%s",
        user_id,
        session_id,
    )
    await session_service.delete_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=session_id,
    )


async def get_or_create_session(user_id: str, session_id: str) -> None:
    logger.info(
        "AgentCore get_or_create_session: user_id=%s session_id=%s",
        user_id,
        session_id,
    )
    existing = await session_service.get_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=session_id,
    )
    if existing is None:
        await session_service.create_session(
            app_name=APP_NAME,
            user_id=user_id,
            session_id=session_id,
        )


async def run_agent(prompt: str, user_id: str, session_id: str) -> str:
    logger.info(
        "AgentCore run_agent start: user_id=%s session_id=%s prompt_chars=%s",
        user_id,
        session_id,
        len(prompt),
    )
    await get_or_create_session(user_id, session_id)

    message = types.Content(role="user", parts=[types.Part(text=prompt)])
    final_response = ""

    event_count = 0
    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=message,
    ):
        event_count += 1
        logger.info(
            "AgentCore runner event: index=%s type=%s final=%s author=%s "
            "has_content=%s actions=%s",
            event_count,
            type(event).__name__,
            event.is_final_response(),
            getattr(event, "author", None),
            bool(getattr(event, "content", None)),
            type(getattr(event, "actions", None)).__name__
            if getattr(event, "actions", None) is not None
            else None,
        )
        if event.is_final_response() and event.content and event.content.parts:
            final_response = event.content.parts[0].text or ""
            logger.info(
                "AgentCore final response captured: session_id=%s response_chars=%s",
                session_id,
                len(final_response),
            )

    logger.info(
        "AgentCore run_agent finished: user_id=%s session_id=%s events=%s "
        "response_chars=%s",
        user_id,
        session_id,
        event_count,
        len(final_response),
    )
    return final_response


async def close() -> None:
    await session_service.close()

import inspect

from google.adk.cli.adk_web_server import AdkWebServer
from google.adk.cli.fast_api import get_fast_api_app  # as requested
from google.genai import types

from src.agent_runtime.adk.agent_loader import DatabaseAgentLoader
from src.agent_runtime.adk.cache import cache
from src.utils.constants import (
    A2A,
    AGENT_SERVER_DATABASE_URL,
    GOOGLE_GCP_AGENT_EVAL_BUCKET,
    WEB,
)


def _get_adk_web_server_instance(fastapi_app) -> AdkWebServer:
    """Extracts the internal AdkWebServer instance from route closures."""
    # Google ADK does not expose this instance directly, so we recover it from
    # the generated FastAPI route closure.
    for route in fastapi_app.routes:
        if getattr(route, "name", "") == "run_agent":
            # The route endpoint is a nested function that closes over 'self'
            closure_vars = inspect.getclosurevars(route.endpoint)
            adk_web_server_instance: AdkWebServer | None = closure_vars.nonlocals.get(
                "self"
            )

            if adk_web_server_instance is None:
                continue

            return adk_web_server_instance
    raise Exception("Adk web server instance not found")


def _invalidate_runner_cache(app_name: str):
    # Mark this runner for rebuild on the next request.
    if adk_web_server_instance:
        # The next time a request hits this app, it will safely close
        # the old runner and load a fresh one via your custom loader.
        adk_web_server_instance.runners_to_clean.add(app_name)


def invalidate_cache(agent_id: str):
    """Invalidates the cache for a specific agent."""
    agent_in_cache = cache.get_agent(agent_id)
    if not agent_in_cache:
        return
    # Drop the built agent object from our local cache.
    cache.remove_agent(agent_id)
    # Also tell ADK to discard the old runner instance.
    _invalidate_runner_cache(agent_id)


async def invoke_agent(agent_id: str, prompt: str):
    # One-off invoke reuses chat without a caller-managed session.
    events, _session_id = await chat_agent(agent_id, prompt, session_id=None)
    return events


async def chat_agent(agent_id: str, prompt: str, session_id: str | None = None):
    # Local ADK chat runs against the in-process runner loaded from the DB.
    user_id = "user"
    if session_id is None:
        session_res = await adk_web_server_instance.session_service.create_session(
            app_name=agent_id, user_id=user_id
        )
        session_id = session_res.id

    # The runner is created lazily and reused until invalidated.
    runner = await adk_web_server_instance.get_runner_async(agent_id)
    events = []
    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=types.Content(role="user", parts=[types.Part(text=prompt)]),
    ):
        events.append(event)

    return events, session_id


async def create_session(agent_id: str, *, user_id: str) -> str:
    # Sessions are managed by ADK's session service even for local agents.
    session = await adk_web_server_instance.session_service.create_session(
        app_name=agent_id, user_id=user_id
    )
    return session.id


async def list_sessions(agent_id: str, *, user_id: str):
    return await adk_web_server_instance.session_service.list_sessions(
        app_name=agent_id, user_id=user_id
    )


async def get_session(agent_id: str, *, user_id: str, session_id: str):
    return await adk_web_server_instance.session_service.get_session(
        app_name=agent_id, user_id=user_id, session_id=session_id
    )


async def delete_session(agent_id: str, *, user_id: str, session_id: str) -> None:
    await adk_web_server_instance.session_service.delete_session(
        app_name=agent_id, user_id=user_id, session_id=session_id
    )


# agents_dir is required by ADK, but this app loads agents from the database
# instead of from files on disk.
ADK_APP = get_fast_api_app(
    agents_dir="agents",
    web=WEB,
    a2a=bool(A2A),
    agent_loader=DatabaseAgentLoader(),
    auto_create_session=True,
    session_service_uri=AGENT_SERVER_DATABASE_URL,
    url_prefix="/agent-server",
    logo_text="RC AIOps - DEV",
    allow_origins=["*"],
    logo_image_url="/static/royal_cyber.jpeg",
    extra_plugins=[
        "src.plugins.session_summary_plugin.plugin",
        "src.plugins.observability_plugin.plugin",
    ],
    eval_storage_uri=GOOGLE_GCP_AGENT_EVAL_BUCKET,
)

# Keep a direct handle to the internal web server for runner/session access.
adk_web_server_instance: AdkWebServer = _get_adk_web_server_instance(ADK_APP)

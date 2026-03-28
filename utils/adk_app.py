import inspect

from google.adk.cli.adk_web_server import AdkWebServer
from google.adk.cli.fast_api import get_fast_api_app  # as requested

from utils.agent_loader import DatabaseAgentLoader
from utils.cache import cache
from utils.constants import A2A, AGENT_SERVER_DATABASE_URL, WEB


def _get_adk_web_server_instance(fastapi_app) -> AdkWebServer:
    """Extracts the internal AdkWebServer instance from route closures."""
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
    if adk_web_server_instance:
        # The next time a request hits this app, it will safely close
        # the old runner and load a fresh one via your custom loader.
        adk_web_server_instance.runners_to_clean.add(app_name)


def invalidate_cache(agent_id: str):
    """Invalidates the cache for a specific agent."""
    agent_in_cache = cache.get_agent(agent_id)
    if not agent_in_cache:
        return
    # Remove from cache
    cache.remove_agent(agent_id)
    # Invalidate runner cache
    _invalidate_runner_cache(agent_id)


# agents_dir is required, we use 'agents' as dummy/default.
ADK_APP = get_fast_api_app(
    agents_dir="agents",
    web=WEB,
    a2a=bool(A2A),
    agent_loader=DatabaseAgentLoader(),
    auto_create_session=True,
    session_service_uri=AGENT_SERVER_DATABASE_URL,
    url_prefix="/agent-server",
    logo_text="RC AIOps - DEV",
    logo_image_url="/static/royal_cyber.jpeg",
)

# Retrieve the server instance
adk_web_server_instance: AdkWebServer = _get_adk_web_server_instance(ADK_APP)

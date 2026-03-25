import asyncio
import logging
from typing import Any, Callable

from microsoft_teams.apps import App

from routers.alerts import register_alert_routes
from database.database import init_db
from routers.handlers import register_handlers
from routers.middleware import register_middleware
from utils.config import get_config
from utils.teams_runtime import (
    disable_user_token_lookup,
    normalize_api_client_service_urls,
)

config = get_config()
config.validate_startup()
disable_user_token_lookup()
normalize_api_client_service_urls()


# -----------------------------------------------------------------------------
# App auth bootstrap
# -----------------------------------------------------------------------------
class _HttpCompat:
    """Compatibility shim for SDK builds where App.http is not exposed."""

    def __init__(self, app: App):
        self._app = app
        self._fastapi = app.server.adapter.app

    def middleware(self, *args: Any, **kwargs: Any) -> Callable[..., Any]:
        return self._fastapi.middleware(*args, **kwargs)

    def post(self, *args: Any, **kwargs: Any) -> Callable[..., Any]:
        return self._fastapi.post(*args, **kwargs)

    async def send(self, *args: Any, **kwargs: Any) -> Any:
        return await self._app.send(*args, **kwargs)


def create_app() -> App:
    app = App(skip_auth=False)
    if not hasattr(app, "http"):
        app.http = _HttpCompat(app)  # type: ignore[attr-defined]
    if not hasattr(app, "logger"):
        app.logger = logging.getLogger(__name__)  # type: ignore[attr-defined]
    return app


app = create_app()

# Ensure storage schema is ready before request handlers use it.
init_db()

register_middleware(app, enable_activity_timing_log=False)
register_handlers(app, config)
register_alert_routes(app, config)

__all__ = ["app", "create_app"]


if __name__ == "__main__":
    # Start the Teams bot HTTP listener (default port 3978).
    asyncio.run(app.start())

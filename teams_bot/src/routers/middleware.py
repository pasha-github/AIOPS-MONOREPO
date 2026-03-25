import json
import time
from typing import Any

from fastapi import Request
from microsoft.teams.apps import App

MESSAGES_ROUTE = "/api/messages"


def register_middleware(app: App, enable_activity_timing_log: bool) -> None:
    # -----------------------------------------------------------------------
    # Incoming activity compatibility shim
    # -----------------------------------------------------------------------
    @app.http.middleware("http")
    async def normalize_activity_payload(request: Request, call_next):
        """
        Normalize incoming Bot Framework payloads before SDK validation.

        Some local channels (for example Playground/Web Chat) can send
        `conversationUpdate` without `channelData`. The current SDK activity
        model requires this field, so we inject an empty object to keep parsing
        stable.
        """

        if request.method.upper() != "POST" or request.url.path != MESSAGES_ROUTE:
            return await call_next(request)

        try:
            raw_body = await request.body()
        except Exception:
            return await call_next(request)

        if not raw_body:
            return await call_next(request)

        patched_body = raw_body
        try:
            payload = json.loads(raw_body)
            if (
                isinstance(payload, dict)
                and payload.get("type") == "conversationUpdate"
            ):
                if "channelData" not in payload or payload.get("channelData") is None:
                    payload["channelData"] = {}
                    patched_body = json.dumps(payload).encode("utf-8")
        except json.JSONDecodeError:
            pass

        receive_state = {"sent": False}

        async def receive() -> dict[str, Any]:
            if receive_state["sent"]:
                return {"type": "http.request", "body": b"", "more_body": False}
            receive_state["sent"] = True
            return {"type": "http.request", "body": patched_body, "more_body": False}

        request = Request(request.scope, receive)
        return await call_next(request)

    @app.http.middleware("http")
    async def log_activity_timing(request: Request, call_next):
        """Log `/api/messages` request duration for local latency debugging."""

        if not enable_activity_timing_log or request.url.path != MESSAGES_ROUTE:
            return await call_next(request)

        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            elapsed_ms = (time.perf_counter() - started) * 1000
            app.logger.exception("POST /api/messages failed after %.1f ms", elapsed_ms)
            raise

        elapsed_ms = (time.perf_counter() - started) * 1000
        app.logger.info(
            "POST /api/messages -> %s in %.1f ms", response.status_code, elapsed_ms
        )
        return response

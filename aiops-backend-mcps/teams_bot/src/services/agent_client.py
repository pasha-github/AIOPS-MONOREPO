import json
from dataclasses import dataclass
from typing import Awaitable, Callable
from urllib.parse import quote

import httpx

@dataclass
class AgentReply:
    text: str
    emitted_any: bool = False


class AdkStreamError(RuntimeError):
    """Raised when ADK returns an explicit stream-level error payload."""


# Receives each agent turn's text as soon as that turn completes.
TextCallback = Callable[[str], Awaitable[None]]


def _trim_base_url(value: str) -> str:
    return value.rstrip("/")


def _quote_path(value: str) -> str:
    return quote(str(value), safe="")


def _build_create_session_url(
    adk_base_url: str, app_name: str, user_id: str, session_id: str
) -> str:
    base = _trim_base_url(adk_base_url)
    return (
        f"{base}/apps/{_quote_path(app_name)}/users/{_quote_path(user_id)}"
        f"/sessions/{_quote_path(session_id)}"
    )


def _build_run_sse_url(adk_base_url: str) -> str:
    return f"{_trim_base_url(adk_base_url)}/run_sse"


def _merge_streaming_text(current_text: str, incoming_text: str) -> str:
    if not incoming_text:
        return current_text
    if not current_text:
        return incoming_text
    if incoming_text.startswith(current_text):
        return incoming_text
    if current_text.endswith(incoming_text):
        return current_text
    return f"{current_text}{incoming_text}"


def _extract_sse_payloads(raw_event: str) -> list[dict]:
    payload_lines: list[str] = []
    for line in raw_event.splitlines():
        if not line.startswith("data:"):
            continue
        payload_lines.append(line[5:].lstrip())

    if not payload_lines:
        return []

    data_blob = "\n".join(payload_lines).strip()
    if not data_blob or data_blob == "[DONE]":
        return []
    try:
        parsed = json.loads(data_blob)
    except json.JSONDecodeError:
        return []
    if isinstance(parsed, dict):
        return [parsed]
    return []


async def _create_session_with_id(
    client: httpx.AsyncClient,
    adk_base_url: str,
    app_name: str,
    user_id: str,
    session_id: str,
) -> None:
    response = await client.post(
        _build_create_session_url(adk_base_url, app_name, user_id, session_id),
        headers={
            "accept": "application/json",
            "Content-Type": "application/json",
        },
        json={},
    )
    if response.status_code in {200, 201, 204, 409}:
        return
    response.raise_for_status()


async def _run_prompt_sse(
    client: httpx.AsyncClient,
    adk_base_url: str,
    app_name: str,
    user_id: str,
    session_id: str,
    message: str,
    on_text: TextCallback | None = None,
) -> AgentReply:
    request_payload = {
        "appName": app_name,
        "userId": user_id,
        "sessionId": session_id,
        "streaming": True,
        "newMessage": {
            "role": "user",
            "parts": [{"text": message}],
        },
    }
    # ADK emits a run as a series of turns. Events with `partial=true` carry text deltas;
    # any other event (a model turn closing with partial=false, or a tool-result event with
    # partial absent) ends the current turn. Every turn's text is handed to on_text as soon
    # as the turn closes, so the caller renders the run in the order it happened.
    turn_text = ""
    event_buffer = ""
    emitted_any = False

    async def close_turn() -> None:
        """Emit the finished turn's text, if it produced any."""
        nonlocal turn_text, emitted_any
        finished = turn_text.strip()
        turn_text = ""
        # Tool calls and tool results carry no text of their own.
        if not finished:
            return
        emitted_any = True
        if on_text:
            await on_text(finished)

    async def process_payload(payload: dict) -> None:
        """Accumulate text deltas and flush each turn as it closes."""
        nonlocal turn_text

        error_text = str(payload.get("error") or "").strip()
        if error_text:
            raise AdkStreamError(error_text)

        content = payload.get("content")
        parts = content.get("parts") if isinstance(content, dict) else None
        if not isinstance(parts, list):
            parts = []

        visible_parts = [
            str(part.get("text") or "")
            for part in parts
            if isinstance(part, dict)
            and isinstance(part.get("text"), str)
            and not part.get("thought")
        ]
        if visible_parts:
            # ADK's closing event re-sends the whole turn's accumulated text rather than a
            # delta (StreamingResponseAggregator.close), so merge instead of appending.
            turn_text = _merge_streaming_text(turn_text, "".join(visible_parts))

        # Deltas arrive with partial=true; anything else ends the turn. Tool-result events
        # omit the field entirely, so test for "not true" rather than "false".
        if payload.get("partial") is not True:
            await close_turn()

    async with client.stream(
        "POST",
        _build_run_sse_url(adk_base_url),
        headers={
            "accept": "text/event-stream",
            "Content-Type": "application/json",
        },
        json=request_payload,
    ) as response:
        if response.status_code >= 400:
            response.raise_for_status()

        async for chunk in response.aiter_text():
            if not chunk:
                continue
            event_buffer += chunk.replace("\r\n", "\n")
            while "\n\n" in event_buffer:
                raw_event, event_buffer = event_buffer.split("\n\n", 1)
                for payload in _extract_sse_payloads(raw_event):
                    await process_payload(payload)

    if event_buffer.strip():
        for payload in _extract_sse_payloads(event_buffer):
            await process_payload(payload)

    # A stream cut off before its closing event still has text worth showing.
    await close_turn()

    # Every turn was already delivered through on_text, so there is nothing left to post.
    # An empty flag lets the caller show a fallback when the agent produced no text at all.
    return AgentReply(text="", emitted_any=emitted_any)


async def fetch_agent_reply(
    adk_base_url: str,
    app_name: str,
    user_id: str,
    session_id: str,
    message: str,
    on_text: TextCallback | None = None,
) -> AgentReply:
    """Call ADK session+SSE endpoints without replaying a submitted user message."""
    adk_session_id = str(session_id or "").strip()
    adk_user_id = str(user_id or "").strip()
    print(
        "[teams_bot] adk_ids",
        {
            "raw_user_id": user_id,
            "adk_user_id": adk_user_id,
            "raw_session_id": session_id,
            "adk_session_id": adk_session_id,
        },
        flush=True,
    )

    async with httpx.AsyncClient(timeout=None) as client:
        await _create_session_with_id(
            client=client,
            adk_base_url=adk_base_url,
            app_name=app_name,
            user_id=adk_user_id,
            session_id=adk_session_id,
        )
        return await _run_prompt_sse(
            client=client,
            adk_base_url=adk_base_url,
            app_name=app_name,
            user_id=adk_user_id,
            session_id=adk_session_id,
            message=message,
            on_text=on_text,
        )

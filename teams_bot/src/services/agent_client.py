import asyncio
import hashlib
import json
import re
from dataclasses import dataclass
from typing import Awaitable, Callable
from urllib.parse import quote

import httpx

SAFE_SESSION_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,128}$")


@dataclass
class AgentReply:
    text: str


class AdkStreamError(RuntimeError):
    """Raised when ADK returns an explicit stream-level error payload."""


EventCallback = Callable[[str], Awaitable[None]]


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


def _to_adk_safe_session_id(session_id: str) -> str:
    value = (session_id or "").strip()
    if SAFE_SESSION_ID_PATTERN.fullmatch(value):
        return value
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()
    return f"teams_{digest[:48]}"


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


def _normalize_tool_name(raw_name: object) -> str:
    value = str(raw_name or "").strip()
    if not value:
        return "unknown tool"
    value = re.sub(r"[_-]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


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
    on_event: EventCallback | None = None,
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
    stream_text = ""
    sent_events: set[str] = set()
    event_buffer = ""

    async def add_event_once(label: str) -> None:
        cleaned = label.strip()
        if cleaned and cleaned not in sent_events:
            sent_events.add(cleaned)
            if on_event:
                await on_event(cleaned)

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
                    error_text = str(payload.get("error") or "").strip()
                    if error_text:
                        raise AdkStreamError(error_text)

                    actions = payload.get("actions")
                    if isinstance(actions, dict):
                        confirmations = actions.get("requestedToolConfirmations")
                        if isinstance(confirmations, dict) and confirmations:
                            await add_event_once("Awaiting tool confirmation")

                    content = payload.get("content")
                    if not isinstance(content, dict):
                        continue
                    parts = content.get("parts")
                    if not isinstance(parts, list):
                        continue

                    for part in parts:
                        if not isinstance(part, dict):
                            continue
                        function_call = part.get("functionCall")
                        if isinstance(function_call, dict):
                            await add_event_once(
                                f"Running {_normalize_tool_name(function_call.get('name'))}"
                            )
                        function_response = part.get("functionResponse")
                        if isinstance(function_response, dict):
                            await add_event_once(
                                f"Received {_normalize_tool_name(function_response.get('name'))} results"
                            )

                    visible_parts = [
                        str(part.get("text") or "")
                        for part in parts
                        if isinstance(part, dict)
                        and isinstance(part.get("text"), str)
                        and not part.get("thought")
                    ]
                    if visible_parts:
                        stream_text = _merge_streaming_text(
                            stream_text, "".join(visible_parts)
                        )

    if event_buffer.strip():
        for payload in _extract_sse_payloads(event_buffer):
            error_text = str(payload.get("error") or "").strip()
            if error_text:
                raise AdkStreamError(error_text)

            actions = payload.get("actions")
            if isinstance(actions, dict):
                confirmations = actions.get("requestedToolConfirmations")
                if isinstance(confirmations, dict) and confirmations:
                    await add_event_once("Awaiting tool confirmation")

            content = payload.get("content")
            if not isinstance(content, dict):
                continue
            parts = content.get("parts")
            if not isinstance(parts, list):
                continue

            for part in parts:
                if not isinstance(part, dict):
                    continue
                function_call = part.get("functionCall")
                if isinstance(function_call, dict):
                    await add_event_once(
                        f"Running {_normalize_tool_name(function_call.get('name'))}"
                    )
                function_response = part.get("functionResponse")
                if isinstance(function_response, dict):
                    await add_event_once(
                        f"Received {_normalize_tool_name(function_response.get('name'))} results"
                    )

            visible_parts = [
                str(part.get("text") or "")
                for part in parts
                if isinstance(part, dict)
                and isinstance(part.get("text"), str)
                and not part.get("thought")
            ]
            if visible_parts:
                stream_text = _merge_streaming_text(stream_text, "".join(visible_parts))

    if stream_text.strip():
        return AgentReply(text=stream_text)
    return AgentReply(text="I received an empty response from the agent service.")


async def fetch_agent_reply(
    adk_base_url: str,
    app_name: str,
    user_id: str,
    session_id: str,
    message: str,
    on_event: EventCallback | None = None,
) -> AgentReply:
    """Call ADK session+SSE endpoints without replaying a submitted user message."""
    adk_session_id = _to_adk_safe_session_id(session_id)

    async with httpx.AsyncClient(timeout=None) as client:
        await _create_session_with_id(
            client=client,
            adk_base_url=adk_base_url,
            app_name=app_name,
            user_id=user_id,
            session_id=adk_session_id,
        )
        return await _run_prompt_sse(
            client=client,
            adk_base_url=adk_base_url,
            app_name=app_name,
            user_id=user_id,
            session_id=adk_session_id,
            message=message,
            on_event=on_event,
        )

"""DOCFlow agent core.

Two entry points:
- run_sync_once()        periodic sync of Approved documents, delta-aware
- run_doc_query(doc_id)  on-demand pull of one specific document (chat)

Both drive a real browser through the Playwright MCP server; results are
appended to the Postgres lifecycle ledger.
"""
import asyncio
import json
import logging
import os
import re
from typing import Any

from openai import AsyncOpenAI
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

import db

log = logging.getLogger("docflow.agent")

MCP_URL = os.environ.get("MCP_URL", "http://playwright-mcp:8931/mcp")
# OpenRouter speaks the OpenAI wire format; any OpenRouter model id works here.
OPENROUTER_BASE_URL = os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
MODEL = os.environ.get("AGENT_MODEL", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free")
MAX_STEPS = int(os.environ.get("MAX_AGENT_STEPS", "40"))
STATUS_FILTER = os.environ.get("STATUS_FILTER", "Approved")
DOWNLOADS_DIR = os.environ.get("DOWNLOADS_DIR", "/downloads")

# The MCP server drives a single browser: serialize all runs.
browser_lock = asyncio.Lock()

COMMON_RULES = """
RULES
- Work step by step; verify each page with browser_snapshot before acting.
- Never navigate outside the {host} domain.
- If login fails twice, stop and return {{"documents": [], "notes": "LOGIN_FAILED"}}.
- Do not invent data: only report what you actually saw on pages.
- Respond at the end with ONLY a JSON object — no prose, no markdown fences.
"""

SYNC_PROMPT = """You are a Document Controller automation agent operating a real
browser through Playwright tools.

TASK — periodic sync
1. Navigate to {url} and log in (username: {user} / password: {password}).
2. Open the document register / document list.
3. Identify ONLY documents whose status is "{status}" (match the status
   case-insensitively — the portal may display it as e.g. APPROVED). Prefer
   the list's status filter control if one exists.
4. DELTA SYNC — these document numbers (with revision) were already pulled in
   previous runs. SKIP them entirely UNLESS the revision shown in the list is
   different from the one recorded here:
{skip_list}
5. For each remaining {status_lower} document (up to 10):
   a. Open it; read doc number, title, revision, status, ALL comments.
   b. Download every attachment; note each downloaded filename.
   c. Go back to the list.
6. Final answer JSON:
{{"documents": [{{"doc_no": "...", "title": "...", "revision": "...",
  "status": "{status}", "comments": ["..."], "attachments": ["file.pdf"]}}],
  "notes": "anything unusual, e.g. how many docs were skipped by delta"}}
""" + COMMON_RULES

QUERY_PROMPT = """You are a Document Controller automation agent operating a real
browser through Playwright tools.

TASK — targeted lookup requested by a user in chat
1. Navigate to {url} and log in (username: {user} / password: {password}).
2. Use the portal's search to find the document with ID / number: "{doc_id}".
   Search ONLY for this document. Do not open any other document.
3. If found: open it; read doc number, title, revision, status, ALL comments;
   download every attachment and note each downloaded filename.
4. If not found, say so in notes.
5. Final answer JSON:
{{"documents": [{{"doc_no": "...", "title": "...", "revision": "...",
  "status": "...", "comments": ["..."], "attachments": ["file.pdf"]}}],
  "notes": "..."}}
""" + COMMON_RULES


def _mcp_tools_to_openai(tools) -> list[dict[str, Any]]:
    return [
        {
            "type": "function",
            "function": {
                "name": t.name,
                "description": (t.description or "")[:1000],
                "parameters": t.inputSchema or {"type": "object", "properties": {}},
            },
        }
        for t in tools.tools
    ]


def _tool_result_to_text(result) -> str:
    parts = [getattr(b, "text", "") for b in (result.content or [])]
    return ("\n".join(p for p in parts if p) or "(no output)")[:60000]


def _extract_json(text: str) -> dict[str, Any] | None:
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                return None
    return None


class _SessionLost(Exception):
    """Raised when the MCP session has died (server restart / browser crash)."""


class _LLMBackendError(Exception):
    """The model backend returned no completion (e.g. OpenRouter free-tier
    upstream provider error embedded in an HTTP 200 response) after retries."""


def _looks_like_session_death(exc: Exception) -> bool:
    s = str(exc)
    return "404" in s or "Connect" in s or "connect" in s or "disconnected" in s


SESSION_LOST_NOTE = (
    "NOTE: The browser crashed and a NEW browser session has been started. "
    "All page state is gone — you are back at a blank page. Navigate to the "
    "portal again from the start, log in again, and continue the task from "
    "where you left off. Do not repeat work already completed and reported."
)


async def _run_session(client: AsyncOpenAI, tools_cache: list | None,
                       messages: list[dict[str, Any]], steps_used: int,
                       ) -> tuple[str, int, bool]:
    """One MCP session worth of agent steps.

    Returns (final_text, steps_used, done). Raises _SessionLost if the MCP
    session dies so the caller can reconnect and continue the conversation.
    """
    final_text = ""
    async with streamablehttp_client(MCP_URL) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = tools_cache or _mcp_tools_to_openai(await session.list_tools())
            log.info("MCP connected — %d browser tools", len(tools))

            consecutive_failures = 0
            while steps_used < MAX_STEPS:
                steps_used += 1
                # Async client: a sync call here would block the event loop for
                # the whole API round-trip, starving the MCP session's GET/SSE
                # keepalives — the server then reaps the session and every
                # later request 404s.
                resp, backend_err = None, None
                for llm_attempt in range(3):
                    resp = await client.chat.completions.create(
                        model=MODEL, max_tokens=4000, tools=tools, messages=messages,
                    )
                    if resp.choices:
                        break
                    # OpenRouter (esp. free-tier upstreams) sometimes returns
                    # HTTP 200 with an error payload instead of choices.
                    backend_err = getattr(resp, "error", None) or resp.model_dump()
                    log.warning("LLM returned no choices (attempt %d/3): %s",
                                llm_attempt + 1, backend_err)
                    await asyncio.sleep(3)
                if not resp.choices:
                    raise _LLMBackendError(
                        f"model backend returned no choices after 3 attempts: {backend_err}")
                msg = resp.choices[0].message
                tool_calls = msg.tool_calls or []
                if msg.content:
                    final_text = msg.content
                if not tool_calls:
                    log.info("Agent finished after %d steps", steps_used)
                    return final_text, steps_used, True

                messages.append({
                    "role": "assistant",
                    "content": msg.content,
                    "tool_calls": [
                        {"id": tc.id, "type": "function",
                         "function": {"name": tc.function.name,
                                      "arguments": tc.function.arguments}}
                        for tc in tool_calls
                    ],
                })
                batch_failed = False
                for tc in tool_calls:
                    try:
                        tool_input = json.loads(tc.function.arguments or "{}")
                    except json.JSONDecodeError as e:
                        content, is_error = f"TOOL ERROR: invalid JSON arguments: {e}", True
                        tool_input = None
                    if tool_input is not None:
                        log.info("step %02d → %s(%s)", steps_used, tc.function.name,
                                 tc.function.arguments[:200])
                        try:
                            r = await session.call_tool(tc.function.name, tool_input)
                            content = _tool_result_to_text(r)
                            is_error = bool(getattr(r, "isError", False))
                            if is_error and ("404" in content or "No open pages" in content
                                             or "Target closed" in content
                                             or "has been closed" in content):
                                log.warning("transport failure %d: %s",
                                            consecutive_failures + 1, content[:200])
                                batch_failed = True
                                consecutive_failures += 1
                            else:
                                consecutive_failures = 0
                        except Exception as e:
                            content, is_error = f"TOOL ERROR: {e}", True
                            if _looks_like_session_death(e):
                                log.warning("transport failure %d: %s",
                                            consecutive_failures + 1, e)
                                batch_failed = True
                                consecutive_failures += 1
                    messages.append({
                        "role": "tool", "tool_call_id": tc.id, "content": content,
                    })

                if batch_failed and consecutive_failures >= 2:
                    raise _SessionLost()

    log.warning("Hit MAX_AGENT_STEPS=%d — stopping", MAX_STEPS)
    return final_text, steps_used, True


async def _agent_loop(system: str) -> dict[str, Any]:
    """Run the LLM<->Playwright-MCP loop with automatic session recovery."""
    client = AsyncOpenAI(
        base_url=OPENROUTER_BASE_URL,
        api_key=os.environ["OPENROUTER_API_KEY"],
        default_headers={
            "HTTP-Referer": os.environ.get("OPENROUTER_SITE_URL", "http://localhost"),
            "X-Title": os.environ.get("OPENROUTER_APP_NAME", "DOCFlow Agent"),
        },
    )
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system},
        {"role": "user", "content": "Begin the task now."},
    ]
    final_text, steps_used = "", 0
    max_reconnects = 2

    for attempt in range(max_reconnects + 1):
        try:
            final_text, steps_used, done = await _run_session(
                client, None, messages, steps_used)
            if done:
                break
        except _SessionLost:
            if attempt >= max_reconnects:
                log.error("MCP session lost %d times — giving up this run",
                          attempt + 1)
                break
            log.warning("MCP session lost — waiting 8s, then reconnecting with "
                        "a fresh browser (attempt %d/%d)", attempt + 1, max_reconnects)
            await asyncio.sleep(8)
            messages.append({"role": "user", "content": SESSION_LOST_NOTE})

    return _extract_json(final_text) or {"documents": [], "notes": "NO_JSON_OUTPUT"}


def _store_documents(run_id: int, docs: list[dict[str, Any]],
                     known: set[tuple[str, str]] | None = None) -> int:
    """Append doc events + attachments; skip (doc_no, revision) already in the
    ledger when a known set is provided (delta belt-and-braces)."""
    stored = 0
    for d in docs:
        doc_no = d.get("doc_no", "UNKNOWN")
        revision = d.get("revision") or ""
        if known is not None and (doc_no, revision) in known:
            log.info("delta: skipping already-synced %s rev %s", doc_no, revision)
            continue
        db.append_doc_event(
            run_id=run_id, doc_no=doc_no, title=d.get("title"),
            revision=revision or None, status=d.get("status", "Unknown"),
            comment=" | ".join(d.get("comments", [])) or None,
        )
        for fname in d.get("attachments", []):
            db.append_attachment(run_id=run_id, doc_no=doc_no, filename=fname,
                                 file_path=os.path.join(DOWNLOADS_DIR, fname))
        stored += 1
    return stored


def _env() -> tuple[str, str, str, str]:
    url = os.environ["DOCFLOW_URL"]
    host = re.sub(r"^https?://", "", url).split("/")[0]
    return url, os.environ["DOCFLOW_USER"], os.environ["DOCFLOW_PASS"], host


async def run_sync_once() -> dict[str, Any]:
    """Periodic delta-aware sync of Approved documents."""
    url, user, password, host = _env()
    known = db.get_synced_docs(limit=200)
    skip_list = "\n".join(f"   - {d} (rev {r or '—'})" for d, r in sorted(known)) or "   (none yet — first run)"

    run_id = db.start_run()
    try:
        async with browser_lock:
            payload = await _agent_loop(SYNC_PROMPT.format(
                url=url, user=user, password=password, host=host,
                status=STATUS_FILTER, status_lower=STATUS_FILTER.lower(),
                skip_list=skip_list,
            ))
        stored = _store_documents(run_id, payload.get("documents", []), known=known)
        summary = {"documents_stored": stored,
                   "already_known": len(known),
                   "notes": payload.get("notes", "")}
        db.finish_run(run_id, "ok", summary)
        return summary
    except Exception as e:
        db.finish_run(run_id, "error", None, error=str(e))
        raise


async def run_doc_query(doc_id: str) -> dict[str, Any]:
    """On-demand pull of a single document for the chat interface."""
    url, user, password, host = _env()
    run_id = db.start_run()
    try:
        async with browser_lock:
            payload = await _agent_loop(QUERY_PROMPT.format(
                url=url, user=user, password=password, host=host, doc_id=doc_id,
            ))
        docs = payload.get("documents", [])
        _store_documents(run_id, docs)  # live pull always appends to the ledger
        db.finish_run(run_id, "ok", {"query": doc_id, "found": len(docs),
                                     "notes": payload.get("notes", "")})
        return payload
    except Exception as e:
        db.finish_run(run_id, "error", None, error=str(e))
        raise

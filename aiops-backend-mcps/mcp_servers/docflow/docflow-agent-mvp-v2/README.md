# DOCFlow AI Retrieval Agent — MVP

> **RC AIOps · OpsBrain Platform — Agent MVP**
> An AI agent that works with the **DOCFlow AI** document management portal purely
> through **browser automation** (no APIs), using a **Playwright MCP server**
> driven by an LLM agent loop (via OpenRouter). It periodically syncs Approved documents (delta-aware) and
> answers on-demand document lookups through a built-in chat interface.

---

## Table of Contents

1. [What This Does](#1-what-this-does)
2. [Architecture](#2-architecture)
3. [How the Two Flows Work](#3-how-the-two-flows-work)
4. [Prerequisites](#4-prerequisites)
5. [Quick Start](#5-quick-start)
6. [Using the Chat Interface](#6-using-the-chat-interface)
7. [Configuration Reference](#7-configuration-reference)
8. [Project Structure](#8-project-structure)
9. [Database Schema (Lifecycle Ledger)](#9-database-schema-lifecycle-ledger)
10. [API Reference](#10-api-reference)
11. [Operations & Useful Commands](#11-operations--useful-commands)
12. [Troubleshooting](#12-troubleshooting)
13. [Security Notes (Read Before Client Use)](#13-security-notes-read-before-client-use)
14. [Known MVP Boundaries & Roadmap](#14-known-mvp-boundaries--roadmap)

---

## 1. What This Does

Two capabilities in one small Docker stack:

| Capability | Trigger | What happens |
|---|---|---|
| **Scheduled delta sync** | Every `POLL_INTERVAL_MINUTES` (default 60) | Agent logs into DOCFlow with Document Controller credentials, opens the document register, finds documents with status **Approved** *only*, skips everything already pulled in previous runs (unless the revision changed), and for each new/changed document pulls **all comments** and **downloads every attachment**. |
| **On-demand chat lookup** | User asks in the chat UI (`http://localhost:8080`) | Doc ID is extracted from natural language. If the ledger has a fresh entry (≤ `CACHE_TTL_MINUTES`), the answer comes from memory instantly. Otherwise the agent runs a *targeted* browser session for **that one document only** and replies in the same chat session with status, comments, and attachment download links. |

**Key design property:** the agent does not rely on hardcoded CSS selectors. The LLM
reads accessibility snapshots of each page and decides the next browser action,
so minor DOCFlow UI changes don't break the flow. This is the same pattern the
production Aconex agent will use.

---

## 2. Architecture

```
                        http://localhost:8080
                                │  chat UI / REST
        ┌───────────────────────▼───────────────────────┐
        │              agent  (Python 3.12)             │
        │  ┌─────────────┐    ┌────────────────────┐    │
        │  │  FastAPI    │    │  APScheduler       │    │
        │  │  /api/chat  │    │  delta sync job    │    │
        │  └──────┬──────┘    └─────────┬──────────┘    │
        │         └────────┬────────────┘               │
        │            asyncio browser lock               │
        │                  │                            │
        │      LLM agent loop (OpenRouter, OpenAI-compat)│
        └──────────────────┬────────────────────────────┘
                           │ MCP (streamable HTTP)
                ┌──────────▼─────────┐        headless        ┌─────────────┐
                │   playwright-mcp   │ ─────────────────────► │  DOCFlow AI │
                │  (MS official img) │        Chromium        │   portal    │
                └──────────┬─────────┘                        └─────────────┘
                           │ saves downloads
        ┌──────────────────▼──────────┐
        │      downloads volume       │──►  served to users at /files/{name}
        └─────────────────────────────┘
        ┌─────────────────────────────┐
        │   postgres  (ledger)        │◄──  append-only doc_events,
        │                             │     attachments, runs
        └─────────────────────────────┘
```

**Three containers** (see `docker-compose.yml`):

| Service | Image | Role |
|---|---|---|
| `playwright-mcp` | `mcr.microsoft.com/playwright/mcp` | Exposes browser tools (`browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, …) over MCP streamable HTTP on port 8931. Runs headless Chromium. Downloads are written to the shared `/downloads` volume via `--output-dir`. |
| `agent` | built from `./agent` | FastAPI app (chat UI + REST) plus the background scheduler. Bridges the LLM's tool-use to the MCP server's browser tools. Port 8080. |
| `postgres` | `postgres:16-alpine` | The lifecycle ledger. Schema auto-created from `db/init.sql` on first start. Data persists in the `pgdata` volume. |

A single **asyncio lock** in the agent serialises all browser use, so a chat
lookup and the scheduled sync never run parallel sessions against DOCFlow —
one service account, one session at a time.

---

## 3. How the Two Flows Work

### 3.1 Scheduled delta sync

1. On startup (after ~5s, if `RUN_ON_STARTUP=true`) and then every
   `POLL_INTERVAL_MINUTES`, the sync job fires.
2. The agent queries the ledger for known `(doc_no, revision)` pairs (up to 200)
   and injects them into its instructions: **skip these unless the revision in
   the list differs**. The agent therefore doesn't even open already-synced
   documents — saving browser time and DOCFlow load.
3. The agent drives the browser: login → document register → apply the
   **Approved** status filter → open each remaining document (max 10 per run) →
   read all comments → click every attachment download → back to list.
4. The agent's final JSON report is validated and written to the ledger. A
   **second delta guard on the write path** skips any `(doc_no, revision)`
   already stored, even if the agent re-read one.
5. Run outcome (counts, notes, errors) is recorded in the `runs` table.

### 3.2 Chat lookup

1. `POST /api/chat` receives the user message. A scorer picks the most
   document-number-looking token (`DWG-STR-1043`, `PRJ_00214`, `DOC/2024/118`
   all work). No ID found → the bot asks for one.
2. **Cache-first:** latest ledger event for that doc, if newer than
   `CACHE_TTL_MINUTES`, is returned instantly — stamped *"From memory · as of
   HH:MM"* with a **Refresh live** button.
3. **Cache miss (or Refresh live):** the agent runs a targeted session —
   login → search *that one document* → pull details, comments, attachments —
   and the response streams back into the same chat session.
4. Live pulls also append to the ledger, so the next person asking about the
   same document gets an instant cache hit. This is the two-tier memory
   pattern from the OpsBrain architecture: hot cache + historical ledger.

---

## 4. Prerequisites

| Requirement | Notes |
|---|---|
| **Docker Desktop** | Windows/macOS, with WSL2 backend on Windows. `docker compose` v2 (bundled). |
| **OpenRouter API key** | From <https://openrouter.ai/keys>. The agent's reasoning runs on a free tool-calling model by default (`AGENT_MODEL`); swap in any OpenRouter model id once you're on a paid key. |
| **DOCFlow AI access** | The portal URL and a working **Document Controller** username/password. The machine running Docker must be able to reach the portal (VPN if required). |
| ~2 GB free disk | Playwright MCP image + Chromium + Postgres. |

No local Python or Node needed — everything runs in containers.

---

## 5. Quick Start

### Windows (PowerShell)

```powershell
# 1. Unzip and enter
Expand-Archive .\docflow-agent-mvp-v2.zip -DestinationPath .\docflow-agent-mvp
cd .\docflow-agent-mvp

# 2. Create your environment file
Copy-Item .env.example .env
notepad .env        # fill in the four values below, save, close

# 3. Build and run
docker compose up --build
```

### Linux / macOS

```bash
unzip docflow-agent-mvp-v2.zip -d docflow-agent-mvp && cd docflow-agent-mvp
cp .env.example .env && nano .env
docker compose up --build
```

### The four values you must fill in `.env`

```ini
DOCFLOW_URL=https://your-docflow-site.com
DOCFLOW_USER=doc.controller@yourcompany.com
DOCFLOW_PASS=the-real-password
OPENROUTER_API_KEY=sk-or-v1-...
```

Everything else has working defaults (see [Configuration](#7-configuration-reference)).

### You'll know it's up when

- Agent log shows: `Uvicorn running on http://0.0.0.0:8080`
- <http://localhost:8080> loads the chat UI
- ~5 seconds later the first sync starts: watch `docker compose logs -f agent`
  and you'll see each browser step the agent takes
  (`step 03 → browser_click({...})`).

---

## 6. Using the Chat Interface

Open **http://localhost:8080** and type naturally:

- `What's the status of DWG-STR-1043?`
- `PRJ_00214`
- `show me the latest comments on DOC/2024/118`

The reply card shows:

- **Document number + status badge** (green for Approved)
- Title and revision
- **Comments** pulled from the document
- **Attachments** as clickable download links (served from the shared volume)
- A source line: *"From memory · as of 10:42"* (cache) or
  *"Fetched live from DOCFlow"* — cached answers include a **Refresh live**
  button that forces a fresh browser pull.

A live pull typically takes 30–90 seconds depending on the portal's speed —
the UI shows a "fetching live…" indicator while the agent works.

---

## 7. Configuration Reference

All configuration is via `.env` (loaded into the `agent` container).

| Variable | Default | Description |
|---|---|---|
| `DOCFLOW_URL` | — **(required)** | Base URL of the DOCFlow AI portal. |
| `DOCFLOW_USER` | — **(required)** | Document Controller username. |
| `DOCFLOW_PASS` | — **(required)** | Document Controller password. |
| `OPENROUTER_API_KEY` | — **(required)** | Key for OpenRouter, driving the agent via its OpenAI-compatible API. |
| `AGENT_MODEL` | `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | OpenRouter model id used in the agent loop. Only a few free-tier models officially support tool calling — check `supported_parameters` at <https://openrouter.ai/models> before swapping. Set to any paid OpenRouter model once billing is set up. |
| `OPENROUTER_SITE_URL` | `http://localhost` | Sent as `HTTP-Referer` — optional, used by OpenRouter's leaderboards. |
| `OPENROUTER_APP_NAME` | `DOCFlow Agent` | Sent as `X-Title` — optional, cosmetic only. |
| `POLL_INTERVAL_MINUTES` | `60` | How often the delta sync runs. |
| `RUN_ON_STARTUP` | `true` | Run a sync ~5s after the container starts. |
| `STATUS_FILTER` | `Approved` | Only documents in this status are synced. Change to e.g. `Issued for Construction` if the client's workflow uses different terminology. |
| `CACHE_TTL_MINUTES` | `30` | Chat answers from the ledger within this window; older entries trigger a live pull. |
| `MAX_AGENT_STEPS` | `40` | Hard cap on browser actions per run — cost and safety guardrail. Raise for very large registers. |

Set by `docker-compose.yml` (usually leave alone): `MCP_URL`, `DATABASE_URL`,
`DOWNLOADS_DIR`.

---

## 8. Project Structure

```
docflow-agent-mvp/
├── docker-compose.yml        # the 3-service stack + volumes
├── .env.example              # copy to .env and fill in
├── README.md                 # this file
├── db/
│   └── init.sql              # ledger schema, auto-applied on first start
└── agent/
    ├── Dockerfile            # python:3.12-slim + deps, runs uvicorn
    ├── requirements.txt      # anthropic, mcp, psycopg, apscheduler, fastapi, uvicorn
    ├── app.py                # FastAPI: chat UI, /api/chat, /files, scheduler lifespan
    ├── agent_run.py          # the agent core: prompts, LLM↔MCP loop,
    │                         #   run_sync_once() and run_doc_query()
    └── db.py                 # ledger reads/writes incl. delta + cache queries
```

Where to look when you want to change behaviour:

- **Prompts / task logic** → `agent_run.py` (`SYNC_PROMPT`, `QUERY_PROMPT`)
- **Chat behaviour, cache TTL logic, doc-ID extraction** → `app.py`
- **What gets stored** → `db.py` + `db/init.sql`

---

## 9. Database Schema (Lifecycle Ledger)

Append-only by design — status changes over time accumulate as rows, giving
you full document history for free (the OpsBrain ledger pattern).

**`doc_events`** — one row per observation of a document

| Column | Meaning |
|---|---|
| `doc_no`, `title`, `revision`, `status` | What the agent saw on the page |
| `comment` | All comments concatenated with ` \| ` |
| `source` | `docflow-ui` (future: other systems) |
| `captured_at` | When it was observed |
| `run_id` | FK to the run that captured it |

**`attachments`** — filename + path per document per capture
**`runs`** — every sync/chat run with status (`ok`/`error`), JSON summary, and error text

Handy queries:

```sql
-- Latest state of every document
SELECT DISTINCT ON (doc_no) doc_no, revision, status, captured_at
FROM doc_events ORDER BY doc_no, captured_at DESC;

-- Full history of one document
SELECT status, revision, comment, captured_at
FROM doc_events WHERE doc_no = 'DWG-STR-1043' ORDER BY captured_at;

-- Run health
SELECT id, started_at, status, summary, error FROM runs ORDER BY id DESC LIMIT 10;
```

---

## 10. API Reference

The chat UI is just a client of these endpoints — the future **Teams bot**
calls the same contract and renders the JSON as an Adaptive Card.

### `POST /api/chat`

```json
// request
{ "message": "what's the status of DWG-STR-1043?", "force_refresh": false }

// response (found)
{
  "found": true,
  "source": "cache",              // "cache" | "live"
  "as_of": "2026-07-20T07:12:04Z",
  "doc_no": "DWG-STR-1043",
  "title": "Structural Drawing — Tower B Level 10",
  "revision": "C",
  "status": "Approved",
  "comments": ["Approved with minor comments", "Rebar spacing verified"],
  "attachments": [
    { "filename": "DWG-STR-1043_C.pdf", "url": "/files/DWG-STR-1043_C.pdf" }
  ]
}

// response (not found / no ID in message)
{ "found": false, "reply": "human-readable explanation" }
```

`force_refresh: true` bypasses the cache and forces a live pull.

### `GET /api/history/{doc_no}`

Returns the document's full lifecycle from the ledger (no browser trip):

```json
{ "doc_no": "DWG-STR-1043",
  "events": [ { "status": "Approved", "revision": "C",
                "comment": "...", "captured_at": "..." } ] }
```

### `GET /files/{filename}`

Serves a downloaded attachment from the shared volume. Path-traversal safe
(only bare filenames are resolved).

---

## 11. Operations & Useful Commands

```powershell
# Watch the agent think (every browser step is logged)
docker compose logs -f agent

# Playwright MCP server logs
docker compose logs -f playwright-mcp

# List downloaded attachments
docker compose exec agent ls -la /downloads

# Open a SQL prompt on the ledger
docker compose exec postgres psql -U docflow -d docflow

# Trigger a live pull from the command line (bypasses the UI)
curl -X POST http://localhost:8080/api/chat `
  -H "Content-Type: application/json" `
  -d '{"message": "DWG-STR-1043", "force_refresh": true}'

# Stop (data persists)             / restart later without rebuild
docker compose down                ;  docker compose up -d

# Rebuild after editing agent code
docker compose up --build agent

# Full reset — wipes ledger AND downloads
docker compose down -v
```

---

## 12. Troubleshooting

| Symptom | Likely cause → fix |
|---|---|
| Chat says *"couldn't reach DOCFlow right now"* | Portal unreachable from inside Docker. Check VPN; test with `docker compose exec agent python -c "import urllib.request;print(urllib.request.urlopen('https://your-docflow-site.com').status)"`. |
| Run summary says `LOGIN_FAILED` | Wrong credentials, or the portal added MFA/CAPTCHA. Verify by logging in manually with the same account. MFA needs a dedicated handling flow (see roadmap). |
| Sync finds 0 documents but the register has approved docs | `STATUS_FILTER` doesn't match the portal's exact status label (e.g. portal says `APPROVED` or `Approved for Construction`). Set the exact label in `.env`. |
| `NO_JSON_OUTPUT` in run notes | The agent hit `MAX_AGENT_STEPS` before finishing — raise it, or reduce docs per run. Check `docker compose logs agent` to see where it got stuck. |
| Attachment link 404s | The portal generated a different filename than the agent reported. Check actual files: `docker compose exec agent ls /downloads`. |
| `openai.AuthenticationError` | Bad/expired `OPENROUTER_API_KEY`. |
| `openai.RateLimitError` / `429` | OpenRouter's free-tier request cap (per-minute and per-day) was hit — the sync/query is skipped and logged, not a crash. Wait, or move to a paid key/model. Aggressive `POLL_INTERVAL_MINUTES` burns the free quota fast. |
| Agent never calls any tools, just replies with text | The chosen `AGENT_MODEL` doesn't actually support tool calling even though it's listed as free — verify via `supported_parameters` at <https://openrouter.ai/models> before using it. |
| Every `browser_navigate` returns `EACCES: permission denied, open '/downloads/…'` | The `downloads` volume is root-owned but the MCP server runs as uid 1000. The `downloads-init` service in compose fixes this on `up`; for an existing volume run `docker compose exec -u root playwright-mcp chown -R 1000:1000 /downloads`. Untreated, the agent sees an error on every navigation and loops/retries, burning steps and API quota. |
| MCP requests suddenly 404 mid-run (session lost) | The session was reaped while the event loop was blocked. The agent must use `AsyncOpenAI` (`await client.chat.completions.create`) — a sync call would block the loop for the whole API round-trip, starving the MCP GET/SSE keepalives. The container itself does not crash (`docker inspect --format '{{.RestartCount}}'` stays 0). |
| Agent container restarts on boot | Postgres wasn't healthy yet — compose handles this via healthcheck; if it persists, `docker compose logs postgres`. |
| Runs are slow / expensive | Each browser step is one model call. Lower `POLL_INTERVAL_MINUTES` frequency, keep `MAX_AGENT_STEPS` tight, and rely on delta sync — steady-state runs that find nothing new finish in a handful of steps. |

---

## 13. Security Notes (Read Before Client Use)

This is an MVP. Before pointing it at a client environment:

1. **Credentials** live in `.env` in plain text. Move to **Azure Key Vault**
   (matches your stack) or Docker secrets. Never commit `.env`.
2. **The chat UI has no authentication.** It's fine on localhost; anything
   else needs SSO / reverse proxy in front — or replace the UI with the Teams
   bot, which brings Entra ID identity for free.
3. **Session discipline:** one service account, serialized access, human-like
   pacing. Do not raise worker concurrency against a production portal without
   client sign-off.
4. **Contractual:** browser automation of a portal without API entitlement can
   be a licensing grey area. Get written approval from the client/system owner
   before running against a real DOCFlow/Aconex tenant.
5. **Data:** downloaded attachments and the ledger contain project documents —
   treat the Docker volumes with the same confidentiality as the source system.

---

## 14. Known MVP Boundaries & Roadmap

Deliberately out of scope for this MVP, in rough build order:

- [ ] **Mock DOCFlow site** as a 4th container — demo the full loop without the real portal
- [ ] **PDF text extraction** — PyMuPDF + Azure Document Intelligence OCR (Arabic/English) on downloaded attachments, comments summarised into the ledger
- [ ] **Teams bot front end** — Azure Bot Service calling `/api/chat`, Adaptive Cards with Refresh/History buttons
- [ ] **Key Vault credential integration** + session `storageState` reuse to skip repeated logins
- [ ] **MFA/session-expiry handling** with ops alerting
- [ ] **Pagination / "modified since" sync** for registers larger than ~200 documents
- [ ] **OpsBrain knowledge-layer sync** — ledger events into the wiki/vector index for cross-source contradiction detection

---

*RC AIOps · OpsBrain Platform — DOCFlow Retrieval Agent MVP · Rev 2*

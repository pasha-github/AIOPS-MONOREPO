# DOCFlow AI Retrieval Agent — MVP v2

An AI agent (OpsBrain pattern) that works with the **DOCFlow AI** web portal
through a **Playwright MCP server** (no APIs — pure browser automation), with:

1. **Periodic delta sync** — pulls comments + attachments for **Approved**
   documents only, skipping anything already pulled in previous runs
   (unless the revision changed).
2. **Chat interface** (`http://localhost:8080`) — anyone can ask for a
   specific document by ID; the agent answers from memory if fresh, or does a
   live targeted pull of *only that document* and replies in the same session.

```
             http://localhost:8080
                     │ chat
┌────────────────────▼───────────────┐   MCP (HTTP)    ┌──────────────────┐   headless    ┌────────────┐
│  agent  (FastAPI + scheduler)      │ ──────────────► │  playwright-mcp  │ ────────────► │ DOCFlow AI │
│  Claude drives the browser tools   │                 │  (MS official)   │   Chromium    │   portal   │
└──────┬─────────────────────────────┘                 └────────┬─────────┘               └────────────┘
       │ append-only events                                     │ saves downloads
       ▼                                                        ▼
 ┌──────────┐                                          ┌──────────────────┐
 │ postgres │◄──── cache-first chat lookups            │ downloads volume │──► served at /files/...
 │  ledger  │                                          │  (shared)        │
 └──────────┘                                          └──────────────────┘
```

## How the two flows work

**Scheduled delta sync** (`POLL_INTERVAL_MINUTES`, default 60)
- The ledger's known `(doc_no, revision)` pairs are injected into the agent's
  instructions: *skip these unless the revision differs*.
- A second guard on write skips any doc/revision already stored, even if the
  agent re-reads one.
- Only documents with `STATUS_FILTER` (default `Approved`) are pulled.

**Chat lookup** (`POST /api/chat`)
- The doc ID is extracted from the message ("what's the status of DWG-STR-1043?").
- **Cache-first:** if the ledger has an event newer than `CACHE_TTL_MINUTES`
  (default 30), it answers instantly, stamped "as of HH:MM", with a
  **Refresh live** button.
- Otherwise the agent runs a *targeted* browser session: login → search that
  one document → pull details, comments, attachments → reply in-session.
  Live pulls also append to the ledger, so the next person gets a cache hit.
- Attachments are served as download links from the shared volume.
- A single `asyncio` lock serialises the browser between scheduled syncs and
  chat pulls — one session at a time against DOCFlow.

## Run it

```bash
cp .env.example .env       # DOCFLOW_URL, credentials, ANTHROPIC_API_KEY
docker compose up --build
# chat UI:      http://localhost:8080
# agent logs:   docker compose logs -f agent
```

Inspect the ledger:

```bash
docker compose exec postgres psql -U docflow -d docflow \
  -c "SELECT doc_no, revision, status, left(comment,60), captured_at FROM doc_events ORDER BY id DESC LIMIT 20;"
```

Document history API: `GET /api/history/{doc_no}`

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `DOCFLOW_URL` / `DOCFLOW_USER` / `DOCFLOW_PASS` | — | Portal + Document Controller credentials |
| `ANTHROPIC_API_KEY` | — | Drives the agent's browser reasoning |
| `AGENT_MODEL` | `claude-sonnet-4-6` | Model for the agent loop |
| `POLL_INTERVAL_MINUTES` | `60` | Delta-sync frequency |
| `STATUS_FILTER` | `Approved` | Only this status is synced |
| `CACHE_TTL_MINUTES` | `30` | Chat answers from memory within this window |
| `MAX_AGENT_STEPS` | `40` | Hard cap on browser actions per run |

## MVP boundaries (deliberate)

- Credentials in `.env` — move to Key Vault / Docker secrets before client use.
- Chat is unauthenticated on localhost — put it behind your SSO / reverse
  proxy, or swap the UI for the Teams bot (the `/api/chat` contract stays).
- No PDF text extraction yet — attachments stored raw; the PyMuPDF/OCR
  pipeline is the next bolt-on.
- Delta list injected into the prompt is capped at 200 docs; for large
  registers, switch to a "modified since" filter in the portal UI if available.

# AlertTesting Teams Bot

This project is a Microsoft Teams bot with proactive alert delivery.

It does three main things:
- receives Teams user messages and forwards them to ADK chat APIs
- stores conversation subscriptions for proactive messaging
- exposes authenticated HTTP APIs to send alerts by `conversation_id` or mapped `email`

## Prerequisites

- Python `>=3.12,<3.14`
- Microsoft 365 account for Teams development/testing
- Microsoft 365 Agents Toolkit (VS Code extension or CLI)

## Environment Variables

`.env` values are loaded with `python-dotenv` in [`src/utils/config.py`](src/utils/config.py).

| Variable | Required | Purpose |
| - | - | - |
| `CLIENT_ID` | Yes | Bot app/client ID used by Teams runtime and proactive sends. |
| `CLIENT_SECRET` | Yes | Bot secret for Bot Framework authentication. |
| `TENANT_ID` | Usually | Tenant context for bot auth/runtime configuration. |
| `ALERT_API_KEY` | Yes | Shared key required by `/api/alerts` and `/api/alerts/by-email`. |
| `DATABASE_URL` | Yes | SQLAlchemy URL (for example `sqlite:///bot.db` or `mysql+pymysql://...`). |
| `AGENT_ADK_BASE_URL` | For chat replies | ADK API base URL (for example `http://host:port`). |
| `AGENT_APP_NAME` | For chat replies | ADK app name used in session and `run_sse` requests. |
| `AGENT_ADK_USER_ID` | Optional | ADK user ID (defaults to `user`). |
| `PORT` | Optional | Bot HTTP port (default `3978` when using toolkit flow). |

Startup validation:
- `DATABASE_URL` and `ALERT_API_KEY` are required at startup.
- `AGENT_ADK_BASE_URL` and `AGENT_APP_NAME` must both be set, or both empty.

## Run Locally

1. Create and activate a virtual environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

Optional (quality tooling):

```bash
pip install -r requirements-dev.txt
```

3. Configure `.env`.
4. Start the bot:

```bash
python src/app.py
```

You can also use toolkit debug (`F5`) with `Debug in Teams`.

## Runtime Flow

- [`src/app.py`](src/app.py) creates `App(skip_auth=False)`, initializes DB, then registers middleware, Teams handlers, and alert routes.
- [`src/routers/handlers.py`](src/routers/handlers.py) processes bot events and forwards message text to ADK session + SSE APIs.
- [`src/services/agent_client.py`](src/services/agent_client.py) encapsulates ADK HTTP retry/backoff behavior.
- [`src/services/subscriptions.py`](src/services/subscriptions.py) upserts/removes conversation subscriptions.
- [`src/services/email_mapping.py`](src/services/email_mapping.py) auto-captures email-to-conversation mappings from personal chat activity/profile data.
- [`src/routers/alerts.py`](src/routers/alerts.py) exposes proactive alert endpoints.

Agent chat calls use async `httpx` with retry/backoff for transient failures (timeout/network/5xx/429). Message flow is:
- `POST /apps/{app_name}/users/{user_id}/sessions/{session_id}` (session_id = Teams conversation ID)
- `POST /run_sse`

## Quality Commands

Run:

```bash
ruff check src migrations
python -m compileall src migrations
```

Checks include:
- `ruff check src migrations`
- `python -m compileall src migrations`

## Database Migrations

Schema management is handled by Alembic. App startup runs `upgrade head`.

Common commands:

```bash
alembic upgrade head
alembic revision --autogenerate -m "describe change"
```

## Alert APIs

Both endpoints require one of:
- `x-alert-key: <ALERT_API_KEY>`
- `Authorization: Bearer <ALERT_API_KEY>`

### `POST /api/alerts`

Send an alert to one target conversation.

Request body:

```json
{
  "conversation_id": "19:...@thread.tacv2",
  "message": "CPU is above 90% for 5 minutes."
}
```

`conversation_id` accepts:
- raw conversation ID
- URL-encoded conversation ID
- full Teams channel URL (`https://teams.microsoft.com/l/channel/...`)

Example:

```bash
curl -X POST http://localhost:3978/api/alerts \
  -H "Content-Type: application/json" \
  -H "x-alert-key: <your-alert-api-key>" \
  -d "{\"conversation_id\":\"<conversation-id>\",\"message\":\"CPU is above 90%.\"}"
```

### `POST /api/alerts/by-email`

Send personal proactive alerts using local email mapping.

Single email mode:

```json
{
  "email": "user@company.com",
  "message": "CPU is above 90%."
}
```

Batch mode:

```json
{
  "emails": ["user1@company.com", "user2@company.com"],
  "message": "CPU is above 90%."
}
```

Example:

```bash
curl -X POST http://localhost:3978/api/alerts/by-email \
  -H "Content-Type: application/json" \
  -H "x-alert-key: <your-alert-api-key>" \
  -d "{\"emails\":[\"user1@company.com\",\"user2@company.com\"],\"message\":\"CPU is above 90%.\"}"
```

## Personal Chat Onboarding

For email-based alerts to work:

1. User opens a personal chat with the bot and sends at least one message.
2. Bot saves subscription data.
3. Bot attempts to discover user email from activity/profile fields and stores mapping locally.

If your tenant blocks email exposure to bot APIs, provide a separate admin mapping process.

## Database Tables

`subscriptions`:
- `conversation_id` (PK)
- `service_url`
- `channel_id`
- `conversation_type`
- `tenant_id`

`email_subscriptions`:
- `email` (PK)
- `conversation_id`
- `updated_at_utc`

## Project Structure

| Folder | Purpose |
| - | - |
| `.vscode` | Debug/run settings |
| `appPackage` | Teams app manifest and assets |
| `env` | Toolkit environment files |
| `infra` | Provisioning templates |
| `src/routers` | Teams handlers, middleware, and alert routes |
| `src/database` | SQLAlchemy runtime (`database.py`) and models (`models.py`) |
| `src/services` | Subscription and email-mapping domain logic |
| `src/utils` | Config, contracts, and shared helpers |
| `.github/workflows` | CI quality pipeline (`ruff`, compile) |
| `src/app.py` | Single application entrypoint and composition |

## Notes

- Auth bypass is disabled in code (`skip_auth=False`).
- If `AGENT_ADK_BASE_URL` or `AGENT_APP_NAME` is missing, the bot replies with a configuration message instead of calling ADK.

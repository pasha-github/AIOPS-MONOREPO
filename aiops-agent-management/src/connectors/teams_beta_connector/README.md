# Teams Beta Connector

Async version of the Teams connector. Sends proactive alerts through the local Teams bot APIs using non-blocking HTTP (`httpx`) so the agent event loop is never stalled during I/O.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `TEAMS_BOT_BASE_URL` | Yes | Base URL for the Teams bot API (e.g. `http://localhost:3978`) |
| `ALERT_API_KEY` | Yes | Authentication key for the alert endpoints |
| `EMAILS` | No | Comma or newline separated email addresses for `send_alert_by_email` |
| `CONVERSATION_IDS` | No | Comma or newline separated Teams conversation IDs for `send_alert_by_conversation` |
| `prefix` | No | Optional tool name prefix |

## Tools

| Tool | Description | Exposed when |
|---|---|---|
| `send_alert_by_email` | Send a proactive Teams alert to preconfigured email target(s) | `EMAILS` is set |
| `send_alert_by_conversation` | Send a proactive Teams alert to preconfigured conversation target(s) | `CONVERSATION_IDS` is set |

## Notes

- Tools are conditionally exposed: `send_alert_by_email` only appears when `EMAILS` is configured; `send_alert_by_conversation` only appears when `CONVERSATION_IDS` is configured.
- Both `EMAILS` and `CONVERSATION_IDS` accept multiple values separated by commas or newlines.
- HTTP calls use `httpx.AsyncClient` — no threads are blocked while the request is in flight.

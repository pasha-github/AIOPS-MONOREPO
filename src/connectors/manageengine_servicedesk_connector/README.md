# ManageEngine ServiceDesk Plus Cloud Connector

Provides CRUD tools for API v3 Requests and Changes. Problems and attachment APIs are intentionally excluded.

## Configuration

- `CLIENT_ID`: Zoho Self Client client ID.
- `CLIENT_SECRET`: Zoho Self Client client secret.
- `API_DOMAIN`: Regional ServiceDesk API domain, such as `https://sdpondemand.manageengine.in`.
- `ACCOUNTS_SERVER_URL`: Regional Zoho Accounts URL, such as `https://accounts.zoho.in`.
- `PORTAL`: Optional ESM portal URL name, such as `itdesk`.

The connector uses Zoho Self Client client credentials flow. The backend requests short-lived access tokens with the configured client ID and secret, caches them, and requests a new token whenever needed. No browser authorization or refresh token is required.

ServiceDesk API calls always use the configured `API_DOMAIN`; a generic `api_domain` returned by Zoho Accounts is not used as the ServiceDesk endpoint.

The token needs `SDPOnDemand.requests.ALL` and `SDPOnDemand.changes.ALL`, or the least-privilege operation scopes used by the agent.

## Tools

- `create_request`, `update_request`, `get_request`, `list_requests`, `delete_request`
- `create_change`, `update_change`, `get_change`, `list_changes`, `delete_change`

Request create/get/list responses include `request_id_for_updates`, the internal ManageEngine ID that URL operations require, and `request_number`, the displayed ticket number users see. Request get/update/delete also accept a short displayed request number and resolve it to the internal ID before calling ManageEngine.

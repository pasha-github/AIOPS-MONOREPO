# Confluence Connector

Read pages and spaces from Confluence Cloud using Atlassian API token authentication.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `CF_DOMAIN` | Yes | Your Atlassian domain, e.g. `royalcyber.atlassian.net` |
| `CF_EMAIL` | Yes | Your Atlassian account email |
| `CF_API_TOKEN` | Yes | API token generated from `https://id.atlassian.com/manage-profile/security/api-tokens` |
| `CF_SPACE_KEY` | No | Space key to filter pages (e.g. `ENG`). If not set, lists all spaces. |
| `prefix` | No | Optional prefix for tool names |

## Tools

### `list_pages`
Lists pages in the configured Confluence space. If no space key is configured, lists all available spaces instead.

### `get_page_content`
Gets the plain text content of a Confluence page by its numeric page ID. Use `list_pages` first to find the page ID.

## Setup

1. Go to `https://id.atlassian.com/manage-profile/security/api-tokens`
2. Click **Create API token**, give it a name, and copy the token
3. Use your Atlassian email and the token as config values — no admin approval needed

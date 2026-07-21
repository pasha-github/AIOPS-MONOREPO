# Microsoft Entra Connector

Provision users, assign licenses, reset passwords, and enable or disable Microsoft Entra ID accounts through Microsoft Graph.

## Configuration

- `TENANT_ID`
- `CLIENT_ID`
- `CLIENT_SECRET`
- `prefix`

## Tools

- `create_user` — Create a new user in Microsoft Entra ID with a temporary or generated password. Sets `usageLocation` (defaults to `"US"`) so licenses can be assigned to the user immediately.
- `assign_license` — Assign a Microsoft 365 license (SKU) to a user to activate Outlook, SharePoint, and Teams.
- `list_licenses` — List all license SKUs available in the tenant with enabled, consumed, and available seat counts. Use this before `assign_license` to find the correct `sku_id`.
- `reset_user_password` — Reset a Microsoft Entra ID user's password through Microsoft Graph.
- `enable_user` — Enable a Microsoft Entra ID user account.
- `disable_user` — Disable a Microsoft Entra ID user account.

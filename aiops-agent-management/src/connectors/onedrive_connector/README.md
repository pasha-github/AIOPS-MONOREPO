# OneDrive Connector

Read documents from a user's OneDrive for Business via Microsoft Graph API.

## How It Works

OneDrive for Business is backed by a SharePoint personal site. The connector converts the user email into a personal site URL, resolves the site ID via Graph API, then accesses the drive through that site — all using the same credentials as the SharePoint connector.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `OD_ID_APP` | Yes | Azure AD App Client ID (same as SharePoint) |
| `OD_ID_APP_SECRET` | Yes | Azure AD App Client Secret (same as SharePoint) |
| `OD_TENANT_ID` | Yes | Microsoft Tenant ID (same as SharePoint) |
| `OD_TENANT` | Yes | Tenant name, e.g. `rcyber` from `rcyber-my.sharepoint.com` |
| `OD_USER_EMAIL` | Yes | Email of the user whose OneDrive to access |
| `OD_FOLDER` | No | Subfolder to scope listing, e.g. `Documents` |
| `prefix` | No | Optional tool name prefix |

## Required Azure AD Permissions

- `Sites.Read.All` (Application) — already granted for SharePoint connector

## Tools

### `list_documents`
Lists files in the user's OneDrive root or configured folder.

### `get_document_content`
Gets file content by name or item ID:
- `.docx` → extracted plain text
- `.pdf` → extracted plain text
- `.md` / text files → plain text
- Other files → Base64

# SharePoint Admin Connector

Manage SharePoint folder permissions via Microsoft Graph. List, grant, remove, and copy user access on any folder by email address.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `SHP_ID_APP` | Yes | Azure AD app client ID |
| `SHP_ID_APP_SECRET` | Yes | Azure AD app client secret |
| `SHP_TENANT_ID` | Yes | Microsoft tenant ID |
| `SHP_SITE_URL` | Yes | SharePoint site URL (e.g. `https://tenant.sharepoint.com/sites/mysite`) |
| `prefix` | No | Optional tool name prefix |

## Tools

| Tool | Description |
|---|---|
| `list_folder_permissions` | List all users and groups with their roles on a folder |
| `grant_folder_access` | Grant a user read or write access to a folder by email |
| `remove_folder_access` | Remove a user's access from a folder by email |
| `copy_folder_access` | Grant a user the same permissions another user already has on a folder |

## Notes

- `folder_path` is relative to the drive root (e.g. `Documents/Reports` or `Construction documents - Ingestion`).
- `role` accepts `read` or `write`. Defaults to `read`.
- `copy_folder_access` collects all roles across all permission entries for the source user (handles both direct permissions and sharing-link based permissions).
- Requires `Sites.FullControl.All` or `Files.ReadWrite.All` permission in Azure AD.

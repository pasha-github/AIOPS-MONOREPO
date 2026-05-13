# SharePoint Connector

Graph-only SharePoint connector scoped to a required folder in the document library.

## Configuration

- `SHP_ID_APP`
- `SHP_ID_APP_SECRET`
- `SHP_TENANT_ID`
- `SHP_SITE_URL`
- `SHP_DOC_LIBRARY` (required)
- `prefix`

## Tools

### `list_documents`

List documents in the configured SharePoint scope.

### `get_document_content`

Read document content. Text files return plain text; binary files return Base64.

### `create_document`

Create a new `.md` document only.

### `update_document`

Update an existing `.md` document only.

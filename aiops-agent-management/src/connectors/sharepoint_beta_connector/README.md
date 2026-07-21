# SharePoint Beta Connector

Extends the SharePoint connector with `.docx` support for content read/write and full comment management via Microsoft Graph.

## Configuration

| Variable | Required | Description |
|---|---|---|
| SHP_ID_APP | Yes | Azure AD app client ID |
| SHP_ID_APP_SECRET | Yes | Azure AD app client secret |
| SHP_TENANT_ID | Yes | Microsoft tenant ID |
| SHP_SITE_URL | Yes | SharePoint site URL (e.g. `https://tenant.sharepoint.com/sites/mysite`) |
| SHP_DOC_LIBRARY | Yes | Document library folder name (e.g. `Documents`) |
| prefix | No | Optional prefix for tool names |

## Tools

| Tool | Description | Supported Types |
|---|---|---|
| `list_documents` | List documents in a folder | All |
| `get_document_content` | Read document content | `.md` → plain text, `.docx` → extracted text, others → Base64 |
| `create_document` | Create a new document from markdown | `.md` and `.docx` |
| `update_document` | Update a document from markdown while preserving comments | `.md` and `.docx` |
| `get_document_comments` | Get all comments with ID, author, date, and text | `.docx` only |
| `update_document_comment` | Update a comment's text by ID | `.docx` only |
| `reply_to_comment` | Add a threaded reply to an existing comment by ID | `.docx` only |
| `add_comment` | Add a comment anchored to a specific line of text | `.docx` only |

## Notes

- All `.docx` operations are handled by `docx-mcp-server`, which performs OOXML-correct
  edits (registering `[Content_Types].xml` parts, relationships, and `paraId`s) so Word
  and SharePoint Online never report a corrupted document.
- `create_document` and `update_document` for `.docx`: `content` is treated as **markdown** and rendered into a formatted Word document — headings (`#`), bold (`**`), italic (`*`), bullet and numbered lists, tables, code blocks, and blockquotes are all supported, with smart typography. Plain text is valid markdown. **Separate paragraphs with a blank line** — a single newline is a soft break (joined into the same paragraph).
- Local image paths in markdown do not resolve server-side; remote image URLs are embedded as hyperlinks.
- `update_document` preserves all existing comments and their positions when updating content.
- `get_document_comments` → `update_document_comment` / `reply_to_comment`: always call `get_document_comments` first to retrieve the comment ID before updating or replying.
- `reply_to_comment` creates a properly threaded reply (stored in `word/commentsExtended.xml`) visible in Word and SharePoint Online. The `author` parameter defaults to `"AI Agent"`.
- `add_comment`: pass `anchor_text` matching any substring of the target paragraph (case-insensitive); the comment anchors to the first matching paragraph. The `author` parameter defaults to `"AI Agent"`.
- Requires `docx-mcp-server` installed in the environment (`pip install docx-mcp-server`).

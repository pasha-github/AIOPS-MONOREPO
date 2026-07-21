# Outlook Connector

Send and reply to Outlook emails through Microsoft Graph using a preconfigured mailbox.

## Configuration

| Variable | Label | Required | Secret | Description |
|---|---|---|---|---|
| `TENANT_ID` | Tenant ID | Yes | No | Microsoft Entra tenant ID |
| `CLIENT_ID` | Client ID | Yes | No | Application (client) ID from app registration |
| `CLIENT_SECRET` | Client Secret | Yes | Yes | Client secret from app registration |
| `MAILBOX_USER` | Mailbox User | Yes | No | Email or user principal name of the mailbox to send from |
| `prefix` | Prefix | No | No | Optional prefix for tool names to avoid conflicts (e.g. `Outlook`) |

## Tools

### `send_email`

Send a new email from the configured mailbox with support for to, cc, and bcc recipients.

| Argument | Type | Required | Description |
|---|---|---|---|
| `subject` | string | Yes | Email subject line |
| `body` | string | Yes | Email body (plain text, converted to HTML automatically) |
| `to` | string | Yes | Comma-separated recipient email addresses (at least one required) |
| `cc` | string | No | Comma-separated CC email addresses (optional) |
| `bcc` | string | No | Comma-separated BCC email addresses (optional) |

### `reply_to_email`

Reply to an existing Outlook email thread using a known Microsoft Graph message ID.

| Argument | Type | Required | Description |
|---|---|---|---|
| `message_id` | string | Yes | Microsoft Graph message ID to reply to |
| `comment` | string | Yes | Reply body text |

## Example Prompts

- *"Send an email to john.doe@example.com with subject 'Meeting Tomorrow' and body 'Hi John, reminder about our meeting at 10am.'"*
- *"Send an email to john@example.com, cc sarah@example.com, subject 'Project Update' and body 'The project is on track for Friday delivery.'"*
- *"Send an email to john@example.com and jane@example.com, bcc manager@example.com, subject 'Q3 Report' and body 'Revenue up 12%, costs down 8%.'"*
- *"Reply to message ID AAMk... with 'Thanks for your email, I will get back to you shortly.'"*

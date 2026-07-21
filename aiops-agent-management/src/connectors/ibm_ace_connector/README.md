# IBM ACE Connector

Manages IBM App Connect Enterprise (ACE) servers and applications via the ACE REST API.

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| IBM_ACE_BASE_URL | Yes | Base URL of your ACE REST API (e.g. `http://host:4414`) |

## Tools

| Tool | Description |
|------|-------------|
| `list_servers` | Lists all integration servers with their name and state |
| `start_server` | Starts a specific integration server |
| `list_applications` | Lists all applications on a server with their name and state |
| `start_application` | Starts a specific application on a server |

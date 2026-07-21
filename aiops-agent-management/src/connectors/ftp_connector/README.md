# FTP Connector

Connect to an FTP server to list directories and read text files.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `FTP_HOST` | Yes | FTP server hostname or IP (e.g. `127.0.0.1`) |
| `FTP_PORT` | No | FTP port (default: `21`) |
| `FTP_USERNAME` | Yes | FTP username |
| `FTP_PASSWORD` | Yes | FTP password |
| `FTP_DIRECTORY` | Yes | Directory to list and read files from (e.g. `/` for root, `/docs` for a subfolder) |
| `prefix` | No | Optional tool name prefix |

## Tools

### `list_files`
Lists files and directories on the FTP server from the configured directory.

### `read_file`
Reads the content of a text file from the FTP server by file name.

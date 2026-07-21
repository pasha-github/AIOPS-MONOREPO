# mainframe-mcp

A Go MCP server that automates two z/OSMF workflows for diagnosing and remediating
data set space (B37 abend) issues on a mainframe. It can run over **stdio** or
**HTTP** (both the modern Streamable HTTP transport and legacy SSE).

## Tools

### `get_dataset_info` (Workflow1)
Retrieve full data set information (space allocation, organization, record format,
extents, members, etc.) for a data set that hit a space issue. Runs the z/OSMF
`b37_info_retrieve` workflow (LISTDSI), waits for completion, and returns the
report written to the output data set.

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `datasetName` | yes | — | Fully-qualified DSN to inspect, e.g. `ADCDMST.JCL.DEMO` |
| `outputFile`  | no  | `ADCDMST.DSINFO.OUT` | Data set to write the report to |
| `notifyUser`  | no  | workflow owner | TSO user to notify |

### `reallocate_dataset` (Workflow2)
Reallocate/increase the space for a data set that failed with a B37 abend, using
the **new primary and secondary** values supplied by the caller (typically after
reviewing `get_dataset_info`). Runs the z/OSMF `b37_remed` workflow and returns
the job output (expect `IDCAMS ... CONDITION CODE WAS 0`).

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `datasetName`  | yes | — | Fully-qualified DSN to reallocate |
| `newPrimary`   | yes | — | New primary space (in `spaceUnit`), e.g. `100` |
| `newSecondary` | yes | — | New secondary space (in `spaceUnit`), e.g. `50` |
| `recfm`        | no  | `FB` | Record format |
| `lrecl`        | no  | `80` | Record length |
| `blksize`      | no  | `27920` | Block size |
| `dsorg`        | no  | `PO` | Data set organization |
| `spaceUnit`    | no  | `CYL` | `CYL` or `TRK` |
| `dsntype`      | no  | `LIBRARY` | e.g. `LIBRARY` (PDSE) or `PDS` |
| `outputFile`   | no  | `ADCDMST.B37.WFOUT` | Data set to write job output to |
| `notifyUser`   | no  | workflow owner | TSO user to notify |

Each workflow name is randomized with a UUID, so concurrent runs don't collide.

## Configuration (environment variables)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MAINFRAME_BASE_URL` | **yes** | — | z/OSMF base URL, e.g. `https://192.168.18.246:10443` |
| `MAINFRAME_USER` | no | `ADCDMST` | Mainframe user id |
| `MAINFRAME_PASSWORD` | no | `RC2026` | Mainframe password |
| `MAINFRAME_SYSTEM` | no | `S0W1` | z/OSMF system nickname |
| `MAINFRAME_OWNER` | no | `ADCDMST` | Workflow owner / default notify user |
| `MAINFRAME_INFO_DEF_FILE` | no | `/u/adcdmst/workflows/b37_info_retrieve.xml` | Workflow1 definition file |
| `MAINFRAME_REALLOC_DEF_FILE` | no | `/u/adcdmst/workflows/b37_remed` | Workflow2 definition file |
| `MAINFRAME_INFO_OUTPUT_DS` | no | `ADCDMST.DSINFO.OUT` | Workflow1 output DSN |
| `MAINFRAME_REALLOC_OUTPUT_DS` | no | `ADCDMST.B37.WFOUT` | Workflow2 output DSN |

### Transport

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_TRANSPORT` | `stdio` | `stdio`, or `http` to serve over HTTP |
| `PORT` | `8080` | HTTP port (used when `MCP_HTTP_ADDR` is unset) |
| `MCP_HTTP_ADDR` | `:8080` | Full listen address; overrides `PORT` |

In HTTP mode the server exposes:

| Path | Transport |
|------|-----------|
| `POST /mcp` | Streamable HTTP (recommended) |
| `GET /sse` + `POST /message` | Legacy SSE |
| `GET /health` | Liveness probe (returns `ok`) |

The Docker image defaults to `MCP_TRANSPORT=http`.

> TLS verification is disabled (equivalent to `curl -k`) to support LPARs with
> self-signed certificates.

## Run locally

Stdio:

```bash
export MAINFRAME_BASE_URL="https://192.168.18.246:10443"
export MAINFRAME_USER="ADCDMST"
export MAINFRAME_PASSWORD="RC2026"
go run .
```

HTTP (serves `/mcp` and `/sse`):

```bash
export MAINFRAME_BASE_URL="https://192.168.18.246:10443"
export MCP_TRANSPORT=http
export PORT=8080
go run .
# curl http://localhost:8080/health
```

## Docker

```bash
docker build -t mainframe-mcp .

# HTTP mode (image default) — serves /mcp and /sse on port 8080
docker run --rm -p 8080:8080 \
  -e MAINFRAME_BASE_URL="https://192.168.18.246:10443" \
  -e MAINFRAME_USER="ADCDMST" \
  -e MAINFRAME_PASSWORD="RC2026" \
  mainframe-mcp
```

To run over stdio instead, set `MCP_TRANSPORT=stdio` and use `-i`:

```bash
docker run --rm -i \
  -e MCP_TRANSPORT=stdio \
  -e MAINFRAME_BASE_URL="https://192.168.18.246:10443" \
  mainframe-mcp
```

## MCP client config examples

HTTP (Streamable) client:

```json
{
  "mcpServers": {
    "mainframe": {
      "type": "streamable-http",
      "url": "http://localhost:8080/mcp"
    }
  }
}
```

SSE client:

```json
{
  "mcpServers": {
    "mainframe": {
      "type": "sse",
      "url": "http://localhost:8080/sse"
    }
  }
}
```

Stdio client:

```json
{
  "mcpServers": {
    "mainframe": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "-e", "MCP_TRANSPORT=stdio",
        "-e", "MAINFRAME_BASE_URL=https://192.168.18.246:10443",
        "-e", "MAINFRAME_USER=ADCDMST",
        "-e", "MAINFRAME_PASSWORD=RC2026",
        "mainframe-mcp"
      ]
    }
  }
}
```

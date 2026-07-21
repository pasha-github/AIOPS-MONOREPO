# AIOps Listener Service

A small Go microservice that consumes messages from **Kafka** or **IBM MQ** and, per
message, calls back into the AIOps backend to run an agent.

> **Kafka** works in the default (pure-Go) build. **IBM MQ** requires cgo + the IBM MQ C
> client. The provided `Dockerfile` includes it; a local `go build` needs `-tags ibmmq`
> (see [Source types](#source-types) and [Builds](#builds)).

AIOps is the **source of truth** for listener config. This service keeps a local
**BoltDB** as (a) a cache so consumers resume on restart even if AIOps is down and
(b) a dead-letter + metrics store. It **reconciles** its running consumers against
AIOps on a periodic loop.

```
AIOps  ──POST /listeners───────────▶  this service ──consume──▶ Kafka / MQ
       ──DELETE /listeners/{id}────▶       │
       ◀─GET /agent/listeners/active─      │ (reconcile loop, every N s)
                                           │
   AIOps ◀─POST /agent/{id}/listener/invoke/{lid}── per message (at-least-once)
```

## Endpoints (control plane)

All except `/healthz` require the `X-Listener-Service-Secret` header.

| Method | Path | Purpose |
|---|---|---|
| GET  | `/healthz` | liveness (no auth) |
| POST | `/listeners` | start/restart a consumer; body `{listener_id, agent_id, source_type, config}` |
| DELETE | `/listeners/{id}` | stop a consumer |
| GET  | `/listeners` | list running consumer IDs |
| GET  | `/listeners/{id}/deadletter` | dead-lettered messages |
| GET  | `/listeners/{id}/metrics` | received / delivered / dead_lettered counters |

## Source types

A listener's `source_type` and `config` (decrypted by AIOps before it reaches this
service) select and configure the consumer.

**`kafka`** — `bootstrap_servers` (comma-separated), `topic`, `group_id` (default
`aiops-listener`), `security_protocol` (e.g. `SASL_SSL`), `sasl_mechanism`
(`PLAIN` | `SCRAM-SHA-256` | `SCRAM-SHA-512`), `sasl_username`, `sasl_password`.

**`ibmmq`** — `host`, `port` (default `1414`), `queue_manager`, `channel`, `queue_name`,
`username`, `password`. Optional TLS: `cipher_spec` (MQ CipherSpec) and `key_repository`
(key-DB stem, no `.kdb` suffix). `host` may instead be a full MQ conn-name list, e.g.
`host1(1414),host2(1414)`. Delivery uses MQGET under SYNCPOINT: the message is committed
(MQCMIT) only after AIOps returns 2xx — matching the Kafka at-least-once semantics.

> The `ibmmq` source only works in an `-tags ibmmq` build. A default (Kafka-only) binary
> starting an `ibmmq` listener fails fast with a clear "built without IBM MQ support" error.

## Configuration (env)

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | HTTP port |
| `AIOPS_BASE_URL` | — | AIOps base URL (callbacks + reconcile fetch) |
| `LISTENER_SERVICE_SECRET` | — | validates inbound control calls (must match AIOps) |
| `LISTENER_CALLBACK_SECRET` | — | sent on callbacks + active-listeners fetch (must match AIOps) |
| `BOLT_DB_PATH` | `/data/listener.db` | embedded DB file |
| `RECONCILE_INTERVAL_SECONDS` | `30` | reconcile cadence |

## Run locally

The service loads a `.env` file from the working directory if present (real
environment variables override it). Copy the sample and run:

```bash
cp .env.sample .env      # then edit values
go run ./cmd/server
```

Or set the vars directly (bash):

```bash
export AIOPS_BASE_URL=http://localhost:8000
export LISTENER_SERVICE_SECRET=dev-service-secret
export LISTENER_CALLBACK_SECRET=dev-callback-secret
export BOLT_DB_PATH=./listener.db
go run ./cmd/server
```

Windows cmd:

```cmd
copy .env.sample .env
go run ./cmd/server
```

Set the matching `LISTENER_SERVICE_BASE_URL`, `LISTENER_SERVICE_SECRET`, and
`LISTENER_CALLBACK_SECRET` on the AIOps side so the two can talk.

## Builds

The **`Dockerfile` image supports both Kafka and IBM MQ**. Because the IBM MQ consumer
needs cgo + the IBM MQ C client, the image builds with `CGO_ENABLED=1 -tags ibmmq` on a
glibc base and bakes in the IBM MQ **redistributable** client under `/opt/mqm` (override
the level with `--build-arg MQ_URL=...`):

```bash
docker build -t listener-service .
```

The IBM MQ consumer lives in `internal/consumer/ibmmq.go` behind the `ibmmq` build tag,
with a stub in `ibmmq_stub.go` for the untagged build. That lets you compile a
**Kafka-only** binary locally with no C toolchain or MQ libraries:

```bash
CGO_ENABLED=0 go build ./cmd/server          # Kafka only (ibmmq listeners error out)
CGO_ENABLED=1 go build -tags ibmmq ./cmd/server   # Kafka + IBM MQ (needs MQ C client)
```

> Do **not** run `go mod tidy` without `-tags ibmmq` — it would drop the `mq-golang`
> requirement (it is only imported behind the build tag).

## Message → agent

The service forwards the **raw** message bytes; AIOps applies the listener's
`prompt_template` (`{message}` → payload) and runs the agent. Delivery is
**at-least-once**: the offset is committed only after AIOps returns 2xx; after 3
failed attempts the message is dead-lettered and the stream continues.

## Deployment

Must run as a **single pinned instance** (`min=max=1`) — it holds long-lived
consumers and an embedded DB. See `.github/workflows/deploy.yml` (Cloud Run). For
durable dead-letter history, back `BOLT_DB_PATH` with a mounted volume, or run on
GKE/Compute Engine. The reconcile loop rebuilds live state from AIOps on boot, so
an ephemeral DB still functions (it only loses dead-letter/metric history).

## Extracting to its own repo

This directory is self-contained. To promote it:
1. Copy `listener-service/` to a new repo root.
2. Move `.github/workflows/deploy.yml` to the repo-root `.github/workflows/` (it is
   dormant inside the monorepo because GitHub only runs root workflows).
3. Optionally rename the Go module (`go.mod` `module listener-service`) to a URL
   path and update imports.

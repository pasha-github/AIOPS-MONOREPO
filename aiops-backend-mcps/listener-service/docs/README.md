# Listener Service — developer docs

Developer/architecture documentation for the AIOps **listener-service**. Where the
[root `README.md`](../README.md) is the operator quick-start (env vars, build commands,
deployment), these docs explain **how the code works**.

- **[consumers.md](consumers.md)** — the consumer layer in depth: the `Consumer`
  abstraction, the Kafka and IBM MQ implementations, the cgo/build-tag split, and the
  registry that owns lifecycle + per-message retry/dead-letter logic. Start here.
- **[persistence.md](persistence.md)** — the embedded BoltDB store: buckets, schema,
  the config cache, dead-letters, and metrics.

## What this service does

It runs one long-lived **consumer** per configured listener, pulling messages off a
source (**Kafka** or **IBM MQ**) and, for each message, calling back into the AIOps
backend to run an agent. AIOps is the source of truth for listener config; this
service reconciles its running consumers against AIOps on a periodic loop and keeps a
local BoltDB as a config cache + dead-letter/metrics store.

## Package map

| Package | File(s) | Owns |
|---|---|---|
| `cmd/server` | `main.go` | Startup: config load, store open, resume-from-cache, reconcile loop, HTTP server, graceful shutdown on SIGINT/SIGTERM. |
| `internal/config` | `config.go` | Env loading via `Load()` (optional `.env` through godotenv); defaults. |
| `internal/api` | `api.go` | Control-plane HTTP server (Go 1.22 method-pattern mux) + shared-secret auth middleware. |
| `internal/registry` | `registry.go` | Consumer lifecycle (one goroutine + cancel per listener), reconcile, and the per-message retry/dead-letter `MessageHandler`. |
| `internal/consumer` | `consumer.go`, `kafka.go`, `ibmmq.go`, `ibmmq_stub.go` | The `Consumer` abstraction + `New()` factory, and the Kafka / IBM MQ implementations. |
| `internal/aiops` | `client.go` | Outbound HTTP client to AIOps: `Invoke` (per-message callback) and `FetchActive` (reconcile fetch). |
| `internal/store` | `store.go` | Embedded BoltDB: config cache, dead-letters, metrics. |
| `internal/model` | `model.go` | Shared domain types: `ListenerSpec` (+ `Fingerprint`) and `DeadLetterRecord`. |

## Control plane & reconcile flow

The AIOps backend drives config; the service reconciles against it and also caches it
locally so it can resume without AIOps.

```
                 POST /listeners  (start/restart)
 AIOps  ───────  DELETE /listeners/{id}  (stop)  ─────────▶  api.Server ──▶ registry
   ▲                                                             │
   │  GET /agent/listeners/active                                │  one goroutine +
   └──────────── reconcileOnce (every RECONCILE_INTERVAL_SECONDS) │  cancel() per listener
                         │                                        ▼
                         └── registry.Reconcile(specs) ──▶ start new / stop removed / restart changed
                                    │                        (Fingerprint decides "changed")
                                    └── store.SaveSpecs(specs)  (last-known-good cache)

 On boot: store.LoadSpecs() ──▶ registry.Start(...)   ← resumes even if AIOps is down
```

## Per-message data flow

Each running consumer pulls one message and hands it to the registry's handler. The
handler — not the consumer — talks to AIOps, retries, and dead-letters.

```
 Kafka topic / MQ queue
          │  Consumer.Run  (kafka.go / ibmmq.go)
          ▼
   onMessage(msg, meta)  ── registry.makeHandler closure ──┐
          │                                                │  Incr("received")
          │                                                ▼
          │                         retry ×3 (backoff 1s/2s/4s, 30s timeout each)
          │                                    aiops.Invoke → POST /agent/{id}/listener/invoke/{lid}
          │                                                │
          │                       2xx? ──yes──▶ Incr("delivered"), return nil ──▶ COMMIT / ack
          │                          └──no (all 3 fail)──▶ store.DeadLetter + Incr("dead_lettered"),
          │                                                 return nil ──▶ COMMIT anyway (stream unblocked)
          ▼
   handler returns nil ⇒ commit the message (Kafka CommitMessages / MQ Cmit)
   handler returns err ⇒ do NOT commit ⇒ redeliver  (only happens on shutdown)
```

## Delivery guarantee

**At-least-once.** A message is committed/acked **only after** the handler returns
`nil`, and the handler returns `nil` only after AIOps answers `2xx` — or after the
message has been dead-lettered following **3** failed attempts. Because dead-lettering
still returns `nil`, a poison message never blocks the stream. A non-nil handler
return (→ no commit → redelivery) happens only during shutdown. See
[consumers.md](consumers.md) for the full walkthrough.

## Deployment constraint

Run as a **single pinned instance** (`min = max = 1`). The service holds long-lived
consumers and an embedded (single-writer) BoltDB, so it does not horizontally scale.
The reconcile loop rebuilds live state from AIOps on boot, so an ephemeral DB still
works — it only loses dead-letter/metric history. Back `BOLT_DB_PATH` with a mounted
volume for durable history. See the root README's *Deployment* section.

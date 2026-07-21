# Consumers

How the listener-service turns a message source (Kafka or IBM MQ) into agent
invocations. This is the heart of the service. See [README.md](README.md) for the
package map and high-level diagrams, and [persistence.md](persistence.md) for the
store.

## The abstraction

Everything is built on one small interface and one callback type
(`internal/consumer/consumer.go:15-20`):

```go
// MessageHandler processes one message. nil = "handled, safe to commit/ack";
// an error = "do not commit" (the message is redelivered).
type MessageHandler func(msg []byte, meta map[string]string) error

// Consumer runs until ctx is cancelled, calling onMessage per message.
type Consumer interface {
    Run(ctx context.Context, onMessage MessageHandler) error
}
```

The return-value contract of `MessageHandler` is the linchpin of the whole design:

- **return `nil`** → the message was handled → the consumer commits/acks it.
- **return an error** → the consumer must **not** commit → the source redelivers it.

A consumer knows *nothing* about AIOps, retries, or dead-lettering. It only knows
"call the handler, then commit iff it returned nil." All the per-message business
logic lives in the handler that the [registry](#the-registry-owns-the-handler)
supplies.

### The factory

`New` dispatches on the listener's `source_type` (`consumer.go:23-34`):

```go
func New(spec model.ListenerSpec) (Consumer, error) {
    switch spec.SourceType {
    case "kafka": return newKafkaConsumer(spec)
    case "ibmmq": return newIbmmqConsumer(spec)  // real impl or stub (see build tags)
    default:      return nil, fmt.Errorf("unknown source_type %q", spec.SourceType)
    }
}
```

`spec.Config` is a `map[string]string` already **decrypted by AIOps** before it
reaches this service (`model.go:13-18`).

## Kafka consumer (`kafka.go`) — pure Go

Uses `github.com/segmentio/kafka-go`. No cgo; works in the default build.

**Construction** (`newKafkaConsumer`, `kafka.go:24-56`) reads from `spec.Config`:

| Config key | Required | Notes |
|---|---|---|
| `bootstrap_servers` | yes | comma-separated, trimmed via `splitAndTrim` |
| `topic` | yes | |
| `group_id` | no | defaults to `aiops-listener` (`groupID`, `kafka.go:112`) |
| `security_protocol` | no | if it contains `SASL` → set a SASL mechanism; if it contains `SSL` → TLS 1.2+ |
| `sasl_mechanism` | no | `PLAIN` (default), `SCRAM-SHA-256`, `SCRAM-SHA-512` (`saslMechanism`, `kafka.go:97`) |
| `sasl_username` / `sasl_password` | no | credentials for the mechanism |

The reader is created with `MinBytes: 1`, `MaxBytes: 10e6`, and a 10s dial timeout.

**Run loop** (`kafka.go:58-95`):

1. `FetchMessage(ctx)` — note this **does not auto-commit**.
2. On fetch error: if `ctx` is cancelled, return it (clean shutdown); otherwise log,
   `sleep 1s`, and retry.
3. Build `meta` = `{topic, partition, offset, key}`.
4. Call `onMessage(m.Value, meta)`.
   - On handler **error**: if ctx cancelled return; else log "will redeliver" and
     `continue` **without committing**.
   - On **nil**: `CommitMessages(ctx, m)` (commit errors are logged, ctx-checked).

So the Kafka offset advances only after a successful handler return → at-least-once.

## IBM MQ consumer (`ibmmq.go`) — cgo, behind `-tags ibmmq`

Uses `github.com/ibm-messaging/mq-golang/v5/ibmmq`, a **cgo** binding over the IBM MQ
C client. Same `Consumer` contract, but MQ-native and transactional.

**Construction** (`newIbmmqConsumer`, `ibmmq.go:44-74`) requires `queue_manager`,
`channel`, `queue_name`; optional `host`/`port` (→ conn-name, port default `1414` via
`buildConnName`, `ibmmq.go:79`), `username`/`password`, and TLS `cipher_spec` /
`key_repository`. `host` may already be an MQ conn-name list like
`host1(1414),host2(1414)`.

**Connect** (`connect`, `ibmmq.go:94-138`): builds an MQCD (channel, conn name,
optional `SSLCipherSpec`), an MQCNO with `MQCNO_CLIENT_BINDING`, optional MQCSP
(user/password auth) and MQSCO (key repository), then `Connx` and `Open` the queue for
input (`MQOO_INPUT_AS_Q_DEF | MQOO_FAIL_IF_QUIESCING`).

**Run loop** (`ibmmq.go:140-211`):

1. Check `ctx.Err()` at the top of each iteration for responsive shutdown.
2. `MQGET` with `MQGMO_SYNCPOINT | MQGMO_WAIT | MQGMO_FAIL_IF_QUIESCING` and a 2s wait
   interval. **SYNCPOINT** makes the get transactional — the message stays on the
   queue until committed.
3. Get-error handling:
   - `MQRC_NO_MSG_AVAILABLE` → the wait elapsed with no message → `continue`.
   - `MQRC_TRUNCATED_MSG_FAILED` → message bigger than the buffer → grow the buffer to
     the reported size and retry (still on the queue under syncpoint).
   - ctx cancelled → return.
   - anything else → log, `sleep 1s`, `continue`.
4. Build `meta` = `{queue_manager, queue, msg_id, correl_id, format}` (IDs hex-encoded).
5. Call `onMessage`.
   - On handler **error**: `qMgr.Back()` (backout → the message is redelivered), then
     ctx-check / log / continue.
   - On **nil**: `qMgr.Cmit()` (commit → the message is removed).

Same at-least-once guarantee as Kafka, expressed through MQ syncpoint commit/backout.

## The cgo / build-tag split

The IBM MQ binding needs a C toolchain + the IBM MQ client libraries. To keep the
common Kafka-only path buildable anywhere, the MQ code is quarantined behind a build
tag using two files:

| File | Build constraint | Role |
|---|---|---|
| `ibmmq.go` | `//go:build ibmmq` | Real implementation (imports the cgo package). |
| `ibmmq_stub.go` | `//go:build !ibmmq` | Fail-fast placeholder (`ibmmq_stub.go:16-18`): `newIbmmqConsumer` returns *"ibmmq source not supported: this binary was built without IBM MQ support (rebuild with `-tags ibmmq`)"*. |

Exactly one compiles into any binary, and both expose `newIbmmqConsumer`, so the
factory in `consumer.go` is agnostic.

```bash
CGO_ENABLED=0 go build ./cmd/server              # Kafka only — no C toolchain; ibmmq listeners fail fast
CGO_ENABLED=1 go build -tags ibmmq ./cmd/server  # Kafka + IBM MQ — needs the MQ C client
```

The production `Dockerfile` builds the second form. **Caveat:** don't run `go mod
tidy` without `-tags ibmmq` — `mq-golang` is only imported behind the tag, so an
untagged tidy would prune it. See the root README's *Builds* section for the Docker
details.

## The registry owns the handler

`internal/registry/registry.go` is where per-message logic actually lives. When it
starts a consumer it passes in a handler built by `makeHandler(spec)`
(`registry.go:118-144`):

```go
func (r *Registry) makeHandler(spec model.ListenerSpec) consumer.MessageHandler {
    return func(msg []byte, meta map[string]string) error {
        _ = r.store.Incr(spec.ListenerID, "received")

        var lastErr error
        for attempt := 0; attempt < maxAttempts; attempt++ {          // maxAttempts = 3
            ctx, cancel := context.WithTimeout(context.Background(), invokeTimeout)  // 30s
            err := r.aiops.Invoke(ctx, spec.AgentID, spec.ListenerID, msg, meta)
            cancel()
            if err == nil {
                _ = r.store.Incr(spec.ListenerID, "delivered")
                return nil                                            // success → commit
            }
            lastErr = err
            time.Sleep(backoff(attempt))                              // 1s, 2s, 4s
        }

        // all attempts failed → dead-letter, but still commit so the stream is not blocked
        _ = r.store.DeadLetter(spec.ListenerID, string(msg), meta, lastErr.Error())
        _ = r.store.Incr(spec.ListenerID, "dead_lettered")
        return nil
    }
}
```

Key points:

- **Retry**: up to 3 attempts, each with its own 30s timeout; `backoff(attempt)` =
  `1 << attempt` seconds → **1s, 2s, 4s** (`registry.go:146-148`).
- **Dead-letter, then continue**: after exhausting retries the message is persisted to
  the dead-letter store and the handler **returns `nil` anyway** — so the source
  commits it and the stream keeps flowing. A poison message can't wedge the pipeline.
- **Consumers stay dumb**: all AIOps/retry/DLQ knowledge is here, not in the consumers.
  Consequently a **non-nil handler return only happens on shutdown** (via ctx-cancel
  inside the consumer loops, not from this handler), which is exactly when you *want*
  the uncommitted message left for redelivery.

The outbound call itself is a single HTTP `POST` — `aiops.Invoke`
(`internal/aiops/client.go:41-67`) posts `{message, metadata}` to
`{AIOPS_BASE_URL}/agent/{agentID}/listener/invoke/{listenerID}` with the
`X-Listener-Callback-Secret` header; success is any `2xx`.

## Lifecycle & reconcile

The registry runs **one goroutine and one `context.CancelFunc` per listener**, guarded
by a single mutex (`Registry` struct, `registry.go:30-35`).

- **`Start` / `startLocked`** (`registry.go:42-73`): if a listener with the same ID is
  already running with the same `Fingerprint()`, it's a no-op; if the fingerprint
  differs, the old consumer is cancelled and a fresh one started (restart-on-change).
  Otherwise it builds the consumer via `consumer.New`, creates a cancellable context,
  and launches the `Run` goroutine.
- **`Stop`** (`registry.go:76-83`): cancels the context and drops the entry.
- **`Reconcile(specs)`** (`registry.go:98-116`): converges the running set to the
  desired set — cancel + drop consumers not in `specs`, then `startLocked` each spec
  (new ones start, changed ones restart, unchanged ones are no-ops).

`Fingerprint()` (`model.go:23-39`) is a stable string of `source_type` + config keys
sorted alphabetically (`|key=value` per entry). It's what lets reconcile tell "config
changed, restart" from "same config, leave it alone" cheaply.

**What drives reconcile** — `cmd/server/main.go`:

1. On boot, `store.LoadSpecs()` → `reg.Start(...)` for each cached spec
   (`main.go:37-46`). This runs *before* contacting AIOps, so consumers resume even if
   AIOps is down.
2. `reconcileLoop` (`main.go:66-84`) calls `reconcileOnce` immediately, then every
   `RECONCILE_INTERVAL_SECONDS` (default 30s).
3. `reconcileOnce` (`main.go:86-100`) does `aiops.FetchActive` (30s timeout). On
   **fetch failure it logs and keeps the current consumers** — it does not tear
   anything down. On success it calls `reg.Reconcile(specs)` and refreshes the cache
   with `store.SaveSpecs(specs)`.

## Life of a message (end to end)

1. AIOps enables a listener → either pushes it via `POST /listeners` or the next
   `reconcileOnce` picks it up from `/agent/listeners/active`.
2. `registry.Start`/`Reconcile` launches a goroutine running `Consumer.Run` with a
   handler from `makeHandler`.
3. The consumer receives a message (Kafka `FetchMessage` / MQ `MQGET` under syncpoint)
   and calls the handler with the raw bytes + a `meta` map.
4. The handler `Incr("received")`, then tries `aiops.Invoke` up to 3× with 1s/2s/4s
   backoff.
5. **Success (2xx)** → `Incr("delivered")`, return nil → consumer commits (Kafka
   `CommitMessages` / MQ `Cmit`).
6. **All retries fail** → `store.DeadLetter(...)`, `Incr("dead_lettered")`, return nil
   → consumer commits anyway (stream unblocked). Inspect later via
   `GET /listeners/{id}/deadletter`.
7. **Shutdown** (SIGINT/SIGTERM) cancels every listener context; in-flight messages
   that haven't been committed are left for redelivery on next start.

## Adding a new source type

1. Implement the `Consumer` interface for the new source in a new file under
   `internal/consumer/` (mirror `kafka.go`: parse `spec.Config`, loop, call
   `onMessage`, commit only on nil, exit cleanly on `ctx` cancel).
2. Add a `case "<name>":` to `New` in `consumer.go` that returns your constructor.
3. Document the `config` keys the source expects (and add them to the root README's
   *Source types* section).
4. If the source needs cgo or heavy native deps, isolate it behind a build tag with a
   fail-fast stub, exactly as `ibmmq.go` / `ibmmq_stub.go` do.

You do **not** touch the registry, retry, dead-letter, metrics, or API code — the
handler and lifecycle are source-agnostic by design.

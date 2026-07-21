# Persistence (BoltDB)

The service keeps a single embedded **BoltDB** file (`go.etcd.io/bbolt`) at
`BOLT_DB_PATH` (default `/data/listener.db`). It serves three purposes: a
last-known-good **config cache**, a **dead-letter** store, and per-listener
**metrics**. All of it lives in `internal/store/store.go`. See
[consumers.md](consumers.md) for how these are written during message handling.

BoltDB is a single-file, single-writer key/value store — one more reason the service
runs as a [single pinned instance](README.md#deployment-constraint).

## Open

`Open(path)` (`store.go:35-58`) creates the parent dir if needed (`0755`), opens the
file (`0600`, 5s lock timeout), and creates the three top-level buckets if missing.
`Close()` closes the DB (deferred in `main.go`).

## Buckets

Three top-level buckets (`store.go:24-28`):

| Bucket | Key | Value | Written by | Read by |
|---|---|---|---|---|
| `config` | `listener_id` | `ListenerSpec` JSON | `SaveSpecs` (reconcile) | `LoadSpecs` (boot resume) |
| `deadletter` | *(sub-bucket per listener)* → `seq` (8-byte BE uint64) | `DeadLetterRecord` JSON | `DeadLetter` (handler) | `ListDeadLetter` (API) |
| `metrics` | `listener_id:counter` | 8-byte BE uint64 | `Incr` (handler) | `Metrics` (API) |

### `config` — last-known-good cache

- **`SaveSpecs(specs)`** (`store.go:63-83`): drops and recreates the `config` bucket,
  then stores each spec as JSON keyed by `ListenerID`. Called by `reconcileOnce` after
  a successful fetch from AIOps, so the cache always reflects the latest desired state.
- **`LoadSpecs()`** (`store.go:86-103`): reads all specs back. `main.go` calls this on
  boot to start consumers **before** contacting AIOps — so the service resumes even
  when AIOps is down or slow.

### `deadletter` — undeliverable messages

- **`DeadLetter(listenerID, message, meta, errStr)`** (`store.go:106-124`): opens (or
  creates) a **sub-bucket named after the listener**, takes the next `NextSequence()`
  value as the key, and stores a `DeadLetterRecord` (`model.go:43-48`):
  `{Seq, Message, Metadata, Error}` as JSON. Written by the registry handler after 3
  failed AIOps attempts.
- **`ListDeadLetter(listenerID)`** (`store.go:127-148`): returns all records for a
  listener (empty slice if none). Surfaced at `GET /listeners/{id}/deadletter`.

Sequence keys are monotonic per listener, so records come back in insertion order.

### `metrics` — delivery counters

- **`Incr(listenerID, counter)`** (`store.go:151-158`): key is `listenerID + ":" +
  counter`; value is a big-endian `uint64` incremented in place. The three counters
  used by the handler are `received`, `delivered`, and `dead_lettered`.
- **`Metrics(listenerID)`** (`store.go:161-178`): scans the `metrics` bucket for keys
  with the `listenerID:` prefix and returns `map[counter]uint64`. Surfaced at
  `GET /listeners/{id}/metrics`.

`itob`/`btoi` (`store.go:180-191`) do the 8-byte big-endian uint64 encoding; `btoi`
returns 0 for a missing/short value, so a first `Incr` starts from 0 → 1.

## Durability tradeoff

The DB is **not** the source of truth — AIOps is. On boot the reconcile loop rebuilds
the live consumer set from AIOps, so an ephemeral DB (e.g. a fresh container
filesystem) still works correctly; you only lose **dead-letter and metric history**.

For durable history, back `BOLT_DB_PATH` with a mounted/persistent volume (or run
somewhere with persistent local disk). See the root README's *Deployment* section.

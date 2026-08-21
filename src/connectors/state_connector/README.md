# State Connector

Generic persistent **key-value state** for agents. Use-case-agnostic: it exposes
only primitive KV operations. Any higher-level behaviour (deduplication,
counters, progress, caching) is composed by the **agent** from these primitives —
the connector never encodes a use case.

Backed by ADK session state, so it reuses the persistent `SessionService` this
project already configures (`AGENT_SERVER_DATABASE_URL`). No extra infrastructure.

## Configuration

- `NAMESPACE` (optional, default: `default`) — a bucket that isolates this
  connector config's keys. Give each use case its own namespace so agents can
  never read or overwrite each other's state. Fixed per config; the agent does
  not pass it per call.

## Scope (lifetime of a value)

Passed as the `scope` argument on every tool. Maps to ADK state prefixes:

| scope       | shared by                     | survives future runs?              |
|-------------|-------------------------------|------------------------------------|
| `session`   | this one conversation         | no                                 |
| `user`      | one user, all their sessions  | yes (with a persistent DB backend) |
| `app`       | everyone, all sessions        | yes (with a persistent DB backend) |

> `user`/`app` values persist only when ADK runs on a persistent session
> service (this project does, in prod). On an in-memory service they are stored
> but lost on restart. On SQLite (dev) there is no row-level locking, so two
> concurrent runs writing the same key can overwrite each other — use Postgres
> in production if runs overlap.

## Tools

- `state_get(scope, key)` → `{ found, value }` — `key` may be a single key or a list of keys; a list returns `{ results: [{key, found, value}, ...] }`
- `state_set(scope, key, value)` — **replaces** the value outright; `key`/`value` may each be single or matching lists to batch several writes in one call
- `state_append(scope, key, value)` → `{ value }` — **adds** to a list at that key without discarding what's there, creating it if unset; wraps a non-list existing value instead of overwriting it; `value` may be a single item or a list of items to append all at once
- `state_update(scope, key, old_value, new_value)` → `{ updated, value }` — **replaces** one item within a list in place (same position, rest untouched); no-op (not an error) if `old_value` isn't found
- `state_remove(scope, key, value)` → `{ value }` — **removes** specific matching value(s) from the list at that key, keeping the rest; `value` may be a single item or a list of items to remove all at once; no-op (not an error) if the key or value isn't present
- `state_delete(scope, key)` → `{ existed }` — erases the **entire** key/list; `key` may be a single key or a list of keys; a list returns `{ results: [{key, existed}, ...] }`
- `state_keys(scope)` → `{ keys }`

All batching is single-key-per-call semantics repeated in a loop server-side —
it saves round trips, not different behavior. `state_set` with list `key` and
list `value` must be the same length or it returns an error.

The replace-vs-add distinction is enforced in each tool's own docstring (what
the LLM actually reads when deciding which tool to call), not left to the
calling agent's prompt. state_set's docstring warns it destroys prior values
and says use state_append instead when the request is "add"/"also
remember"/"append". state_append's docstring says the reverse. This means a
model that never gets extra agent-level instructions on this will typically
still pick correctly — agent prompts can reinforce it (e.g. for
domain-specific phrasing this connector's docstrings won't recognize) but
shouldn't need to carry the whole burden.

## Example: building deduplication on top

The connector has no notion of "seen documents". The agent composes it:

1. `state_get(scope="app", key="seen_ids")` — read the stored list
2. Agent compares its candidates against that list and acts on the new ones
3. `state_set(scope="app", key="seen_ids", value=<merged list>)` — save

A different agent reuses the identical tools with a different `NAMESPACE`
(e.g. `invoices`) and composes its own logic. The connector is never modified.

> Note: the read-modify-write in steps 1–3 is done by the agent. For lists that
> must not be corrupted by a sloppy model, or where concurrent runs race, do the
> merge inside the agent's own use-case tool (which can call this connector),
> not in the LLM's free-form reasoning.

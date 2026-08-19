"""
State Connector v1.0.0
----------------------
Generic persistent key-value state for any agent, backed by ADK session state.

This connector is deliberately use-case-agnostic. It exposes only primitive
key-value operations (get / set / append / update / remove / delete / keys).
state_set REPLACES a value outright; state_append ADDS to a list; state_update
REPLACES one item within a list in place; state_remove takes specific
value(s) OUT of a list while leaving the rest; state_delete erases an entire
key. The docstring on each tool spells out which to pick so a model reading
only the tool descriptions (no extra agent-level prompting) still chooses
correctly. Any higher-level behaviour — deduplication, counters, progress
tracking, caching — is composed by the agent from these primitives; the
connector itself knows nothing about the use case.

state_get, state_set, and state_delete each accept either a single key (and,
for state_set, a single value) or a list of them, so a model can batch many
keys into one call instead of round-tripping the tool repeatedly. state_append
and state_remove each accept a single value or a list of values to add to or
take out of one key's list in one call.

Scope maps directly to ADK state prefixes and decides lifetime:
    "session" — this conversation only (no prefix)
    "user"    — all sessions for one user      (user:)
    "app"     — all users, all sessions         (app:)

Persistence of "user"/"app" scope requires a persistent ADK SessionService
(this project already configures one via AGENT_SERVER_DATABASE_URL). With an
in-memory session service these scopes are stored but lost on restart.

All writes go through ToolContext.state, which the ADK captures into the event's
state_delta and persists. Direct mutation of a fetched session's .state is never
used here — the ADK docs warn it bypasses event history and breaks persistence.
"""

from typing import Any

from base_connector import BaseConnector, connector_tool
from google.adk.tools.tool_context import ToolContext

_PREFIXES = {"session": "", "user": "user:", "app": "app:"}


class StateConnector(BaseConnector):
    """Generic persistent KV state for agents, namespaced to avoid collisions.

    A single ``namespace`` is fixed per connector configuration, so two agents
    (or two use cases) configured separately can never read or overwrite each
    other's keys. The agent only ever supplies ``scope`` / ``key`` / ``value``.

    Example:
        connector = StateConnector(NAMESPACE="spcl-docs")
        agent = LlmAgent(..., tools=[*connector.get_tools()])
    """

    def __init__(self, NAMESPACE: str = "default"):
        super().__init__()
        self.namespace = (NAMESPACE or "default").strip() or "default"

    # ------------------------------------------------------------------ #
    #  Internal                                                            #
    # ------------------------------------------------------------------ #

    def _resolve_scope(self, scope: str) -> str | None:
        return _PREFIXES.get((scope or "").strip().lower())

    def _key(self, prefix: str, key: str) -> str:
        # Prefix must lead the full key so the ADK routes it to the right scope.
        return f"{prefix}{self.namespace}::{key}"

    @staticmethod
    def _as_list(value: Any) -> list[Any]:
        return value if isinstance(value, list) else [value]

    # ------------------------------------------------------------------ #
    #  Tools                                                               #
    # ------------------------------------------------------------------ #

    @connector_tool
    async def state_get(
        self, scope: str, key: str | list[str], tool_context: ToolContext
    ) -> dict[str, Any]:
        """Reads one or more stored values. Call this BEFORE state_set or
        state_append whenever you are unsure if a value already exists —
        never guess or assume based on conversation history alone, since
        stored state can outlive and differ from what was said in this chat.

        Args:
            scope: One of 'session', 'user', or 'app'.
            key:   A single key, or a list of keys, to read within this
                   connector's namespace. Pass a list to read many keys in
                   one call instead of calling this tool repeatedly.

        Returns:
            If key is a single string: a dict with 'found' (bool) and
            'value' (the stored value, or null).
            If key is a list: a dict with 'results', a list of
            {'key', 'found', 'value'} in the same order as the input keys.
        """
        prefix = self._resolve_scope(scope)
        if prefix is None:
            return {"status": "error", "message": f"Invalid scope '{scope}'."}

        if isinstance(key, list):
            results = []
            for k in key:
                full_key = self._key(prefix, k)
                results.append(
                    {
                        "key": k,
                        "found": full_key in tool_context.state,
                        "value": tool_context.state.get(full_key),
                    }
                )
            return {"status": "success", "results": results}

        full_key = self._key(prefix, key)
        return {
            "status": "success",
            "found": full_key in tool_context.state,
            "value": tool_context.state.get(full_key),
        }

    @connector_tool
    async def state_set(
        self,
        scope: str,
        key: str | list[str],
        value: Any | list[Any],
        tool_context: ToolContext,
    ) -> dict[str, Any]:
        """REPLACES one or more values outright, discarding whatever was
        there before at each key.

        Use this only when the intent is to replace the ENTIRE value at a
        key (e.g. "set X to Y", "the value of X is now Y"). If the intent is
        to add/keep an existing value alongside a new one (e.g. "add", "also
        remember", "append"), use state_append instead. If the intent is to
        change/correct just ONE item within a list while leaving the rest
        untouched (e.g. "update test2 to test2-revised in the list"), use
        state_update instead — state_set would discard every other item.
        When in doubt, call state_get first to see what is already stored
        before deciding.

        Args:
            scope: One of 'session', 'user', or 'app'. Use 'user' or 'app' to
                   persist across future runs.
            key:   A single key, or a list of keys, to write within this
                   connector's namespace.
            value: A single JSON-serializable value (string, number, bool,
                   list, dict) if key is a single key; or a list of values,
                   matching key by position, if key is a list of keys.

        Returns:
            A dict confirming the write(s).
        """
        prefix = self._resolve_scope(scope)
        if prefix is None:
            return {"status": "error", "message": f"Invalid scope '{scope}'."}

        if isinstance(key, list):
            values = value if isinstance(value, list) else [value] * len(key)
            if len(values) != len(key):
                return {
                    "status": "error",
                    "message": "key and value lists must be the same length.",
                }
            for k, v in zip(key, values, strict=True):
                tool_context.state[self._key(prefix, k)] = v
            return {"status": "success"}

        tool_context.state[self._key(prefix, key)] = value
        return {"status": "success"}

    @connector_tool
    async def state_append(
        self,
        scope: str,
        key: str,
        value: Any | list[Any],
        tool_context: ToolContext,
    ) -> dict[str, Any]:
        """ADDS one or more values to a list WITHOUT deleting what's already
        stored; creates the list if the key was unset. If the existing value
        is not a list, it is wrapped into one before appending
        (e.g. "a" + append "b" -> ["a", "b"]).

        Use this whenever the request is to add/keep/also-remember something
        (e.g. "add X", "also remember Y", "append Z") rather than to replace
        the current value. Prefer this over state_set whenever there is any
        chance a prior value should be preserved — state_set would erase it.

        Args:
            scope: One of 'session', 'user', or 'app'. Use 'user' or 'app' to
                   persist across future runs.
            key:   The key to append to within this connector's namespace.
            value: A single value to add, or a list of values to add all at
                   once (e.g. ["a", "b", "c"] appends all three in one call).

        Returns:
            A dict with 'status' and the resulting 'value' (the full list).
        """
        prefix = self._resolve_scope(scope)
        if prefix is None:
            return {"status": "error", "message": f"Invalid scope '{scope}'."}

        full_key = self._key(prefix, key)
        current = tool_context.state.get(full_key)
        new_items = value if isinstance(value, list) else [value]
        new_list = (
            [*self._as_list(current), *new_items]
            if current is not None
            else list(new_items)
        )

        tool_context.state[full_key] = new_list
        return {"status": "success", "value": new_list}

    @connector_tool
    async def state_remove(
        self,
        scope: str,
        key: str,
        value: Any | list[Any],
        tool_context: ToolContext,
    ) -> dict[str, Any]:
        """REMOVES one or more specific matching values from a list stored
        at a key, keeping everything else untouched. This is the reverse of
        state_append. If the key doesn't exist or the value isn't in the
        list, this is a no-op (not an error).

        Use this when the request is to remove/delete/take out ONE item from
        a list rather than clear the whole key (e.g. "remove X from the
        list", "delete Y from seen_docs") — do NOT use state_delete for
        this, since state_delete erases the entire key/list, not one item.

        Args:
            scope: One of 'session', 'user', or 'app'.
            key:   The key whose list to remove from, within this
                   connector's namespace.
            value: A single value to remove, or a list of values to remove
                   all at once. Every matching occurrence is removed.

        Returns:
            A dict with 'status' and the resulting 'value' (the list after
            removal).
        """
        prefix = self._resolve_scope(scope)
        if prefix is None:
            return {"status": "error", "message": f"Invalid scope '{scope}'."}

        full_key = self._key(prefix, key)
        current = tool_context.state.get(full_key)
        to_remove = value if isinstance(value, list) else [value]

        if current is None:
            return {"status": "success", "value": []}

        remaining = [item for item in self._as_list(current) if item not in to_remove]
        tool_context.state[full_key] = remaining
        return {"status": "success", "value": remaining}

    @connector_tool
    async def state_update(
        self,
        scope: str,
        key: str,
        old_value: Any,
        new_value: Any,
        tool_context: ToolContext,
    ) -> dict[str, Any]:
        """REPLACES one specific item within a list with a new value, in
        place, leaving every other item and the order untouched. If the
        stored value is not a list, and it equals old_value, it is replaced
        directly. If old_value isn't found, this is a no-op (not an error)
        and the list is returned unchanged.

        Use this when the request is to update/change/correct ONE item
        within a list of values (e.g. "change test2 to test2-revised in
        hassaan_test_docs") rather than replace the whole key — do NOT use
        state_set for this, since state_set would discard every other item
        in the list; do NOT use state_remove + state_append either, since
        that loses the item's position and is two calls instead of one.

        Args:
            scope: One of 'session', 'user', or 'app'.
            key:   The key whose list (or single value) to update, within
                   this connector's namespace.
            old_value: The existing item to find and replace.
            new_value: The value to put in its place.

        Returns:
            A dict with 'status', 'updated' (bool, whether old_value was
            found), and the resulting 'value'.
        """
        prefix = self._resolve_scope(scope)
        if prefix is None:
            return {"status": "error", "message": f"Invalid scope '{scope}'."}

        full_key = self._key(prefix, key)
        current = tool_context.state.get(full_key)

        if current is None:
            return {"status": "success", "updated": False, "value": None}

        if not isinstance(current, list):
            if current == old_value:
                tool_context.state[full_key] = new_value
                return {"status": "success", "updated": True, "value": new_value}
            return {"status": "success", "updated": False, "value": current}

        updated = False
        new_list = []
        for item in current:
            if not updated and item == old_value:
                new_list.append(new_value)
                updated = True
            else:
                new_list.append(item)

        if updated:
            tool_context.state[full_key] = new_list
        return {"status": "success", "updated": updated, "value": new_list}

    @connector_tool
    async def state_delete(
        self, scope: str, key: str | list[str], tool_context: ToolContext
    ) -> dict[str, Any]:
        """Permanently removes one or more keys and their values entirely.
        Succeeds even if a key was never set. Use this only when the whole
        key/list should be gone — to remove just one item from a list while
        keeping the rest, use state_remove instead; this tool erases the
        entire key.

        Args:
            scope: One of 'session', 'user', or 'app'.
            key:   A single key, or a list of keys, to remove within this
                   connector's namespace.

        Returns:
            If key is a single string: a dict with 'existed' (bool).
            If key is a list: a dict with 'results', a list of
            {'key', 'existed'} in the same order as the input keys.
        """
        prefix = self._resolve_scope(scope)
        if prefix is None:
            return {"status": "error", "message": f"Invalid scope '{scope}'."}

        def _delete_one(k: str) -> bool:
            full_key = self._key(prefix, k)
            existed = full_key in tool_context.state
            # Assigning None is the state-delta-safe way to clear a key; a
            # bare dict pop would not always round-trip through the
            # persistent service.
            if existed:
                tool_context.state[full_key] = None
            return existed

        if isinstance(key, list):
            results = [{"key": k, "existed": _delete_one(k)} for k in key]
            return {"status": "success", "results": results}

        return {"status": "success", "existed": _delete_one(key)}

    @connector_tool
    async def state_keys(self, scope: str, tool_context: ToolContext) -> dict[str, Any]:
        """Lists all keys stored under this connector's namespace and scope.

        Args:
            scope: One of 'session', 'user', or 'app'.

        Returns:
            A dict with 'keys' (a list of key names, namespace stripped).
        """
        prefix = self._resolve_scope(scope)
        if prefix is None:
            return {"status": "error", "message": f"Invalid scope '{scope}'."}

        namespace_prefix = self._key(prefix, "")
        keys = [
            stored_key[len(namespace_prefix) :]
            for stored_key, val in tool_context.state.to_dict().items()
            if stored_key.startswith(namespace_prefix) and val is not None
        ]
        return {"status": "success", "keys": keys}

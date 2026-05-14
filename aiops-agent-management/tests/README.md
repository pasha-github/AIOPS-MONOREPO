# Tests

This folder contains the automated test suite for the API, loader, cache, connector, secret, and session-summary behavior in this repository.

## Structure

- `conftest.py`
  Shared pytest fixtures. Most API tests use:
  - `session`: creates a fresh test database schema for each test
  - `client`: FastAPI `TestClient` with the app session dependency overridden

- `test_agents.py`
  CRUD and validation coverage for agent routes, including cache invalidation behavior from the API layer.

- `test_agent_loader.py`
  Unit tests for `DatabaseAgentLoader`. These tests isolate loader behavior with fakes and monkeypatching instead of using the real ADK runtime.

- `test_adk_cache.py`
  Unit tests for cache invalidation helpers in `utils.adk_app`.

- `test_llms.py`
  CRUD and validation coverage for model configuration routes.

- `test_connectors.py`
  Connector discovery, connector config routes, and helper behavior for loading connector tools.

- `test_secrets.py`
  Encryption and decryption behavior for stored secrets.

- `test_session_summary.py`
  Session summary callback behavior and fallback handling.

- `test_api.py`, `test_health.py`
  Basic API and health endpoint coverage.

## Running Tests

Use the project virtual environment so dependencies match the app:

```powershell
.\.venv\Scripts\python.exe -m pytest
```

Run a single file:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_agent_loader.py -q
```

Run a couple of focused files:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_adk_cache.py tests/test_agent_loader.py -q
```

If you need a custom database for tests, set `TEST_MAIN_DATABASE_URL` before running pytest. If it is not set, tests default to `sqlite:///./test.db`.

## Conventions

- Prefer small, focused tests with names that describe the behavior being verified.
- Keep API-route tests in the route-oriented files such as `test_agents.py` and `test_llms.py`.
- Keep pure unit tests close to the utility or module they validate.
- Use `monkeypatch` to isolate external systems, environment variables, cache state, and ADK objects.
- When mocking constructors or wrappers, make the fake match the current call shape closely.
- Record keyword arguments when possible.
- Avoid overly permissive lambdas that would still pass if the production code drifts.
- When testing cache behavior, patch the module-local cache dependency instead of mutating the shared singleton directly.
- Assert behavior, not just non-failure.
- Prefer checking returned object shape, constructor inputs, cache writes, and side effects.
- Avoid tests that only assert `agent is not None` unless survival is the exact behavior under test.
- If a production branch creates a different object type, add a dedicated test for that branch.

## Updating Tests

Before changing a test, inspect the current implementation it covers. Loader and cache tests are especially sensitive to drift because the production code uses monkeypatched collaborators and module-level state.

A good test update usually includes:

- verifying the current implementation path first
- tightening mocks to match real constructor signatures and side effects
- updating assertions so the test proves intended behavior, not just that no exception was raised
- running the smallest relevant pytest target before broader test runs

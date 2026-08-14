# SOP Ingestion Pipeline

Fetches Standard Operating Procedure documents from a configured source, parses
and sections them, embeds each section, and persists everything into the SOP
tables that `src/retrieval.py` and the `document_connector` read from.

The package depends only on `src.database`, `src.connectors`, and
`src.ingestion.*` — no FastAPI, no routers — so it can later be lifted into a
standalone service. Every external step is a constructor-injected **seam**
(`SourceFetcher` / `Parser` / `Normalizer` / `Storage`), which is also what makes
the pipeline unit-testable without live calls.

## Pipeline stages

`IngestionManager.run()` walks each enabled `IngestionSource` through:

| # | Stage | Module | What happens |
|---|---|---|---|
| 1 | discover | `fetchers/` | List documents in the source (e.g. a SharePoint folder). |
| 2 | diff | `storage.py` | Compare each doc's change token to the stored one; unchanged docs are skipped without downloading. |
| 3 | fetch | `fetchers/` | Download the changed document's bytes. |
| 4 | parse (Pass 1) | `docling_processor.py` / `parser.py` | Produce **verbatim** ordered elements. No sectioning. |
| 5 | normalize (Pass 2) | `normalizer.py` | Group elements into flat sections. |
| 6 | embed | `src/embedding.py` | One vector per section (batched). Fail-soft: content still persists if embedding errors. |
| 7 | store | `storage.py` | Atomic upsert into the six SOP tables. |

Sectioning never edits element text. The `LlmNormalizer` (opt-in) emits **ids
only** and a deterministic validator gate proves no text was added, dropped,
reordered, or altered — otherwise it falls back to the flat normalizer.

## Swappable backends

| Seam | Default | Selected by | Alternatives |
|---|---|---|---|
| Fetcher | SharePoint (Graph API) | `IngestionSource.source_type` (`resolve_fetcher`) | add a module under `fetchers/` |
| Parser | Docling | `IngestionSource.parser_backend` (`resolve_parser`) | `passthrough` (plain `.md`/`.txt`, no Docling call) |
| Normalizer | `FlatNormalizer` | `SOP_NORMALIZER_MODEL` (`resolve_normalizer`) | `LlmNormalizer` when the env var is set |
| Embedder | `HashingEmbedder` | `SOP_EMBEDDING_MODEL` (`resolve_embedder`) | any litellm model |
| Storage | `DbStorage` | constructor | `LoggingStorage` stub for dev |

## How a run is triggered

- **Startup** — `INGEST_ON_STARTUP=true` kicks off a background run at boot.
- **REST** — `POST /documents/reingest`.
- **Agent** — the `ingest_sop()` connector tool.
- **Scheduled** — a `Job` with `job_type="ingestion"` (APScheduler).

Runs are serialized by a single in-process lock (a second trigger returns
"busy"); the manager runs in a worker thread so it never blocks the event loop.

## Configuration

All env vars are documented in [`.env.sample`](../../.env.sample). The source is
seeded from `SHP_*` env vars by `bootstrap.py` until the admin UI lands. Key
knobs: `SOP_EMBEDDING_MODEL` / `SOP_EMBEDDING_DIM`, `SOP_NORMALIZER_MODEL`,
`SOP_PARSER_BACKEND`, `DOCLING_URL`.

## Debugging

- `INGEST_STOP_AFTER=discover|fetch|parse|normalize` halts a run right after the
  named stage **without writing to the DB**, to validate one external dependency
  at a time.
- `LOG_LEVEL=DEBUG` emits the per-step `[1/discover]…[7/store]` markers and tees
  them to `logs/aiops.log`. At `INFO` (default) only the one-line per-run summary
  and warnings/errors are logged.

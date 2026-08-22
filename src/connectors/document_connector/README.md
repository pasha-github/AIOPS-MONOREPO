# Documents (SOP) Connector

Agent-facing retrieval over the ingested SOP corpus. The agent reaches SOP
content **only by id** — search returns section ids, and the fetch tool takes
ids — so there is no free-text path into stored text, and a section is always
returned **whole** (its elements joined in reading order).

## Tools
| Tool | Purpose |
|---|---|
| `search_sop(error_pattern, top_k)` | Find candidate sections by error/symptom/task. **Hybrid** — exact/substring `trigger_text`/`title` match fused with semantic cosine, so error codes rank deterministically. Returns several candidates (id, title, short `snippet`, `score`), never raw text; defaults to `top_k=5` so the agent can compare and verify before fetching. |
| `get_sop_section(sop_section_id)` | Fetch one section in full — markdown rendered from its elements, plus the ordered elements (each with a stable `element_ref`). |
| `list_sop_sections(sop_document_id)` | List a document's sections by id (titles + element refs). |
| `ingest_sop()` | Trigger background re-ingestion when SOP content has drifted. |

## Notes
- **Read-only data plane.** This connector reads `sop_document` / `sop_section` /
  `sop_element` / `sop_section_embedding`. It never touches the control plane
  (`ingestion_source`, `ingested_document`). In production, grant the connection
  the read-only `sop_reader` role on the data-plane tables only.
- **Embeddings** are produced at ingestion time. Set `SOP_EMBEDDING_MODEL`
  (default `text-embedding-3-small`; or e.g. `vertex_ai/text-embedding-004`) for
  real semantic search; without it a deterministic local hashing embedder
  provides lexical matching only.
- **Semantic search is dialect-aware:** pgvector `<=>` over the HNSW index on
  PostgreSQL, brute-force Python cosine on SQLite (dev/CI).

## Config
| Variable | Required | Purpose |
|---|---|---|
| `prefix` | no | Optional prefix applied to tool names. |

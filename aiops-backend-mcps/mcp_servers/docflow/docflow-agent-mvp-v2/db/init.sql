-- DOCFlow agent — lifecycle ledger (append-only)

CREATE TABLE IF NOT EXISTS runs (
    id          SERIAL PRIMARY KEY,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    status      TEXT NOT NULL DEFAULT 'running',   -- running | ok | error
    summary     JSONB,
    error       TEXT
);

CREATE TABLE IF NOT EXISTS doc_events (
    id          SERIAL PRIMARY KEY,
    run_id      INTEGER REFERENCES runs(id),
    doc_no      TEXT NOT NULL,
    title       TEXT,
    revision    TEXT,
    status      TEXT NOT NULL,
    comment     TEXT,
    source      TEXT NOT NULL DEFAULT 'docflow-ui',
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attachments (
    id          SERIAL PRIMARY KEY,
    run_id      INTEGER REFERENCES runs(id),
    doc_no      TEXT NOT NULL,
    filename    TEXT NOT NULL,
    file_path   TEXT,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_events_doc ON doc_events (doc_no, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_attachments_doc ON attachments (doc_no);

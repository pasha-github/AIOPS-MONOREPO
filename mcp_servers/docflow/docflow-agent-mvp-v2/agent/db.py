"""Append-only Postgres ledger for the DOCFlow agent."""
import json
import os
from typing import Any

import psycopg
from psycopg.rows import dict_row

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://docflow:docflow@postgres:5432/docflow"
)


def _conn():
    return psycopg.connect(DATABASE_URL, autocommit=True, row_factory=dict_row)


def start_run() -> int:
    with _conn() as c:
        return c.execute("INSERT INTO runs DEFAULT VALUES RETURNING id").fetchone()["id"]


def finish_run(run_id: int, status: str, summary: dict[str, Any] | None, error: str | None = None) -> None:
    with _conn() as c:
        c.execute(
            "UPDATE runs SET finished_at = now(), status = %s, summary = %s, error = %s WHERE id = %s",
            (status, json.dumps(summary) if summary else None, error, run_id),
        )


def append_doc_event(run_id: int, doc_no: str, title: str | None, revision: str | None,
                     status: str, comment: str | None) -> None:
    with _conn() as c:
        c.execute(
            """INSERT INTO doc_events (run_id, doc_no, title, revision, status, comment)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (run_id, doc_no, title, revision, status, comment),
        )


def append_attachment(run_id: int, doc_no: str, filename: str, file_path: str | None) -> None:
    with _conn() as c:
        c.execute(
            """INSERT INTO attachments (run_id, doc_no, filename, file_path)
               VALUES (%s, %s, %s, %s)""",
            (run_id, doc_no, filename, file_path),
        )


# ---------- delta sync ----------

def get_synced_docs(limit: int = 200) -> set[tuple[str, str]]:
    """Distinct (doc_no, latest revision) pairs already in the ledger."""
    with _conn() as c:
        rows = c.execute(
            """SELECT DISTINCT ON (doc_no) doc_no, COALESCE(revision, '') AS revision
               FROM doc_events
               ORDER BY doc_no, captured_at DESC
               LIMIT %s""",
            (limit,),
        ).fetchall()
    return {(r["doc_no"], r["revision"]) for r in rows}


# ---------- chat cache lookups ----------

def get_latest_doc_event(doc_no: str) -> dict[str, Any] | None:
    """Most recent ledger event for a document (case-insensitive match)."""
    with _conn() as c:
        return c.execute(
            """SELECT doc_no, title, revision, status, comment, captured_at
               FROM doc_events
               WHERE lower(doc_no) = lower(%s)
               ORDER BY captured_at DESC
               LIMIT 1""",
            (doc_no,),
        ).fetchone()


def get_attachments(doc_no: str) -> list[dict[str, Any]]:
    with _conn() as c:
        return c.execute(
            """SELECT DISTINCT ON (filename) filename, file_path, captured_at
               FROM attachments
               WHERE lower(doc_no) = lower(%s)
               ORDER BY filename, captured_at DESC""",
            (doc_no,),
        ).fetchall()


def get_doc_history(doc_no: str, limit: int = 20) -> list[dict[str, Any]]:
    with _conn() as c:
        return c.execute(
            """SELECT status, revision, comment, captured_at
               FROM doc_events
               WHERE lower(doc_no) = lower(%s)
               ORDER BY captured_at DESC
               LIMIT %s""",
            (doc_no, limit),
        ).fetchall()

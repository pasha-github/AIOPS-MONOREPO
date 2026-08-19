#!/usr/bin/env python3
"""DocFlow AI POC — shared-state backend (Python standard library only).

Why this exists
---------------
The POC kept every created document in the browser's localStorage, so state
never left the machine *and browser profile* that created it. This server
replaces that mirror with one shared SQLite file, so several users on several
browsers see the same document register — and it stores real uploaded
attachment bytes, so the links in the document table open the actual file
instead of a placeholder generated at click time.

Deliberately dependency-free: `python server/app.py` runs on a stock Python
3.9+, and the container image needs no pip install. It is a POC server, not a
hardened one — read DEPLOY.md before exposing it publicly. In particular there
is no server-side authentication: the RBAC in dms.js is a client-side demo
filter, so anyone who can reach /api/state can read every document.

API
---
  GET  /healthz                 liveness probe (Cloud Run)
  GET  /api/state               {seeded, documents[], audit[], server_time}
  POST /api/seed                {documents:[...]} — applied only if empty
  PUT  /api/documents/{doc_id}  upsert one document (full JSON payload)
  POST /api/audit               append one audit entry, or a list of them
  POST /api/files?name=X.pdf    raw body = file bytes -> {file_id, ...}
  GET  /api/files/{file_id}     serve stored bytes (inline where safe)
  POST /api/reset               wipe documents, audit and files

Everything else is served from the static directory (the POC front-end).
"""
import json
import mimetypes
import os
import sqlite3
import sys
import threading
import uuid
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

HERE = Path(__file__).resolve().parent
STATIC_DIR = Path(os.environ.get("STATIC_DIR", HERE.parent))
DATA_DIR = Path(os.environ.get("DATA_DIR", HERE / "data"))
DB_PATH = DATA_DIR / "docflow.sqlite3"
PORT = int(os.environ.get("PORT", "8321"))

# Uploads live as BLOBs in the same SQLite file, so "back up the data" means
# copying one file. Keep the cap well under Cloud Run's 32MB request limit.
MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", 24 * 1024 * 1024))
MAX_JSON_BYTES = 8 * 1024 * 1024
AUDIT_PAGE_SIZE = 500

# The static root is the whole POC folder, which also contains the database,
# this server's source, and a sibling service's .env. A plain static server
# hands all of that to anyone who guesses the path — `GET
# /server/data/docflow.sqlite3` would be the entire document register, and
# `/docflow-agent-mvp-v2/.env` the OpenRouter key. Serve only what the
# front-end actually needs.
BLOCKED_DIRS = {"server", "docflow-agent-mvp-v2", "design", ".claude", ".git"}
BLOCKED_SUFFIXES = (".py", ".sqlite3", ".sqlite3-wal", ".sqlite3-shm", ".env", ".sql")

# Content types we are willing to render inline in the browser. Anything else
# is forced to download: serving arbitrary user-uploaded HTML/SVG inline from
# our own origin would be stored XSS against every other logged-in user.
INLINE_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "text/plain",
}

_write_lock = threading.Lock()


# ----------------------------------------------------------------- database


def connect():
    conn = sqlite3.connect(DB_PATH, timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=15000")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS documents (
                doc_id     TEXT PRIMARY KEY,
                doc_number TEXT,
                payload    TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS audit_log (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT,
                user      TEXT,
                action    TEXT,
                detail    TEXT
            );
            CREATE TABLE IF NOT EXISTS files (
                file_id      TEXT PRIMARY KEY,
                file_name    TEXT NOT NULL,
                content_type TEXT NOT NULL,
                size         INTEGER NOT NULL,
                uploaded_by  TEXT,
                uploaded_at  TEXT NOT NULL,
                data         BLOB NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_documents_number ON documents(doc_number);
            """
        )


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def read_state():
    with connect() as conn:
        docs = [json.loads(r["payload"]) for r in conn.execute(
            "SELECT payload FROM documents ORDER BY doc_id")]
        audit = [dict(r) for r in conn.execute(
            "SELECT timestamp, user, action, detail FROM audit_log"
            " ORDER BY id DESC LIMIT ?", (AUDIT_PAGE_SIZE,))]
    audit.reverse()  # oldest-first, matching the in-browser AUDIT_LOG order
    return {"seeded": bool(docs), "documents": docs, "audit": audit,
            "server_time": now_iso()}


def seed_documents(docs):
    """Insert the seed register, but only into an empty database.

    Two browsers booting at once both see seeded=false and both POST here; the
    count check inside the write lock makes the loser a no-op instead of
    duplicating all 18 documents.
    """
    with _write_lock, connect() as conn:
        existing = conn.execute("SELECT COUNT(*) AS n FROM documents").fetchone()["n"]
        if existing:
            return {"seeded": False, "reason": "database already populated",
                    "count": existing}
        stamp = now_iso()
        conn.executemany(
            "INSERT INTO documents (doc_id, doc_number, payload, updated_at)"
            " VALUES (?, ?, ?, ?)",
            [(d.get("doc_id"), d.get("doc_number"), json.dumps(d), stamp)
             for d in docs if d.get("doc_id")],
        )
        return {"seeded": True, "count": len(docs)}


def upsert_document(doc_id, doc):
    with _write_lock, connect() as conn:
        conn.execute(
            "INSERT INTO documents (doc_id, doc_number, payload, updated_at)"
            " VALUES (?, ?, ?, ?)"
            " ON CONFLICT(doc_id) DO UPDATE SET"
            "   doc_number=excluded.doc_number,"
            "   payload=excluded.payload,"
            "   updated_at=excluded.updated_at",
            (doc_id, doc.get("doc_number"), json.dumps(doc), now_iso()),
        )
    return {"ok": True, "doc_id": doc_id}


def append_audit(entries):
    rows = [(e.get("timestamp"), e.get("user"), e.get("action"), e.get("detail"))
            for e in entries]
    with _write_lock, connect() as conn:
        conn.executemany(
            "INSERT INTO audit_log (timestamp, user, action, detail)"
            " VALUES (?, ?, ?, ?)", rows)
    return {"ok": True, "count": len(rows)}


def store_file(file_name, content_type, uploaded_by, blob):
    file_id = uuid.uuid4().hex
    with _write_lock, connect() as conn:
        conn.execute(
            "INSERT INTO files (file_id, file_name, content_type, size,"
            " uploaded_by, uploaded_at, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (file_id, file_name, content_type, len(blob), uploaded_by,
             now_iso(), sqlite3.Binary(blob)),
        )
    return {"file_id": file_id, "file_name": file_name, "size": len(blob),
            "content_type": content_type}


def load_file(file_id):
    with connect() as conn:
        row = conn.execute(
            "SELECT file_name, content_type, data FROM files WHERE file_id = ?",
            (file_id,)).fetchone()
    return row


def reset_all():
    with _write_lock, connect() as conn:
        conn.execute("DELETE FROM documents")
        conn.execute("DELETE FROM audit_log")
        conn.execute("DELETE FROM files")
    return {"ok": True}


# ------------------------------------------------------------------ handler


class Handler(SimpleHTTPRequestHandler):
    server_version = "DocFlowPOC/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    # ---- helpers ----

    def _json(self, payload, status=HTTPStatus.OK):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _error(self, status, message):
        self._json({"error": message}, status=status)

    def _read_body(self, limit):
        length = int(self.headers.get("Content-Length") or 0)
        if length > limit:
            return None
        return self.rfile.read(length) if length else b""

    def _read_json(self):
        raw = self._read_body(MAX_JSON_BYTES)
        if raw is None:
            self._error(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "payload too large")
            return None
        try:
            return json.loads(raw or b"{}")
        except json.JSONDecodeError as exc:
            self._error(HTTPStatus.BAD_REQUEST, f"invalid JSON: {exc}")
            return None

    def end_headers(self):
        # The POC's own assets change constantly during demos and these simple
        # dev servers send no validators, so browsers happily serve a stale
        # app.js after an edit (README §1 warns about exactly this). Opt out.
        if not self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-cache, must-revalidate")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s  %s\n" % (self.log_date_time_string(), fmt % args))

    # ---- routing ----

    def _blocked_static(self, route):
        parts = [p for p in unquote(route).split("/") if p not in ("", ".")]
        if any(p.startswith(".") for p in parts):
            return True
        if parts and parts[0] in BLOCKED_DIRS:
            return True
        return any(p.lower().endswith(BLOCKED_SUFFIXES) for p in parts)

    def do_GET(self):
        route = urlparse(self.path).path
        if route == "/healthz":
            return self._json({"status": "ok", "time": now_iso()})
        if route == "/api/state":
            return self._json(read_state())
        if route.startswith("/api/files/"):
            return self._serve_file(unquote(route[len("/api/files/"):]))
        if route.startswith("/api/"):
            return self._error(HTTPStatus.NOT_FOUND, "no such endpoint")
        if self._blocked_static(route):
            return self._error(HTTPStatus.FORBIDDEN, "not served")
        return super().do_GET()

    def do_HEAD(self):
        route = urlparse(self.path).path
        if route.startswith("/api/"):
            return self._json({})
        if self._blocked_static(route):
            return self._error(HTTPStatus.FORBIDDEN, "not served")
        return super().do_HEAD()

    def do_POST(self):
        route = urlparse(self.path).path
        if route == "/api/seed":
            payload = self._read_json()
            if payload is None:
                return
            docs = payload.get("documents") or []
            if not isinstance(docs, list):
                return self._error(HTTPStatus.BAD_REQUEST, "documents must be a list")
            return self._json(seed_documents(docs))
        if route == "/api/audit":
            payload = self._read_json()
            if payload is None:
                return
            entries = payload if isinstance(payload, list) else [payload]
            return self._json(append_audit(entries))
        if route == "/api/files":
            return self._store_upload()
        if route == "/api/reset":
            return self._json(reset_all())
        return self._error(HTTPStatus.NOT_FOUND, "no such endpoint")

    def do_PUT(self):
        route = urlparse(self.path).path
        if route.startswith("/api/documents/"):
            doc_id = unquote(route[len("/api/documents/"):])
            if not doc_id:
                return self._error(HTTPStatus.BAD_REQUEST, "doc_id required")
            doc = self._read_json()
            if doc is None:
                return
            if not isinstance(doc, dict) or not doc.get("doc_id"):
                return self._error(HTTPStatus.BAD_REQUEST, "document payload required")
            return self._json(upsert_document(doc_id, doc))
        return self._error(HTTPStatus.NOT_FOUND, "no such endpoint")

    # ---- files ----

    def _store_upload(self):
        """Raw-body upload: POST /api/files?name=drawing.pdf with the file as
        the request body. Avoids hand-rolling multipart parsing, and the
        browser side is just `fetch(url, {method:'POST', body: fileObject})`."""
        params = parse_qs(urlparse(self.path).query)
        file_name = (params.get("name") or ["upload.bin"])[0]
        file_name = os.path.basename(file_name).strip() or "upload.bin"
        uploaded_by = (params.get("by") or [""])[0]

        blob = self._read_body(MAX_UPLOAD_BYTES)
        if blob is None:
            return self._error(
                HTTPStatus.REQUEST_ENTITY_TOO_LARGE,
                f"file exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)}MB POC limit")
        if not blob:
            return self._error(HTTPStatus.BAD_REQUEST, "empty upload")

        content_type = (self.headers.get("Content-Type")
                        or mimetypes.guess_type(file_name)[0]
                        or "application/octet-stream")
        return self._json(store_file(file_name, content_type, uploaded_by, blob))

    def _serve_file(self, file_id):
        row = load_file(file_id)
        if row is None:
            return self._error(HTTPStatus.NOT_FOUND, "attachment not found")
        content_type = row["content_type"]
        disposition = "inline" if content_type in INLINE_TYPES else "attachment"
        # Quote-escape the filename so a quote in it can't break out of the header.
        safe_name = row["file_name"].replace('"', "")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(row["data"])))
        self.send_header("Content-Disposition",
                         f'{disposition}; filename="{safe_name}"')
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(row["data"])


def parse_args(argv):
    """Tiny flag parser so the launch configs can run two ports against the
    same database (handy for demoing two roles side by side). Env vars remain
    the deployment interface; flags are the local-dev convenience."""
    global PORT, DATA_DIR, DB_PATH
    for flag, value in zip(argv, argv[1:]):
        if flag == "--port":
            PORT = int(value)
        elif flag == "--data-dir":
            DATA_DIR = Path(value)
            DB_PATH = DATA_DIR / "docflow.sqlite3"


def main():
    parse_args(sys.argv[1:])
    init_db()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    server.daemon_threads = True
    print(f"DocFlow AI POC — serving {STATIC_DIR}", flush=True)
    print(f"  database : {DB_PATH}", flush=True)
    print(f"  listening: http://0.0.0.0:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nshutting down", flush=True)
        server.shutdown()


if __name__ == "__main__":
    main()

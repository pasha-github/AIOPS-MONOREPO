# DocFlow AI POC — running and deploying

The POC now has a small backend ([server/app.py](server/app.py)) so the document
register is **shared**: several users on several browsers see the same
documents, and uploaded attachments are stored as real files instead of
placeholders generated at download time.

The server is Python standard library only — no pip install, no
`requirements.txt`, nothing to vendor.

---

## 1. Run it locally

```bash
python server/app.py
```

Open <http://localhost:8321>. The database is created on first run at
`server/data/docflow.sqlite3` and seeded from `data.js` the first time a
browser connects to an empty one.

Two ports against the same database, for demoing two roles side by side:

```bash
python server/app.py --port 8322
```

Both `.claude/launch.json` configs (`docflow-poc`, `docflow-poc-alt`) do this.
Unlike the old localStorage build, the two ports now show **the same
register** — a comment added on 8321 appears on 8322 within 15 seconds.

### Still works without the server

If the API can't be reached — you opened `index.html` over `file://`, or are
running a plain `python -m http.server` — the app falls back to its original
per-browser localStorage mode and says so under the login form. Nothing
breaks; the data just stops being shared.

---

## 2. Run the container

```bash
docker build -t docflow-poc .
```

```bash
docker run --rm -p 8080:8080 -v docflow-data:/data docflow-poc
```

The named volume is what makes the data outlive the container. Without it,
every `docker run` starts from the seed register again.

---

## 3. Deploy to Cloud Run

From this directory (`mcp_servers/docflow`):

```bash
gcloud run deploy docflow-poc --source . --region us-central1 --allow-unauthenticated --min-instances 1 --max-instances 1
```

`--source` builds the image with Cloud Build and deploys it; no local Docker
needed. `PORT` is injected by Cloud Run and the server honours it.

### Read this part before you demo it

**Cloud Run's filesystem is in-memory and ephemeral.** With the command above,
`/data/docflow.sqlite3` lives in the instance's RAM. That means:

- Every user sees the same data **while the instance is alive** — the shared-
  register requirement is met.
- The data is **lost on redeploy, on restart, and when the instance scales to
  zero after idling.** The register returns to the 18 seeded documents.
- `--max-instances 1` is not optional. SQLite is a single-file database with
  no network protocol; two instances would each hold their own copy and users
  would see different registers depending on which one they hit.

`--min-instances 1` keeps the instance warm (and the data alive) between
demos, at the cost of billing for an always-on instance.

### Making the data durable

| Option | What to do | Trade-off |
|---|---|---|
| **Accept it** | The command above | Fine for a demo you re-seed each time. Data lost on restart. |
| **GCS volume mount** | Add `--add-volume name=data,type=cloud-storage,bucket=YOUR_BUCKET` and `--add-volume-mount volume=data,mount-path=/data` | Survives restarts. SQLite over gcsfuse is only safe with `--max-instances 1`, and file locking is imperfect — good enough for a POC, not for production. |
| **Cloud SQL (the real answer)** | Move the three tables to Postgres and point the server at it | Proper concurrency and durability, multiple instances. Needs the storage layer in `server/app.py` rewritten — the API surface stays identical. |

The `docflow-agent-mvp-v2` stack next door already runs a Postgres, if you want
a reference for the third option.

---

## 4. Security — do not skip this

This is a POC. The RBAC in [dms.js](dms.js) is a **client-side demo filter, not
enforcement**:

- **There is no server-side authentication.** Anyone who can reach
  `/api/state` gets every document in the register, masking and role scoping
  included, regardless of who they'd log in as.
- Every browser holds the full register in memory. The commercial BOQ values
  hidden from a Document Controller in the UI are readable in DevTools.
- Any client can `PUT /api/documents/{id}` and rewrite any document.
- `/api/files/{id}` is unauthenticated — the URL is the only secret, and it's a
  128-bit random hex, but it's still bearer access to the file. The document
  table now shows these as **full absolute URLs with a Copy button**, precisely
  so they can be used outside DocFlow: pasted into an email, opened in another
  browser, or fetched by another system. Treat every one you hand out as
  permanent, unauthenticated access to that file — there is no expiry and no
  revocation short of deleting the row from the `files` table.

So: **`--allow-unauthenticated` is for a throwaway demo on non-sensitive data
only.** For anything with real project documents, put Cloud Run behind IAP or
require authenticated invocation, and move the role checks server-side.

Uploads are capped at 24 MB (`MAX_UPLOAD_BYTES`) and only PDFs, images and
plain text are served with `Content-Disposition: inline` — anything else is
forced to download, so an uploaded `.html` can't run as script on the app's own
origin. The server also refuses to serve its own source, the database,
dotfiles, and the sibling `docflow-agent-mvp-v2/.env`, all of which sit inside
the static root and would otherwise be downloadable.

---

## 5. Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8321` (`8080` in the image) | Listen port. Cloud Run sets this. |
| `DATA_DIR` | `server/data` (`/data` in the image) | Where `docflow.sqlite3` lives. |
| `STATIC_DIR` | the repo folder (`/app` in the image) | Front-end files to serve. |
| `MAX_UPLOAD_BYTES` | `25165824` (24 MB) | Per-file upload cap. Keep under Cloud Run's 32 MB request limit. |

CLI flags `--port` and `--data-dir` override the env vars for local runs.

---

## 6. Operations

Inspect the register:

```bash
python -c "import sqlite3;c=sqlite3.connect('server/data/docflow.sqlite3');print(c.execute('select count(*) from documents').fetchone())"
```

Back it up — one file, plus the WAL sidecars if the server is running:

```bash
python -c "import sqlite3;s=sqlite3.connect('server/data/docflow.sqlite3');d=sqlite3.connect('backup.sqlite3');s.backup(d)"
```

Reset to the seed register: sign in as `layla` (Admin) and ask the chat to
`reset demo data`. In server mode this wipes the shared database **for every
user**, then re-seeds from `data.js`.

---

## 7. Known limits of this build

- **Last-write-wins per document.** Writes are per-document, so two people
  editing two different documents never collide. Two people commenting on the
  *same* document within the same 15-second window can lose one comment.
- **15-second poll**, not push. Another user's change takes up to 15 seconds to
  appear (immediately, if you switch tabs). No WebSocket.
- **Seeded attachments are generated content, but they are real files.** The 18
  seeded documents never had bytes, so on first connect the app generates each
  attachment's placeholder (drawing sheet, image or metadata text), uploads it,
  and stores the `file_id` — which is what gives every row in the register a
  shareable URL. The bytes behind a seeded link are a generated stand-in, not a
  real drawing; the content itself says so. Files uploaded through *New
  document* are the genuine article.
- **The backfill is per-database, not per-deploy.** An existing deployment is
  backfilled the next time a browser connects, so no reset is needed. If two
  browsers connect simultaneously into an un-backfilled database they each
  upload a copy and the later write wins, leaving the other's blobs orphaned in
  the `files` table — wasted space, nothing user-visible.
- **The audit log returns the most recent 500 entries.**

# Ops Runbook — AIOps SOP Pipeline

Quick reference for ingestion, schema changes, and redeployment.

> **Production Cloud Run URL:** `https://agent-manager-dev-yxjhs6bq5a-uc.a.run.app`

---

## 1. Environment Variables

All variables go in `.env` (local) or Cloud Run env config (production).

### Required for ingestion

```
# SharePoint source
SHP_ID_APP=<app-client-id>
SHP_ID_APP_SECRET=<app-client-secret>
SHP_TENANT_ID=<tenant-id>
SHP_SITE_URL=https://<tenant>.sharepoint.com/sites/<site>
SHP_DOC_LIBRARY=<library-name>
SOP_FOLDER_PATH=<optional-subfolder-path>  # omit to ingest entire library

# Database
MAIN_SERVER_DATABASE_URL=postgresql+psycopg2://user:pass@host:5432/dbname
AGENT_SERVER_DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname

# Encryption (generate once — see command below)
ENCRYPTION_KEY=<fernet-key>
```

Generate an encryption key:

```bash
# bash / Git Bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

```powershell
# PowerShell
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Required for embeddings (pick one)

```
SOP_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_API_KEY=<key>

# OR Vertex AI:
SOP_EMBEDDING_MODEL=vertex_ai/text-embedding-004
SOP_EMBEDDING_DIM=768
# (uses GCP ADC — no key needed if running on Cloud Run with the right SA)
```

### Optional but useful

```
SOP_NORMALIZER_MODEL=vertex_ai/gemini-2.0-flash  # omit → deterministic FlatNormalizer
INGEST_ON_STARTUP=true                            # run ingestion at boot
LOG_LEVEL=DEBUG                                   # verbose pipeline steps
LOG_DIR=logs                                      # rotating log file location
ENV=DEV                                           # enables static UI at /
```

---

## 2. First-Time Setup

```bash
# bash / Git Bash
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

```powershell
# PowerShell
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

*(Commands are identical — both shells work for Python/alembic/uvicorn.)*

---

## 3. Adding New Documents to SharePoint

No code change needed. Place documents in the configured SharePoint folder, then trigger a re-ingest.

### Authenticate to gcloud (skip if already done)

```bash
# bash
gcloud auth login
gcloud config set project <PROJECT_ID>
```

```powershell
# PowerShell
gcloud auth login
gcloud config set project <PROJECT_ID>
```

### Find the Cloud Run URL and the active image

```bash
# bash — list all services with their URLs
gcloud run services list --region=us-central1 `
  --format="table(metadata.name, status.url, status.conditions[0].status)"

# Get URL for a specific service
gcloud run services describe agent-manager-dev --region=us-central1 `
  --format="value(status.url)"

# Which revision is SERVING TRAFFIC right now
gcloud run services describe agent-manager-dev --region=us-central1 `
  --format="value(status.traffic[0].revisionName)"

# Get the image of that active revision (replace REVISION_NAME with output above)
gcloud run revisions describe <REVISION_NAME> --region=us-central1 `
  --format="value(spec.containers[0].image)"

# Full picture: traffic split + active image in one command
gcloud run services describe agent-manager-dev --region=us-central1 `
  --format="yaml(status.traffic, spec.template.spec.containers[0].image)"
```

```powershell
# PowerShell — identical commands (gcloud works the same in PowerShell)
gcloud run services list --region=us-central1 `
  --format="table(metadata.name, status.url, status.conditions[0].status)"

gcloud run services describe agent-manager-dev --region=us-central1 `
  --format="value(status.url)"

gcloud run services describe agent-manager-dev --region=us-central1 `
  --format="value(status.traffic[0].revisionName)"

gcloud run revisions describe <REVISION_NAME> --region=us-central1 `
  --format="value(spec.containers[0].image)"
```

### Confirm env vars on the active revision

```bash
# bash — env vars on the revision currently serving traffic
gcloud run revisions describe <REVISION_NAME> --region=us-central1 \
  --format="yaml(spec.containers[0].env)"

# env vars on the service (what the NEXT revision will inherit)
gcloud run services describe agent-manager-dev --region=us-central1 \
  --format="yaml(spec.template.spec.containers[0].env)"
```

```powershell
# PowerShell
gcloud run revisions describe <REVISION_NAME> --region=us-central1 `
  --format="yaml(spec.containers[0].env)"

gcloud run services describe agent-manager-dev --region=us-central1 `
  --format="yaml(spec.template.spec.containers[0].env)"
```

### Trigger re-ingest

```bash
# bash — local
curl -X POST http://localhost:8000/documents/reingest

# bash — production
curl -X POST https://agent-manager-dev-yxjhs6bq5a-uc.a.run.app/documents/reingest

# If the service requires IAM auth:
curl -X POST https://agent-manager-dev-yxjhs6bq5a-uc.a.run.app/documents/reingest \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)"
```

```powershell
# PowerShell — local
Invoke-RestMethod -Method Post -Uri "http://localhost:8000/documents/reingest"

# PowerShell — production
Invoke-RestMethod -Method Post -Uri "https://agent-manager-dev-yxjhs6bq5a-uc.a.run.app/documents/reingest"

# If the service requires IAM auth:
$token = gcloud auth print-identity-token
Invoke-RestMethod -Method Post `
  -Uri "https://agent-manager-dev-yxjhs6bq5a-uc.a.run.app/documents/reingest" `
  -Headers @{ Authorization = "Bearer $token" }
```

### Check ingestion status (wait ~1-2 min after triggering)

Reingest runs in the background. Poll the status endpoint or watch Cloud Run logs.

```bash
# bash — one-shot status check
curl http://localhost:8000/documents/ingestion/status
curl https://agent-manager-dev-yxjhs6bq5a-uc.a.run.app/documents/ingestion/status

# bash — poll every 30s (Ctrl+C to stop); response has: running / current / last_run
watch -n 30 "curl -s https://agent-manager-dev-yxjhs6bq5a-uc.a.run.app/documents/ingestion/status | python -m json.tool"

# Cloud Run logs — tail live (replace SERVICE_NAME if different)
gcloud run services logs tail agent-manager-dev --region=us-central1

# Cloud Run logs — last 50 lines (good for a post-run snapshot)
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="agent-manager-dev"' \
  --limit=50 --format="value(textPayload)" --freshness=10m
```

```powershell
# PowerShell — one-shot status check (response shape: running / current / last_run)
Invoke-RestMethod "http://localhost:8000/documents/ingestion/status"
Invoke-RestMethod "https://agent-manager-dev-yxjhs6bq5a-uc.a.run.app/documents/ingestion/status"

# PowerShell — poll every 30s until done (Ctrl+C to stop)
while ($true) {
    $s = Invoke-RestMethod "https://agent-manager-dev-yxjhs6bq5a-uc.a.run.app/documents/ingestion/status"
    $stored = if ($s.last_run) { $s.last_run.total_stored } else { "?" }
    $state  = if ($s.last_run) { $s.last_run.state }        else { "no_run_yet" }
    Write-Host "$(Get-Date -Format 'HH:mm:ss')  running=$($s.running)  last_state=$state  stored=$stored"
    if (-not $s.running) { break }
    Start-Sleep 30
}


# PowerShell — tail Cloud Run logs live
gcloud run services logs tail agent-manager-dev --region=us-central1

# PowerShell — last 50 lines from Cloud Logging (last 10 minutes)
gcloud logging read `
  'resource.type="cloud_run_revision" AND resource.labels.service_name="agent-manager-dev"' `
  --limit=50 --format="value(textPayload)" --freshness=10m
```

**What to look for in the logs:**

| Log line | Meaning |
|---|---|
| `[1/discover] source='...' found N document(s)` | Discovery done, N files found |
| `[2/diff] ... SKIP unchanged` | File not re-processed (version unchanged) |
| `[2/diff] ... CHANGED → processing` | File will be fetched and re-parsed |
| `[6/embed] ... content unchanged: kept sections/embeddings` | Byte-identical content, embeddings reused |
| `[7/store] ... stored (slug=...)` | Document written to DB |
| `[done] source='...' stored=N skipped=M errors=0` | Source finished — check errors count |
| `FAILED:` | Per-document error — logged with the file path |

### Debug a single stage (local only — don't commit these to .env)

```bash
# bash
INGEST_STOP_AFTER=discover uvicorn main:app --port 8000
INGEST_STOP_AFTER=fetch    uvicorn main:app --port 8000
INGEST_STOP_AFTER=parse    uvicorn main:app --port 8000
INGEST_STOP_AFTER=normalize uvicorn main:app --port 8000
```

```powershell
# PowerShell
$env:INGEST_STOP_AFTER="discover"; uvicorn main:app --port 8000
$env:INGEST_STOP_AFTER="fetch";    uvicorn main:app --port 8000
$env:INGEST_STOP_AFTER="parse";    uvicorn main:app --port 8000
$env:INGEST_STOP_AFTER="normalize"; uvicorn main:app --port 8000

# Clear the var after testing
Remove-Item Env:INGEST_STOP_AFTER
```

Ingestion steps logged as `[1/discover]`, `[2/diff]`, `[3/fetch]`, `[4/parse]`, `[5/normalize]`, `[6/embed]`, `[7/store]` in `logs/aiops.log`.

---

## 4. Schema Changes (New Columns / Tables)

Run this sequence every time `src/database/models.py` changes.

```bash
# bash / PowerShell — identical for alembic commands
alembic revision --autogenerate -m "describe_what_changed"

# Review the generated file in migrations/versions/ before applying.
# Check: is it additive-only? Any DROP TABLE or DROP COLUMN needs manual review.

alembic upgrade head
alembic current

# If dev branch also has new migrations and you're rebasing, merge the heads:
alembic heads
alembic merge heads -m "merge_dev_and_feature_heads"
alembic upgrade head
```

On production, run `alembic upgrade head` **before** deploying the new container image.

---

## 5. Changing the Embedding Model or Dimension

1. Update `SOP_EMBEDDING_MODEL` and `SOP_EMBEDDING_DIM` (if dim changed).
2. If `SOP_EMBEDDING_DIM` changed: write a migration to drop and recreate the `sop_section_embedding.embedding` column with the new dimension (pgvector column type is fixed-width). The HNSW index must be rebuilt too.
3. Re-ingest all documents to regenerate embeddings:
   - Delete existing embeddings: `DELETE FROM sop_section_embedding;`
   - Trigger full re-ingest: `POST /documents/reingest`

**Safe model change (same dim, e.g. `text-embedding-3-small` → different key):** just update the env var and re-ingest. Old embedding rows stay and get a new row per section for the new model name.

---

## 6. Production Deployment (Cloud Run)

### Add or update an env variable

```bash
# bash
gcloud run services update agent-manager-dev \
  --region=us-central1 \
  --update-env-vars KEY=VALUE

# Multiple vars at once
gcloud run services update agent-manager-dev \
  --region=us-central1 \
  --update-env-vars KEY1=VALUE1,KEY2=VALUE2
```

```powershell
# PowerShell
gcloud run services update agent-manager-dev `
  --region=us-central1 `
  --update-env-vars KEY=VALUE
```

### Deploy a new image

```bash
# bash
docker build -t gcr.io/<PROJECT>/<IMAGE>:<TAG> .
docker push gcr.io/<PROJECT>/<IMAGE>:<TAG>

# Deploy (CI usually does this — only run manually if CI is bypassed)
gcloud run deploy agent-manager-dev \
  --image gcr.io/<PROJECT>/<IMAGE>:<TAG> \
  --region=us-central1
```

```powershell
# PowerShell
docker build -t gcr.io/<PROJECT>/<IMAGE>:<TAG> .
docker push gcr.io/<PROJECT>/<IMAGE>:<TAG>

gcloud run deploy agent-manager-dev `
  --image gcr.io/<PROJECT>/<IMAGE>:<TAG> `
  --region=us-central1
```

> **WARNING:** Manual deploy pins a specific image. The next CI deploy will overwrite it.

### Run DB migration against Cloud Run's DB

Option A — Cloud SQL Auth Proxy (recommended):

```bash
# bash
./cloud_sql_proxy --instances=<PROJECT>:<REGION>:<INSTANCE>=tcp:5432 &
MAIN_SERVER_DATABASE_URL=postgresql+psycopg2://user:pass@localhost:5432/dbname \
  alembic upgrade head
```

```powershell
# PowerShell
Start-Process -NoNewWindow cloud_sql_proxy.exe `
  -ArgumentList "--instances=<PROJECT>:<REGION>:<INSTANCE>=tcp:5432"
$env:MAIN_SERVER_DATABASE_URL = "postgresql+psycopg2://user:pass@localhost:5432/dbname"
alembic upgrade head
Remove-Item Env:MAIN_SERVER_DATABASE_URL
```

Option B — Cloud Shell (browser, no local proxy needed):

```bash
# In Cloud Shell terminal
MAIN_SERVER_DATABASE_URL=postgresql+psycopg2://... alembic upgrade head
```

---

## 7. Verify Ingestion Worked

```bash
# bash
curl http://localhost:8000/documents/
curl "http://localhost:8000/documents/search?q=your+known+term&top_k=3"
curl http://localhost:8000/documents/<sop_document_id>/sections

# Production
curl https://agent-manager-dev-yxjhs6bq5a-uc.a.run.app/documents/
curl "https://agent-manager-dev-yxjhs6bq5a-uc.a.run.app/documents/search?q=your+known+term&top_k=3"
```

```powershell
# PowerShell
Invoke-RestMethod "http://localhost:8000/documents/"
Invoke-RestMethod "http://localhost:8000/documents/search?q=your+known+term&top_k=3"
Invoke-RestMethod "http://localhost:8000/documents/<sop_document_id>/sections"

# Production
Invoke-RestMethod "https://agent-manager-dev-yxjhs6bq5a-uc.a.run.app/documents/"
Invoke-RestMethod "https://agent-manager-dev-yxjhs6bq5a-uc.a.run.app/documents/search?q=your+known+term&top_k=3"
```

---

## 8. Checklist: Full Redeployment

Use this when deploying a feature that includes schema changes, new env vars, and code.

```
[ ] Run: alembic upgrade head            (against production DB, before new image)
[ ] Add new env vars to Cloud Run service
[ ] Deploy new container image
[ ] POST /documents/reingest             (if ingestion logic changed or new documents added)
[ ] GET  /documents/ingestion/status     (confirm all docs ingested, no errors)
[ ] GET  /documents/search?q=<test>      (confirm search returns results)
```

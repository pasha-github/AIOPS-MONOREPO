"""Documents management server.

Exposes the SOP ingestion subsystem over REST:
- POST /documents/reingest          — manual (REST) trigger
- GET  /documents/ingestion/status  — current/last run status
- POST/GET/DELETE /documents/ingestion/jobs — manage scheduled ingestion jobs

The router only awaits the ``ingestion_trigger`` singleton and manages
ingestion ``Job`` rows; the manager opens its own DB session for the run itself.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from src import retrieval
from src.database.database import get_session
from src.database.models import Job
from src.ingestion.trigger import ingestion_trigger
from src.ingestion.types import TriggerSource

router = APIRouter(prefix="/documents", tags=["documents"])


class ReingestResponse(BaseModel):
    status: str
    detail: dict | None = None


class IngestionJobCreate(BaseModel):
    cron_expression: str | None = None
    interval_seconds: int | None = None


class IngestionJobResponse(BaseModel):
    job_id: UUID
    job_type: str
    cron_expression: str | None = None
    interval_seconds: int | None = None


# --- Ingestion triggers ---
@router.post("/reingest")
async def reingest(
    blocking: bool = False, sources: str | None = None
) -> ReingestResponse:
    """Manually trigger SOP ingestion. Returns immediately unless ``blocking``.

    ``sources`` is an optional comma-separated allowlist (by source_type or
    source_name, case-insensitive) narrowing which enabled sources run this
    time, e.g. ``?sources=confluence,onedrive``. Omitted = the ``INGEST_SOURCES``
    env allowlist, or all enabled sources if that is unset too.

    On scale-to-zero Cloud Run, call with ``?blocking=true`` (e.g. from Cloud
    Scheduler) so the run executes inside the held request and the instance is
    not killed mid-ingestion.
    """
    selectors = (
        [part for part in sources.split(",") if part.strip()]
        if sources is not None
        else None
    )
    result = await ingestion_trigger.fire(
        TriggerSource.REST, blocking=blocking, selectors=selectors
    )
    return ReingestResponse(status=result.get("status", "unknown"), detail=result)


@router.get("/ingestion/status")
async def ingestion_status() -> dict:
    """Report whether a run is in progress plus the last completed run summary."""
    return ingestion_trigger.status()


# --- Retrieval (read) — id-only; mirrors the DocumentConnector tools ---
@router.get("/search")
def search_documents(q: str, top_k: int = 3) -> dict:
    """Semantic (with keyword fallback) search; returns candidate section ids."""
    results = retrieval.search_sop(q, top_k=top_k)
    return {"query": q, "count": len(results), "results": results}


@router.get("/")
def list_documents() -> dict:
    """List all ingested SOP documents."""
    docs = retrieval.list_documents()
    return {"count": len(docs), "documents": docs}


@router.get("/{sop_document_id}/sections")
def list_document_sections(sop_document_id: str) -> dict:
    """List a document's sections by id (titles + element refs, no text)."""
    sections = retrieval.list_sop_sections(sop_document_id)
    return {"sop_document_id": sop_document_id, "sections": sections}


@router.get("/{sop_document_id}/sections/{sop_section_id}")
def get_document_section(
    sop_document_id: str, sop_section_id: str, element_ids: str | None = None
) -> dict:
    """Fetch a whole section (markdown + ordered elements). `element_ids` is an
    optional comma-separated filter."""
    ids = [e for e in element_ids.split(",") if e] if element_ids else None
    section = retrieval.get_sop_section(sop_section_id, element_ids=ids)
    if section is None:
        raise HTTPException(status_code=404, detail="Section not found")
    return section


# --- Scheduled ingestion jobs ---
@router.post("/ingestion/jobs", response_model=IngestionJobResponse)
async def create_ingestion_job(
    job: IngestionJobCreate, session: Session = Depends(get_session)
):
    if not job.cron_expression and not job.interval_seconds:
        raise HTTPException(
            status_code=400,
            detail="Either cron_expression or interval_seconds must be provided",
        )

    from src.utils.scheduler import build_job_trigger

    try:
        build_job_trigger(
            Job(
                job_type="ingestion",
                cron_expression=job.cron_expression,
                interval_seconds=job.interval_seconds,
            )
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    db_job = Job(
        job_type="ingestion",
        cron_expression=job.cron_expression,
        interval_seconds=job.interval_seconds,
    )
    session.add(db_job)
    session.commit()
    session.refresh(db_job)

    from src.utils.scheduler import reload_jobs

    await reload_jobs()

    return db_job


@router.get("/ingestion/jobs", response_model=list[IngestionJobResponse])
def list_ingestion_jobs(session: Session = Depends(get_session)):
    jobs = session.exec(select(Job).where(Job.job_type == "ingestion")).all()
    return jobs


@router.delete("/ingestion/jobs/{job_id}")
async def delete_ingestion_job(job_id: UUID, session: Session = Depends(get_session)):
    job = session.get(Job, job_id)
    if not job or job.job_type != "ingestion":
        raise HTTPException(status_code=404, detail="Ingestion job not found")

    session.delete(job)
    session.commit()

    from src.utils.scheduler import reload_jobs

    await reload_jobs()

    return {"status": "deleted", "job_id": str(job_id)}

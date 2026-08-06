import logging
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from sqlmodel import Session, select

from src.database.database import get_session
from src.database.models import Agent, AgentFile

router = APIRouter(prefix="/agent", tags=["agent-files"])

logger = logging.getLogger(__name__)

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/csv",
    "application/zip",
    "text/html",
}

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".csv", ".zip", ".html"}

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


class AgentFileResponse(BaseModel):
    id: UUID
    filename: str
    content_type: str
    size: int
    created_at: datetime


@router.post("/files", response_model=AgentFileResponse)
async def upload_file(
    file: UploadFile, session: Session = Depends(get_session)
) -> AgentFileResponse:
    filename = file.filename or ""
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{ext}' not allowed. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400, detail="File exceeds maximum size of 50MB."
        )

    content_type = file.content_type or "application/octet-stream"

    agent_file = AgentFile(
        filename=filename,
        content_type=content_type,
        size=len(content),
        content=content,
    )

    session.add(agent_file)
    session.commit()
    session.refresh(agent_file)

    logger.info(
        "File uploaded: id=%s filename=%s size=%s",
        agent_file.id,
        filename,
        len(content),
    )

    return AgentFileResponse(
        id=agent_file.id,
        filename=agent_file.filename,
        content_type=agent_file.content_type,
        size=agent_file.size,
        created_at=agent_file.created_at,
    )


@router.get("/{agent_id}/files", response_model=list[AgentFileResponse])
def list_files(
    agent_id: str, session: Session = Depends(get_session)
) -> list[AgentFileResponse]:
    agent = session.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found.")

    file_ids = agent.knowledge_file_ids or []
    if not file_ids:
        return []

    uuid_ids = [UUID(fid) for fid in file_ids]
    files = session.exec(
        select(AgentFile).where(AgentFile.id.in_(uuid_ids))  # type: ignore[attr-defined]
    ).all()

    return [
        AgentFileResponse(
            id=f.id,
            filename=f.filename,
            content_type=f.content_type,
            size=f.size,
            created_at=f.created_at,
        )
        for f in files
    ]


@router.get("/files/{file_id}")
def download_file(file_id: UUID, session: Session = Depends(get_session)) -> Response:
    agent_file = session.get(AgentFile, file_id)
    if not agent_file:
        raise HTTPException(status_code=404, detail="File not found.")

    return Response(
        content=agent_file.content,
        media_type=agent_file.content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{agent_file.filename}"'
        },
    )


@router.delete("/files/{file_id}", status_code=204)
def delete_file(file_id: UUID, session: Session = Depends(get_session)) -> None:
    agent_file = session.get(AgentFile, file_id)
    if not agent_file:
        raise HTTPException(status_code=404, detail="File not found.")

    # Remove file ID from any agent that references it
    agents = session.exec(select(Agent)).all()
    for agent in agents:
        file_ids = agent.knowledge_file_ids or []
        if str(file_id) in file_ids:
            agent.knowledge_file_ids = [fid for fid in file_ids if fid != str(file_id)]
            session.add(agent)

    session.delete(agent_file)
    session.commit()

    logger.info("File deleted: id=%s", file_id)

import contextlib
import io
import json
import re
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import UUID

import yaml
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from src.database.database import get_session
from src.database.models import Skill
from src.skills.runtime import (
    agent_ids_using_skill,
    invalidate_agents_using_skill,
    validate_connector_config_ids,
    validate_mcp_server_ids,
    validate_skill_name,
    validate_skill_tool_names,
)

router = APIRouter(prefix="/skill", tags=["skill"])


class SkillCreate(BaseModel):
    name: str
    description: str
    instructions: str
    tools: list[str] = Field(default_factory=list)
    references: dict[str, str] = Field(default_factory=dict)
    assets: dict[str, str] = Field(default_factory=dict)
    scripts: dict[str, str] = Field(default_factory=dict)
    connector_config_ids: list[str] = Field(default_factory=list)
    mcp_server_ids: list[str] = Field(default_factory=list)


class SkillPatch(BaseModel):
    name: str | None = None
    description: str | None = None
    instructions: str | None = None
    tools: list[str] | None = None
    references: dict[str, str] | None = None
    assets: dict[str, str] | None = None
    scripts: dict[str, str] | None = None
    connector_config_ids: list[str] | None = None
    mcp_server_ids: list[str] | None = None


class OrchestrateSkillCreate(BaseModel):
    prompt: str


class OrchestrateSkillUpdate(BaseModel):
    prompt: str
    current_config: dict


class OrchestrateSkillResponse(BaseModel):
    name: str | None = None
    description: str | None = None
    instructions: str | None = None
    tools: list[str] = []
    connector_config_ids: list[str] = []
    mcp_server_ids: list[str] = []


def _validate_skill_payload(
    session: Session,
    payload: dict[str, Any],
    *,
    existing_skill_id: UUID | None = None,
):
    name = payload.get("name")
    if name is not None:
        validate_skill_name(name)
        statement = select(Skill).where(Skill.name == name)
        existing_skill = session.exec(statement).first()
        if existing_skill and existing_skill.skill_id != existing_skill_id:
            raise HTTPException(status_code=409, detail="Skill name already exists")

    validate_connector_config_ids(session, payload.get("connector_config_ids"))
    validate_mcp_server_ids(session, payload.get("mcp_server_ids"))
    validate_skill_tool_names(
        session,
        connector_config_ids=payload.get("connector_config_ids"),
        mcp_server_ids=payload.get("mcp_server_ids"),
        tool_names=payload.get("tools"),
    )


@router.post("/", response_model=Skill)
def create_skill(payload: SkillCreate, session: Session = Depends(get_session)):
    skill_data = payload.model_dump()
    _validate_skill_payload(session, skill_data)

    db_skill = Skill.model_validate(skill_data)
    session.add(db_skill)
    session.commit()
    session.refresh(db_skill)
    return db_skill


@router.get("/", response_model=list[Skill])
def list_skills(session: Session = Depends(get_session)):
    return session.exec(select(Skill)).all()


@router.post("/orchestrate", response_model=OrchestrateSkillResponse)
async def orchestrate_skill_create(
    body: OrchestrateSkillCreate,
    session: Session = Depends(get_session),
):
    from src.agent_runtime.adk.orchestrator import (
        SKILL_CREATE_INSTRUCTION,
        build_connector_context,
        run_skill_orchestrator,
    )

    connector_ctx = build_connector_context(session)
    full_prompt = f"{connector_ctx}\n\nUser request: {body.prompt}"
    result = await run_skill_orchestrator(
        SKILL_CREATE_INSTRUCTION, full_prompt, session
    )
    if not result:
        raise HTTPException(
            status_code=500, detail="Skill orchestrator returned no result"
        )
    return OrchestrateSkillResponse.model_validate(result)


@router.patch("/orchestrate", response_model=OrchestrateSkillResponse)
async def orchestrate_skill_update(
    body: OrchestrateSkillUpdate,
    session: Session = Depends(get_session),
):
    from src.agent_runtime.adk.orchestrator import (
        SKILL_PATCH_INSTRUCTION,
        build_connector_context,
        run_skill_orchestrator,
    )

    connector_ctx = build_connector_context(session)
    current = json.dumps(body.current_config)
    full_prompt = f"{connector_ctx}\n\nCurrent skill configuration:\n{current}\n\nUser request: {body.prompt}"
    result = await run_skill_orchestrator(
        SKILL_PATCH_INSTRUCTION, full_prompt, session, patch=True
    )
    if not result:
        raise HTTPException(
            status_code=500, detail="Skill orchestrator returned no result"
        )
    return OrchestrateSkillResponse.model_validate(result)


@router.get("/{skill_id}", response_model=Skill)
def get_skill(skill_id: UUID, session: Session = Depends(get_session)):
    skill = session.get(Skill, skill_id)
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill


@router.patch("/{skill_id}", response_model=Skill)
def update_skill(
    skill_id: UUID,
    payload: SkillPatch,
    session: Session = Depends(get_session),
):
    skill = session.get(Skill, skill_id)
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")

    updates = payload.model_dump(exclude_unset=True)
    merged = skill.model_dump()
    merged.update(updates)
    _validate_skill_payload(session, merged, existing_skill_id=skill_id)

    for field, value in updates.items():
        setattr(skill, field, value)
    skill.updated_at = datetime.now()

    session.add(skill)
    session.commit()
    session.refresh(skill)

    invalidate_agents_using_skill(session, str(skill.skill_id))
    return skill


@router.delete("/{skill_id}")
def delete_skill(skill_id: UUID, session: Session = Depends(get_session)):
    skill = session.get(Skill, skill_id)
    if skill is None:
        raise HTTPException(status_code=404, detail="Skill not found")

    attached_agent_ids = agent_ids_using_skill(session, str(skill_id))
    if attached_agent_ids:
        raise HTTPException(
            status_code=409,
            detail="Skill is in use by one or more agents",
        )

    session.delete(skill)
    session.commit()
    return {"success": True}


# ---------------------------------------------------------------------------
# Skill upload (zip or folder-as-zip)
# ---------------------------------------------------------------------------
# Expected zip layout (files may be at the zip root or inside one top-level
# folder — both are accepted):
#
#   skill.md          ← required; YAML frontmatter + instructions body
#   references/       ← optional; any text/markdown files
#   assets/           ← optional; any files (code, data, …)
#   scripts/          ← optional; Python (.py) files
#
# skill.md frontmatter example:
#   ---
#   name: my-skill-name        # kebab-case or snake_case, must be unique
#   description: Short blurb
#   tools:                     # optional list of connector/MCP tool names
#     - some_tool
#   ---
#   Instructions go here …
# ---------------------------------------------------------------------------

_FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n?(.*)", re.DOTALL)
_SAFE_FILENAME_RE = re.compile(r"[^\w.\-]")


def _parse_skill_md(content: str) -> tuple[dict, str]:
    """Return (frontmatter_dict, instructions_body)."""
    match = _FRONTMATTER_RE.match(content)
    if not match:
        raise HTTPException(
            status_code=422,
            detail="skill.md must start with a YAML frontmatter block (--- … ---)",
        )
    try:
        meta = yaml.safe_load(match.group(1)) or {}
    except yaml.YAMLError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid YAML frontmatter in skill.md: {exc}",
        ) from exc
    return meta, match.group(2).strip()


def _safe_name(filename: str) -> str:
    """Sanitise a bare filename (preserving extension) for use as a dict key."""
    name = Path(filename).name
    return _SAFE_FILENAME_RE.sub("_", name)


def _find_entry(directory: Path, name: str, *, want_dir: bool) -> Path | None:
    """Case-insensitive lookup of an entry directly inside *directory*.

    NTFS (Windows) is case-insensitive, but Linux filesystems (used by most
    Docker images) are case-sensitive. A zip authored/tested on Windows with
    e.g. "Skill.md" or "References/" will resolve locally but silently fail
    to be found once the exact same zip is uploaded to a Linux container.
    """
    target = name.lower()
    for entry in directory.iterdir():
        if entry.name.lower() != target:
            continue
        if entry.is_dir() if want_dir else entry.is_file():
            return entry
    return None


def _read_dir_files(root: Path, subdir: str) -> dict[str, str]:
    """Return {filename: text_content} for every file inside root/subdir."""
    result: dict[str, str] = {}
    target = _find_entry(root, subdir, want_dir=True)
    if target is None:
        return result
    for path in sorted(target.iterdir()):
        if path.is_file():
            with contextlib.suppress(UnicodeDecodeError):
                result[_safe_name(path.name)] = path.read_text(encoding="utf-8")
    return result


def _extract_zip(data: bytes) -> Path:
    """Extract zip bytes into a temp directory and return its Path."""
    if not zipfile.is_zipfile(io.BytesIO(data)):
        raise HTTPException(
            status_code=422, detail="Uploaded file is not a valid zip archive"
        )
    tmp = Path(tempfile.mkdtemp())
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        for info in zf.infolist():
            # Some Windows zip tools store entries with backslash separators
            # instead of the ZIP-spec forward slash. zipfile.extractall() only
            # treats "/" as a directory separator, so on Linux an entry like
            # "my-skill\skill.md" would be extracted as a single literal
            # filename instead of nested directories. Normalise first so
            # extraction behaves the same on every OS.
            normalized = info.filename.replace("\\", "/")
            if ".." in normalized or normalized.startswith("/"):
                raise HTTPException(
                    status_code=422, detail=f"Unsafe path in zip: {info.filename}"
                )
            info.filename = normalized
            zf.extract(info, tmp)
    return tmp


def _find_skill_md(extracted: Path) -> Path:
    """
    Locate skill.md within the extracted zip (case-insensitive).
    Accepts skill.md at the zip root or one level deep inside a folder.
    """
    direct = _find_entry(extracted, "skill.md", want_dir=False)
    if direct is not None:
        return direct
    # One level deep
    for child in sorted(extracted.iterdir()):
        if child.is_dir():
            nested = _find_entry(child, "skill.md", want_dir=False)
            if nested is not None:
                return nested
    raise HTTPException(
        status_code=422,
        detail="skill.md not found. Place it at the root of the zip or inside a single top-level folder.",
    )


@router.post("/upload", response_model=Skill)
async def upload_skill(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    """
    Upload a skill as a zip file.

    The zip must contain a ``skill.md`` file with YAML frontmatter
    (``name``, ``description``, optional ``tools`` list) followed by the
    skill instructions.  Optional subdirectories ``references/``,
    ``assets/``, and ``scripts/`` are read and stored verbatim.
    """
    if not (file.filename or "").lower().endswith(".zip"):
        raise HTTPException(status_code=422, detail="Only .zip files are accepted")

    data = await file.read()
    extracted = _extract_zip(data)

    try:
        skill_md_path = _find_skill_md(extracted)
        skill_root = skill_md_path.parent

        meta, instructions = _parse_skill_md(skill_md_path.read_text(encoding="utf-8"))

        name = str(meta.get("name", "")).strip()
        description = str(meta.get("description", "")).strip()
        tools: list[str] = [str(t) for t in (meta.get("tools") or [])]

        if not name:
            raise HTTPException(
                status_code=422, detail="skill.md frontmatter must include 'name'"
            )
        if not description:
            raise HTTPException(
                status_code=422,
                detail="skill.md frontmatter must include 'description'",
            )
        if not instructions:
            raise HTTPException(
                status_code=422,
                detail="skill.md must have instructions content after the frontmatter",
            )

        validate_skill_name(name)

        existing = session.exec(select(Skill).where(Skill.name == name)).first()
        if existing:
            raise HTTPException(
                status_code=409, detail=f"A skill named '{name}' already exists"
            )

        references = _read_dir_files(skill_root, "references")
        assets = _read_dir_files(skill_root, "assets")
        scripts = _read_dir_files(skill_root, "scripts")

        db_skill = Skill(
            name=name,
            description=description,
            instructions=instructions,
            tools=tools,
            references=references,
            assets=assets,
            scripts=scripts,
        )
        session.add(db_skill)
        session.commit()
        session.refresh(db_skill)
        return db_skill

    finally:
        # Clean up temp directory
        import shutil

        shutil.rmtree(extracted, ignore_errors=True)

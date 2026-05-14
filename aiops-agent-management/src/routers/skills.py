from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
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

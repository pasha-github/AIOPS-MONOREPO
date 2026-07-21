from datetime import datetime
from typing import Any, cast

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_
from sqlmodel import Session, select

from src.agent_runtime.service import (
    enqueue_agent_runtime_reconcile,
    mark_agent_runtime_pending,
)
from src.database.database import get_session
from src.database.models import Agent, Model, ModelDefaults
from src.utils.secrets import encrypt_secret

router = APIRouter(prefix="/llms", tags=["llms"])


def _global_slot_condition():
    return or_(
        cast(Any, Agent.primary_use_global).is_(True),
        cast(Any, Agent.secondary_use_global).is_(True),
        cast(Any, Agent.tertiary_use_global).is_(True),
    )


def _agent_model_link_condition(model_id: str):
    return or_(
        cast(Any, Agent.primary_model_id) == model_id,
        cast(Any, Agent.secondary_model_id) == model_id,
        cast(Any, Agent.tertiary_model_id) == model_id,
    )


class ModelCreate(BaseModel):
    model_id: str
    provider: str
    name: str
    description: str | None = None
    api_key: str
    extra_config: dict | None = None


class ModelRead(BaseModel):
    model_id: str
    provider: str
    name: str
    created_at: datetime
    description: str | None
    extra_config: dict | None = None
    # Exclude api_key


class ModelUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    api_key: str | None = None
    extra_config: dict | None = None


class ModelDefaultsRead(BaseModel):
    id: int
    primary_model_id: str | None = None
    secondary_model_id: str | None = None
    tertiary_model_id: str | None = None


class ModelDefaultsUpdate(BaseModel):
    primary_model_id: str | None = None
    secondary_model_id: str | None = None
    tertiary_model_id: str | None = None


def _get_or_create_model_defaults(session: Session) -> ModelDefaults:
    defaults = session.get(ModelDefaults, 1)
    if defaults is None:
        defaults = ModelDefaults()
        session.add(defaults)
        session.commit()
        session.refresh(defaults)
    return defaults


def _invalidate_global_agents(session: Session, background_tasks: BackgroundTasks):
    agents = list(session.exec(select(Agent).where(_global_slot_condition())).all())
    for agent in agents:
        mark_agent_runtime_pending(agent)
        session.add(agent)
    session.commit()
    for agent in agents:
        enqueue_agent_runtime_reconcile(background_tasks, agent_id=agent.agent_id)


@router.post("/", response_model=ModelRead)
def create_model(model: ModelCreate, session: Session = Depends(get_session)):
    if session.get(Model, model.model_id):
        raise HTTPException(status_code=409, detail="Model already exists")

    model_data = model.model_dump()
    model_data["api_key"] = encrypt_secret(model.api_key)
    db_model = Model.model_validate(model_data)
    session.add(db_model)
    session.commit()
    session.refresh(db_model)
    return db_model


@router.get("/", response_model=list[ModelRead])
def list_models(session: Session = Depends(get_session)):
    models = session.exec(select(Model)).all()
    return models


@router.get("/defaults", response_model=ModelDefaultsRead)
def get_model_defaults(session: Session = Depends(get_session)):
    return _get_or_create_model_defaults(session)


@router.patch("/defaults", response_model=ModelDefaultsRead)
def update_model_defaults(
    defaults_update: ModelDefaultsUpdate,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    defaults = _get_or_create_model_defaults(session)
    update_data = defaults_update.model_dump(exclude_unset=True)
    for field_name, model_id in update_data.items():
        if model_id is not None and session.get(Model, model_id) is None:
            raise HTTPException(status_code=400, detail=f"Invalid {field_name}")
        setattr(defaults, field_name, model_id)

    session.add(defaults)
    session.commit()
    session.refresh(defaults)
    _invalidate_global_agents(session, background_tasks)
    return defaults


@router.patch("/{model_id}", response_model=ModelRead)
def update_model(
    model_id: str,
    model_update: ModelUpdate,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    model = session.get(Model, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    update_data = model_update.model_dump(exclude_unset=True)
    if "name" in update_data:
        if update_data["name"] is None or not update_data["name"].strip():
            raise HTTPException(status_code=400, detail="name cannot be empty")
        model.name = update_data["name"]
    if "description" in update_data:
        if (
            isinstance(update_data["description"], str)
            and not update_data["description"].strip()
        ):
            raise HTTPException(status_code=400, detail="description cannot be empty")
        model.description = update_data["description"]
    if "api_key" in update_data:
        if update_data["api_key"] is None or not update_data["api_key"].strip():
            raise HTTPException(status_code=400, detail="api_key cannot be empty")
        model.api_key = encrypt_secret(update_data["api_key"])
    if "extra_config" in update_data:
        model.extra_config = update_data["extra_config"]

    session.add(model)
    session.commit()
    session.refresh(model)

    agent_ids = list(
        session.exec(
            select(Agent.agent_id).where(_agent_model_link_condition(model_id))
        ).all()
    )
    defaults = _get_or_create_model_defaults(session)
    if model_id in {
        defaults.primary_model_id,
        defaults.secondary_model_id,
        defaults.tertiary_model_id,
    }:
        agent_ids.extend(
            list(
                session.exec(
                    select(Agent.agent_id).where(_global_slot_condition())
                ).all()
            )
        )
    for agent_id in set(agent_ids):
        agent = session.get(Agent, agent_id)
        if agent is not None:
            mark_agent_runtime_pending(agent)
            session.add(agent)
    session.commit()
    for agent_id in set(agent_ids):
        enqueue_agent_runtime_reconcile(background_tasks, agent_id=agent_id)

    return model


@router.delete("/{model_id}")
def delete_model(model_id: str, session: Session = Depends(get_session)):
    model = session.get(Model, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    defaults = _get_or_create_model_defaults(session)
    linked_agents = list(
        session.exec(
            select(Agent.agent_id).where(_agent_model_link_condition(model_id))
        ).all()
    )
    used_in_defaults = model_id in {
        defaults.primary_model_id,
        defaults.secondary_model_id,
        defaults.tertiary_model_id,
    }
    if linked_agents or used_in_defaults:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Model is in use by agents",
                "agent_ids": sorted(linked_agents),
                "used_in_defaults": used_in_defaults,
            },
        )

    session.delete(model)
    session.commit()
    return {"ok": True}

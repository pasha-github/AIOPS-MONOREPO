from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from src.agent_runtime.adk.adk_app import invalidate_cache
from src.database.database import get_session
from src.database.models import Agent, Model
from src.utils.secrets import encrypt_secret

router = APIRouter(prefix="/llms", tags=["llms"])


class ModelCreate(BaseModel):
    model_id: str
    provider: str
    name: str
    description: str | None
    api_key: str


class ModelRead(BaseModel):
    model_id: str
    provider: str
    name: str
    created_at: datetime
    description: str | None
    # Exclude api_key


class ModelUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    api_key: str | None = None


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


@router.patch("/{model_id}", response_model=ModelRead)
def update_model(
    model_id: str, model_update: ModelUpdate, session: Session = Depends(get_session)
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

    session.add(model)
    session.commit()
    session.refresh(model)

    agent_ids = session.exec(
        select(Agent.agent_id).where(Agent.model_id == model_id)
    ).all()
    for agent_id in agent_ids:
        invalidate_cache(agent_id)

    return model


@router.delete("/{model_id}")
def delete_model(model_id: str, session: Session = Depends(get_session)):
    model = session.get(Model, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    linked_agents = session.exec(
        select(Agent.agent_id).where(Agent.model_id == model_id)
    ).all()
    if linked_agents:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Model is in use by agents",
                "agent_ids": sorted(linked_agents),
            },
        )

    session.delete(model)
    session.commit()
    return {"ok": True}

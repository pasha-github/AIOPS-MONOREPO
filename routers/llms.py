from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from database.database import get_session
from database.models import Agent, Model
from typing import List, Optional
from pydantic import BaseModel
from utils.secrets import encrypt_secret
from utils.adk_app import invalidate_cache
from datetime import datetime
from sqlalchemy.exc import IntegrityError

router = APIRouter(prefix="/llms", tags=["llms"])

class ModelCreate(BaseModel):
    model_id: str
    provider: str
    name: str
    description: Optional[str]
    api_key: str

class ModelRead(BaseModel):
    model_id: str
    provider: str
    name: str
    created_at: datetime
    description: Optional[str]
    # Exclude api_key

class ModelUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    api_key: Optional[str] = None

@router.post("/", response_model=ModelRead)
def create_model(model: ModelCreate, session: Session = Depends(get_session)):
    model_data = model.model_dump()
    model_data["api_key"] = encrypt_secret(model.api_key)
    db_model = Model.model_validate(model_data)
    session.add(db_model)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail="Model already exists")
    session.refresh(db_model)
    return db_model

@router.get("/", response_model=List[ModelRead])
def list_models(session: Session = Depends(get_session)):
    models = session.exec(select(Model)).all()
    return models

@router.patch("/{model_id}", response_model=ModelRead)
def update_model(model_id: str, model_update: ModelUpdate, session: Session = Depends(get_session)):
    model = session.get(Model, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    update_data = model_update.model_dump(exclude_unset=True)
    if "name" in update_data:
        model.name = update_data["name"]
    if "description" in update_data:
        model.description = update_data["description"]
    if "api_key" in update_data and update_data["api_key"] is not None:
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
    session.delete(model)
    session.commit()
    return {"ok": True}

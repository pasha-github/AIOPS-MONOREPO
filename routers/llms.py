from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from database.database import get_session
from database.models import Model
from typing import List, Optional
from pydantic import BaseModel
from utils.secrets import encrypt_secret
from datetime import datetime

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

@router.post("/", response_model=ModelRead)
def create_model(model: ModelCreate, session: Session = Depends(get_session)):
    model_data = model.model_dump()
    model_data["api_key"] = encrypt_secret(model.api_key)
    db_model = Model.model_validate(model_data)
    session.add(db_model)
    session.commit()
    session.refresh(db_model)
    return db_model

@router.get("/", response_model=List[ModelRead])
def list_models(session: Session = Depends(get_session)):
    models = session.exec(select(Model)).all()
    return models

@router.delete("/{model_id}")
def delete_model(model_id: str, session: Session = Depends(get_session)):
    model = session.get(Model, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    session.delete(model)
    session.commit()
    return {"ok": True}

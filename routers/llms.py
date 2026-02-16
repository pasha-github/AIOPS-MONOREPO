from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from database import get_session
from models import Model
from typing import List
from pydantic import BaseModel

router = APIRouter(prefix="/llms", tags=["llms"])

class ModelCreate(BaseModel):
    model_id: str
    provider: str
    name: str
    api_key: str

class ModelRead(BaseModel):
    model_id: str
    provider: str
    name: str
    # Exclude api_key

@router.post("/", response_model=ModelRead)
def create_model(model: ModelCreate, session: Session = Depends(get_session)):
    db_model = Model.model_validate(model)
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

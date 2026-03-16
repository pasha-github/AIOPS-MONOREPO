from fastapi import APIRouter, Depends
import os
from typing import List, Dict, Any
from fastapi import HTTPException
from utils.helper import cached_connector_info
from sqlmodel import Session, select
from database.database import get_session
from database.models import ConnectorConfig
from pydantic import BaseModel

class ConnectorConfigCreate(BaseModel):
    connector_id: str
    name: str
    config: List[Dict[str, Any]]

router = APIRouter(prefix="/connectors", tags=["connectors"])

@router.get("/", response_model=List[Dict[str, str]])
def list_connectors():
    connectors = []
    connectors_dir = "connectors"
    if os.path.exists(connectors_dir):
        for filename in os.listdir(connectors_dir):
            if filename in {"base_connector.py", "__init__.py", "example_connector.py"}:
                continue
            if filename.endswith("_connector.py"):
                # Take prefix before _connector.py and making it capital case
                name = filename.split("_connector.py")[0].replace("_", " ").title()
                connectors.append({
                    "id": filename.strip(".py"),
                    "name": name
                })
    return connectors


@router.get("/{connector_id}")
def get_connector_details(connector_id: str) -> Dict[str, Any]:
    # Block reserved files
    if connector_id in ["__init__", "base_connector"]:
        raise HTTPException(status_code=404, detail="Connector not found")

    connectors_dir = "connectors"
    file_path = os.path.join(connectors_dir, f"{connector_id}.py")

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Connector not found")

    with open(file_path, "r", encoding="utf-8") as f:
        source = f.read()

    return cached_connector_info(source, os.path.getmtime(file_path))


@router.get("/{connector_id}/config")
def get_connector_config(connector_id: str, session: Session = Depends(get_session)) -> List[ConnectorConfig]:
    db_connector_config = session.exec(select(ConnectorConfig).where(ConnectorConfig.connector_id == connector_id)).all()
    return db_connector_config

@router.post("/{connector_id}/config")
def set_connector_config(connector_id: str, connector_config: ConnectorConfigCreate, session: Session = Depends(get_session)) -> ConnectorConfig:
    if connector_id != connector_config.connector_id:
        raise HTTPException(status_code=400, detail="connector_id in URL and body must match")

    if connector_id in {"__init__", "base_connector"}:
        raise HTTPException(status_code=404, detail="Connector not found")

    connector_file = os.path.join("connectors", f"{connector_id}.py")
    if not os.path.exists(connector_file):
        raise HTTPException(status_code=404, detail="Connector not found")

    db = ConnectorConfig.model_validate(connector_config)
    session.add(db)
    session.commit()
    session.refresh(db)
    return db






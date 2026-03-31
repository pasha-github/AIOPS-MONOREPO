from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends
import os
from typing import List, Dict, Any, Optional
from fastapi import HTTPException
from utils.helper import cached_connector_info
from sqlmodel import Session, select
from database.database import get_session
from database.models import Agent, ConnectorConfig
from pydantic import BaseModel
from utils.adk_app import invalidate_cache

class ConnectorConfigCreate(BaseModel):
    connector_id: str
    name: str
    config: List[Dict[str, Any]]


class ConnectorConfigPatch(BaseModel):
    name: Optional[str] = None
    config: Optional[List[Dict[str, Any]]] = None

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
                name = {"ibm_mq_connector.py": "IBM MQ"}.get(filename, name)
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


@router.patch("/{connector_id}/config/{connector_config_id}")
def patch_connector_config(
    connector_id: str,
    connector_config_id: UUID,
    connector_config: ConnectorConfigPatch,
    session: Session = Depends(get_session),
) -> ConnectorConfig:
    db_connector_config = session.get(ConnectorConfig, connector_config_id)
    if db_connector_config is None:
        raise HTTPException(status_code=404, detail="Connector config not found")
    if db_connector_config.connector_id != connector_id:
        raise HTTPException(status_code=404, detail="Connector config not found")
    connector_config_id_str = str(connector_config_id)
    affected_agent_ids = [
        agent.agent_id
        for agent in session.exec(select(Agent)).all()
        if connector_config_id_str in (agent.connector_config_ids or [])
    ]

    updates = connector_config.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(db_connector_config, field, value)
    db_connector_config.updated_at = datetime.now()

    session.add(db_connector_config)
    session.commit()
    session.refresh(db_connector_config)

    for agent_id in affected_agent_ids:
        invalidate_cache(agent_id)

    return db_connector_config


@router.delete("/{connector_id}/config/{connector_config_id}")
def delete_connector_config(
    connector_id: str,
    connector_config_id: UUID,
    session: Session = Depends(get_session),
) -> Dict[str, bool]:
    db_connector_config = session.get(ConnectorConfig, connector_config_id)
    if db_connector_config is None:
        raise HTTPException(status_code=404, detail="Connector config not found")
    if db_connector_config.connector_id != connector_id:
        raise HTTPException(status_code=404, detail="Connector config not found")

    connector_config_id_str = str(connector_config_id)
    agents_using_config = session.exec(select(Agent)).all()
    agent_names = [
        agent.name
        for agent in agents_using_config
        if connector_config_id_str in (agent.connector_config_ids or [])
    ]
    if agent_names:
        raise HTTPException(
            status_code=409,
            detail=f"Connector config is in use by agent: {', '.join(agent_names)}",
        )

    session.delete(db_connector_config)
    session.commit()
    return {"success": True}






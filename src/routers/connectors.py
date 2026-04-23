from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from src.agent_runtime.adk.adk_app import invalidate_cache
from src.connectors.loader import (
    get_connector_dir,
    load_connector_info,
    load_connector_metadata,
)
from src.database.database import get_session
from src.database.models import Agent, ConnectorConfig


class ConnectorConfigCreate(BaseModel):
    connector_id: str
    name: str
    config: list[dict[str, Any]]


class ConnectorConfigPatch(BaseModel):
    name: str | None = None
    config: list[dict[str, Any]] | None = None


router = APIRouter(prefix="/connectors", tags=["connectors"])


@router.get("/", response_model=list[dict[str, str]])
def list_connectors():
    connectors = []
    connectors_dir = Path("src/connectors")
    if connectors_dir.exists():
        for path_obj in connectors_dir.iterdir():
            if not path_obj.is_dir():
                continue
            connector_id = path_obj.name
            if connector_id in {"__pycache__", "example_connector"}:
                continue
            metadata_path = path_obj / "metadata.json"
            if not metadata_path.exists():
                continue
            metadata = load_connector_metadata(connector_id)
            connectors.append(
                {"id": connector_id, "name": metadata.get("name", connector_id)}
            )
    return connectors


@router.get("/{connector_id}")
def get_connector_details(connector_id: str) -> dict[str, Any]:
    # Block reserved files
    if connector_id in ["__init__", "base_connector"]:
        raise HTTPException(status_code=404, detail="Connector not found")

    connector_dir = get_connector_dir(connector_id)
    if not connector_dir.exists():
        raise HTTPException(status_code=404, detail="Connector not found")
    try:
        return load_connector_info(connector_id)
    except FileNotFoundError as err:
        raise HTTPException(status_code=404, detail="Connector not found") from err


@router.get("/{connector_id}/config")
def get_connector_config(
    connector_id: str, session: Session = Depends(get_session)
) -> list[ConnectorConfig]:
    db_connector_config = session.exec(
        select(ConnectorConfig).where(ConnectorConfig.connector_id == connector_id)
    ).all()
    return list(db_connector_config)


@router.post("/{connector_id}/config")
def set_connector_config(
    connector_id: str,
    connector_config: ConnectorConfigCreate,
    session: Session = Depends(get_session),
) -> ConnectorConfig:
    if connector_id != connector_config.connector_id:
        raise HTTPException(
            status_code=400, detail="connector_id in URL and body must match"
        )

    if connector_id in {"__init__", "base_connector"}:
        raise HTTPException(status_code=404, detail="Connector not found")

    connector_dir = get_connector_dir(connector_id)
    if not connector_dir.exists():
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
) -> dict[str, bool]:
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

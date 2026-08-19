import json
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from src.agent_runtime.service import (
    enqueue_agent_runtime_reconcile,
    mark_agent_runtime_pending,
)
from src.connectors.loader import CONNECTORS_DIR, get_connector_dir, load_connector_info
from src.database.database import get_session
from src.database.models import Agent, ConnectorConfig, Skill


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
    if CONNECTORS_DIR.exists():
        for path_obj in CONNECTORS_DIR.iterdir():
            dirname = path_obj.name
            if not path_obj.is_dir():
                continue
            if dirname in {"example_connector", "__pycache__"} or dirname.startswith(
                "__"
            ):
                continue
            if dirname.endswith("_connector") and (path_obj / "connector.py").exists():
                metadata_path = path_obj / "metadata.json"
                if not metadata_path.exists():
                    continue
                try:
                    with metadata_path.open(encoding="utf-8") as f:
                        meta = json.load(f)
                except (json.JSONDecodeError, OSError):
                    continue
                name = meta.get("name", dirname)
                category = meta.get("category", "enterprise")
                connectors.append({"id": dirname, "name": name, "category": category})
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

    connector_file = CONNECTORS_DIR / connector_id / "connector.py"
    if not connector_file.exists():
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
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
) -> ConnectorConfig:
    db_connector_config = session.get(ConnectorConfig, connector_config_id)
    if db_connector_config is None:
        raise HTTPException(status_code=404, detail="Connector config not found")
    if db_connector_config.connector_id != connector_id:
        raise HTTPException(status_code=404, detail="Connector config not found")
    connector_config_id_str = str(connector_config_id)
    matching_skill_ids = {
        str(skill.skill_id)
        for skill in session.exec(select(Skill)).all()
        if connector_config_id_str in (skill.connector_config_ids or [])
    }
    affected_agents = [
        agent
        for agent in session.exec(select(Agent)).all()
        if connector_config_id_str in (agent.connector_config_ids or [])
        or any(skill_id in matching_skill_ids for skill_id in (agent.skill_ids or []))
    ]

    updates = connector_config.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(db_connector_config, field, value)
    db_connector_config.updated_at = datetime.now()

    session.add(db_connector_config)
    session.commit()
    session.refresh(db_connector_config)

    for agent in affected_agents:
        mark_agent_runtime_pending(agent)
        session.add(agent)
    session.commit()
    session.refresh(db_connector_config)

    for agent in affected_agents:
        enqueue_agent_runtime_reconcile(background_tasks, agent_id=agent.agent_id)

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
    agent_names = [
        agent.name
        for agent in session.exec(select(Agent)).all()
        if connector_config_id_str in (agent.connector_config_ids or [])
    ]
    if agent_names:
        raise HTTPException(
            status_code=409,
            detail=f"Connector config is in use by agent: {', '.join(agent_names)}",
        )
    skill_names = [
        skill.name
        for skill in session.exec(select(Skill)).all()
        if connector_config_id_str in (skill.connector_config_ids or [])
    ]
    if skill_names:
        raise HTTPException(
            status_code=409,
            detail=f"Connector config is in use by skill: {', '.join(skill_names)}",
        )

    session.delete(db_connector_config)
    session.commit()
    return {"success": True}

from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from database.database import get_session
from database.models import ConnectorConfig
from utils.helper import cached_connector_info


class ConnectorConfigCreate(BaseModel):
    connector_id: str
    name: str
    config: list[dict[str, Any]]


router = APIRouter(prefix="/connectors", tags=["connectors"])


@router.get("/", response_model=list[dict[str, str]])
def list_connectors():
    connectors = []
    connectors_dir = Path("connectors")
    if connectors_dir.exists():
        for path_obj in connectors_dir.iterdir():
            filename = path_obj.name
            if filename in {"base_connector.py", "__init__.py", "example_connector.py"}:
                continue
            if filename.endswith("_connector.py"):
                # Take prefix before _connector.py and making it capital case
                name = filename.split("_connector.py")[0].replace("_", " ").title()
                connectors.append({"id": filename.strip(".py"), "name": name})
    return connectors


@router.get("/{connector_id}")
def get_connector_details(connector_id: str) -> dict[str, Any]:
    # Block reserved files
    if connector_id in ["__init__", "base_connector"]:
        raise HTTPException(status_code=404, detail="Connector not found")

    connectors_dir = Path("connectors")
    file_path = connectors_dir / f"{connector_id}.py"

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Connector not found")

    with file_path.open(encoding="utf-8") as f:
        source = f.read()

    return cached_connector_info(source, file_path.stat().st_mtime)


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

    connector_file = Path("connectors") / f"{connector_id}.py"
    if not connector_file.exists():
        raise HTTPException(status_code=404, detail="Connector not found")

    db = ConnectorConfig.model_validate(connector_config)
    session.add(db)
    session.commit()
    session.refresh(db)
    return db

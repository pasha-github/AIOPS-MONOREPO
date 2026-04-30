from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from src.agent_runtime.adk.adk_app import invalidate_cache
from src.database.database import get_session
from src.database.models import Agent, MCPServer, Skill
from src.utils.mcp import derive_mcp_display_name, inspect_mcp_server
from src.utils.secrets import decrypt_secret, encrypt_secret

router = APIRouter(prefix="/mcp", tags=["mcp"])


class MCPServerBase(BaseModel):
    server_url: str
    auth_type: str = "none"
    auth_username: str | None = None
    auth_secret: str | None = None
    name: str | None = None
    description: str | None = None


class MCPServerPatch(BaseModel):
    server_url: str | None = None
    auth_type: str | None = None
    auth_username: str | None = None
    auth_secret: str | None = None
    name: str | None = None
    description: str | None = None


class MCPServerRead(BaseModel):
    mcp_server_id: UUID
    name: str
    server_url: str
    description: str | None = None
    auth_type: str
    auth_username: str | None = None
    has_auth_secret: bool
    metadata: dict[str, Any]
    tools: list[dict[str, Any]]
    resources: list[dict[str, Any]]
    created_at: datetime
    updated_at: datetime


class MCPServerTestRead(BaseModel):
    name: str
    server_url: str
    description: str | None = None
    auth_type: str
    auth_username: str | None = None
    has_auth_secret: bool
    metadata: dict[str, Any]
    tools: list[dict[str, Any]]
    resources: list[dict[str, Any]]


def _to_read_model(mcp_server: MCPServer) -> MCPServerRead:
    return MCPServerRead(
        mcp_server_id=mcp_server.mcp_server_id,
        name=mcp_server.name,
        server_url=mcp_server.server_url,
        description=mcp_server.description,
        auth_type=mcp_server.auth_type,
        auth_username=mcp_server.auth_username,
        has_auth_secret=bool(mcp_server.auth_secret),
        metadata=mcp_server.metadata_json or {},
        tools=mcp_server.tools_json or [],
        resources=mcp_server.resources_json or [],
        created_at=mcp_server.created_at,
        updated_at=mcp_server.updated_at,
    )


async def _probe_payload(payload: MCPServerBase | MCPServerPatch) -> dict[str, Any]:
    try:
        return await inspect_mcp_server(
            payload.server_url or "",
            auth_type=payload.auth_type,
            bearer_token=payload.auth_secret if payload.auth_type == "bearer" else None,
            username=payload.auth_username if payload.auth_type == "basic" else None,
            password=payload.auth_secret if payload.auth_type == "basic" else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to connect to MCP server: {exc}",
        ) from exc


def _invalidate_agents_using_mcp(session: Session, mcp_server_id: UUID):
    target_id = str(mcp_server_id)
    matching_skill_ids = {
        str(skill.skill_id)
        for skill in session.exec(select(Skill)).all()
        if target_id in (skill.mcp_server_ids or [])
    }
    for agent in session.exec(select(Agent)).all():
        if target_id in (agent.mcp_server_ids or []) or any(
            skill_id in matching_skill_ids for skill_id in (agent.skill_ids or [])
        ):
            invalidate_cache(agent.agent_id)


@router.get("/", response_model=list[MCPServerRead])
def list_mcp_servers(session: Session = Depends(get_session)):
    servers = session.exec(select(MCPServer)).all()
    return [_to_read_model(server) for server in servers]


@router.get("/{mcp_id}", response_model=MCPServerRead)
def get_mcp_server(mcp_id: UUID, session: Session = Depends(get_session)):
    mcp_server = session.get(MCPServer, mcp_id)
    if mcp_server is None:
        raise HTTPException(status_code=404, detail="MCP server not found")
    return _to_read_model(mcp_server)


@router.post("/test/", response_model=MCPServerTestRead)
async def test_mcp_server(payload: MCPServerBase):
    probe = await _probe_payload(payload)
    display_name = (payload.name or "").strip()
    if display_name:
        probe["metadata"]["name"] = display_name
    return MCPServerTestRead(
        name=display_name,
        server_url=probe["url"],
        description=payload.description,
        auth_type=probe["auth_type"],
        auth_username=payload.auth_username,
        has_auth_secret=bool(payload.auth_secret),
        metadata=probe["metadata"],
        tools=probe["tools"],
        resources=probe["resources"],
    )


@router.post("/", response_model=MCPServerRead)
async def create_mcp_server(
    payload: MCPServerBase, session: Session = Depends(get_session)
):
    probe = await _probe_payload(payload)
    encrypted_secret = (
        encrypt_secret(payload.auth_secret) if payload.auth_secret else None
    )
    display_name = (
        payload.name.strip()
        if payload.name and payload.name.strip()
        else derive_mcp_display_name(payload.server_url, probe.get("metadata"))
    )

    db_server = MCPServer(
        name=display_name,
        server_url=probe["url"],
        description=payload.description,
        auth_type=probe["auth_type"],
        auth_username=payload.auth_username,
        auth_secret=encrypted_secret,
        metadata_json=probe["metadata"],
        tools_json=probe["tools"],
        resources_json=probe["resources"],
    )
    session.add(db_server)
    session.commit()
    session.refresh(db_server)
    return _to_read_model(db_server)


@router.patch("/{mcp_id}", response_model=MCPServerRead)
async def update_mcp_server(
    mcp_id: UUID,
    payload: MCPServerPatch,
    session: Session = Depends(get_session),
):
    mcp_server = session.get(MCPServer, mcp_id)
    if mcp_server is None:
        raise HTTPException(status_code=404, detail="MCP server not found")

    updates = payload.model_dump(exclude_unset=True)
    should_refresh_metadata = any(
        key in updates
        for key in ("server_url", "auth_type", "auth_username", "auth_secret")
    )

    if should_refresh_metadata:
        # Preserve existing secret only when auth_secret is omitted from payload.
        existing_secret = (
            decrypt_secret(mcp_server.auth_secret) if mcp_server.auth_secret else None
        )
        resolved_auth_secret = updates.get("auth_secret", existing_secret)
        resolved_auth_type = updates.get("auth_type", mcp_server.auth_type)
        if resolved_auth_type == "none":
            resolved_auth_secret = None

        probe_payload = MCPServerBase(
            server_url=updates.get("server_url", mcp_server.server_url),
            auth_type=resolved_auth_type,
            auth_username=updates.get("auth_username", mcp_server.auth_username),
            auth_secret=resolved_auth_secret,
            name=updates.get("name", mcp_server.name),
            description=updates.get("description", mcp_server.description),
        )
        probe = await _probe_payload(probe_payload)
        mcp_server.server_url = probe["url"]
        mcp_server.auth_type = probe["auth_type"]
        mcp_server.auth_username = probe_payload.auth_username
        mcp_server.auth_secret = (
            encrypt_secret(probe_payload.auth_secret)
            if probe_payload.auth_secret
            else None
        )
        mcp_server.metadata_json = probe["metadata"]
        mcp_server.tools_json = probe["tools"]
        mcp_server.resources_json = probe["resources"]

    if "name" in updates:
        chosen_name = updates["name"]
        mcp_server.name = (
            chosen_name.strip()
            if isinstance(chosen_name, str) and chosen_name.strip()
            else derive_mcp_display_name(
                mcp_server.server_url,
                mcp_server.metadata_json or {},
            )
        )
    if "description" in updates:
        mcp_server.description = updates["description"]
    mcp_server.updated_at = datetime.now()

    session.add(mcp_server)
    session.commit()
    session.refresh(mcp_server)
    _invalidate_agents_using_mcp(session, mcp_server.mcp_server_id)
    return _to_read_model(mcp_server)


@router.delete("/{mcp_id}")
def delete_mcp_server(mcp_id: UUID, session: Session = Depends(get_session)):
    mcp_server = session.get(MCPServer, mcp_id)
    if mcp_server is None:
        raise HTTPException(status_code=404, detail="MCP server not found")

    mcp_server_id = str(mcp_id)
    agent_names = [
        agent.name
        for agent in session.exec(select(Agent)).all()
        if mcp_server_id in (agent.mcp_server_ids or [])
    ]
    skill_names = [
        skill.name
        for skill in session.exec(select(Skill)).all()
        if mcp_server_id in (skill.mcp_server_ids or [])
    ]
    if agent_names:
        raise HTTPException(
            status_code=409,
            detail=f"MCP server is in use by agent: {', '.join(agent_names)}",
        )
    if skill_names:
        raise HTTPException(
            status_code=409,
            detail=f"MCP server is in use by skill: {', '.join(skill_names)}",
        )

    session.delete(mcp_server)
    session.commit()
    return {"success": True}

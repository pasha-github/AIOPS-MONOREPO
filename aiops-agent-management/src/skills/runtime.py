import re
from typing import Any, cast
from uuid import UUID

from fastapi import HTTPException
from google.adk.skills import models as skill_models
from sqlmodel import Session, select

from src.connectors.loader import resolve_connector_tools
from src.database.models import Agent, ConnectorConfig, MCPServer, Skill

SKILL_NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:[-_][a-z0-9]+)*$")


def validate_skill_name(name: str) -> str:
    if not SKILL_NAME_PATTERN.fullmatch(name):
        raise HTTPException(
            status_code=400,
            detail="Skill name must be kebab-case or snake_case",
        )
    return name


def _parse_uuid(raw_id: str, *, label: str) -> UUID:
    try:
        return UUID(raw_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {label}: {raw_id}",
        ) from exc


def _tool_name(tool: Any) -> str | None:
    return getattr(tool, "name", None) or getattr(tool, "__name__", None)


def validate_connector_config_ids(
    session: Session, connector_config_ids: list[str] | None
) -> list[ConnectorConfig]:
    connector_configs: list[ConnectorConfig] = []
    for connector_config_id in connector_config_ids or []:
        connector_uuid = _parse_uuid(connector_config_id, label="connector config id")
        connector_config = session.get(ConnectorConfig, connector_uuid)
        if connector_config is None:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid connector config id: {connector_config_id}",
            )
        connector_configs.append(connector_config)
    return connector_configs


def validate_mcp_server_ids(
    session: Session, mcp_server_ids: list[str] | None
) -> list[MCPServer]:
    mcp_servers: list[MCPServer] = []
    for mcp_server_id in mcp_server_ids or []:
        mcp_uuid = _parse_uuid(mcp_server_id, label="MCP server id")
        mcp_server = session.get(MCPServer, mcp_uuid)
        if mcp_server is None:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid MCP server id: {mcp_server_id}",
            )
        mcp_servers.append(mcp_server)
    return mcp_servers


def validate_skill_ids(session: Session, skill_ids: list[str] | None) -> list[Skill]:
    skills: list[Skill] = []
    for skill_id in skill_ids or []:
        skill_uuid = _parse_uuid(skill_id, label="skill id")
        skill = session.get(Skill, skill_uuid)
        if skill is None:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid skill id: {skill_id}",
            )
        skills.append(skill)
    return skills


def collect_available_skill_tool_names(
    session: Session,
    *,
    connector_config_ids: list[str] | None,
    mcp_server_ids: list[str] | None,
) -> set[str]:
    tool_names: set[str] = set()

    for connector_config in validate_connector_config_ids(
        session, connector_config_ids
    ):
        try:
            connector_tools = resolve_connector_tools(connector_config)
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Could not resolve tools for connector config "
                    f"{connector_config.connector_config_id}: {exc}"
                ),
            ) from exc
        for tool in connector_tools:
            tool_name = _tool_name(tool)
            if tool_name:
                tool_names.add(tool_name)

    for mcp_server in validate_mcp_server_ids(session, mcp_server_ids):
        for tool in mcp_server.tools_json or []:
            tool_name = tool.get("name")
            if tool_name:
                tool_names.add(tool_name)

    return tool_names


def validate_skill_tool_names(
    session: Session,
    *,
    connector_config_ids: list[str] | None,
    mcp_server_ids: list[str] | None,
    tool_names: list[str] | None,
):
    if not tool_names:
        return

    available_tool_names = collect_available_skill_tool_names(
        session,
        connector_config_ids=connector_config_ids,
        mcp_server_ids=mcp_server_ids,
    )
    missing_tool_names = sorted(set(tool_names) - available_tool_names)
    if missing_tool_names:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unknown skill tools: "
                + ", ".join(missing_tool_names)
                + ". Attach matching connector configs or MCP servers first."
            ),
        )


def build_skill_model(skill: Skill) -> skill_models.Skill:
    metadata: dict[str, Any] = {}
    if skill.tools:
        metadata["adk_additional_tools"] = skill.tools

    references = cast(dict[str, str | bytes], dict(skill.references or {}))
    assets = cast(dict[str, str | bytes], dict(skill.assets or {}))

    return skill_models.Skill(
        frontmatter=skill_models.Frontmatter(
            name=skill.name,
            description=skill.description,
            metadata=metadata,
        ),
        instructions=skill.instructions,
        resources=skill_models.Resources(
            references=references,
            assets=assets,
            scripts={
                script_name: skill_models.Script(src=script_src)
                for script_name, script_src in (skill.scripts or {}).items()
            },
        ),
    )


def invalidate_cache(agent_id: str):
    from src.agent_runtime.adk.adk_app import (
        invalidate_cache as runtime_invalidate_cache,
    )

    runtime_invalidate_cache(agent_id)


def agent_ids_using_skill(session: Session, skill_id: str) -> list[str]:
    return [
        agent.agent_id
        for agent in session.exec(select(Agent)).all()
        if skill_id in (agent.skill_ids or [])
    ]


def invalidate_agents_using_skill(session: Session, skill_id: str):
    for agent_id in agent_ids_using_skill(session, skill_id):
        invalidate_cache(agent_id)

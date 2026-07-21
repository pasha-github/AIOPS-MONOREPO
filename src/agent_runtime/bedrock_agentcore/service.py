import logging
from pathlib import Path
from uuid import uuid4

import boto3  # noqa: F401
from botocore.exceptions import ClientError
from sqlmodel import Session

from src.agent_runtime.bedrock_agentcore.helper_function import (
    BEDROCK_AGENTCORE_CONFIG_FILE,
    BEDROCK_BUILD_ROOT,
    CONNECTORS_DIR,
    DOCKERFILE_FILE,
    ENTRYPOINT_FILE,
    PLUGINS_DIR,
    PROJECT_ROOT,
    REQUIREMENTS_FILE,
    RUNTIME_APP_DIR,
    agent_runtime_id_for_agent,
    agentcore_agent_name,
    build_runtime_env_vars,
    cleanup_bedrock_agentcore_build_context,
    clear_bedrock_agentcore_config,
    clear_bedrock_agentcore_config_file,
    create_bedrock_boto3_client,
    ensure_bedrock_agentcore_config,
    invoke_agentcore_runtime,
    is_not_found_error,
    is_resource_not_found_exception,
    persist_agent_state,
    prepare_bedrock_agentcore_build_context,
    pushd,
    raise_for_runtime_error,
    resource_arn_from_launch_result,
    user_runtime_session_id,
    wait_for_agent_runtime_deleted,
    wait_for_deleting_agent_runtime_name,
    write_agent_bundle,
)
from src.database.models import Agent
from src.utils.aws_credentials import aws_credentials_env
from src.utils.constants import (
    AWS_REGION,
    BEDROCK_AGENTCORE_AUTO_CREATE_ECR,
    BEDROCK_AGENTCORE_AUTO_CREATE_EXECUTION_ROLE,
    BEDROCK_AGENTCORE_EXECUTION_ROLE,
)

logger = logging.getLogger(__name__)

_user_runtime_session_id = user_runtime_session_id


def _clear_bedrock_agentcore_config(agent_name: str) -> None:
    clear_bedrock_agentcore_config_file(BEDROCK_AGENTCORE_CONFIG_FILE, agent_name)
    build_config = BEDROCK_BUILD_ROOT / agent_name / ".bedrock_agentcore.yaml"
    clear_bedrock_agentcore_config_file(build_config, agent_name)


def _prepare_bedrock_agentcore_build_context(agent_name: str) -> Path:
    import shutil as _shutil

    from src.agent_runtime.bedrock_agentcore.helper_function import is_relative_to

    build_context = BEDROCK_BUILD_ROOT / agent_name
    if not is_relative_to(build_context, BEDROCK_BUILD_ROOT):
        raise ValueError(f"Invalid Bedrock AgentCore build context: {build_context}")
    if build_context.exists():
        _shutil.rmtree(build_context)

    def _copy(source: Path) -> None:
        if not source.exists():
            return
        try:
            rel = source.relative_to(PROJECT_ROOT)
        except ValueError:
            return
        destination = build_context / rel
        destination.parent.mkdir(parents=True, exist_ok=True)
        _shutil.copy2(source, destination)

    for f in [
        PROJECT_ROOT / "src" / "__init__.py",
        RUNTIME_APP_DIR / "__init__.py",
        RUNTIME_APP_DIR / "main.py",
        RUNTIME_APP_DIR / "agent.py",
        PLUGINS_DIR / "session_summary_plugin.py",
        REQUIREMENTS_FILE,
    ]:
        _copy(f)

    # for connector_dir in CONNECTORS_DIR.iterdir():
    #     if not connector_dir.is_dir() or connector_dir.name.startswith("__"):
    #         continue
    #     for connector_file in connector_dir.glob("*.py"):
    #         _copy(connector_file)
    for connector_path in CONNECTORS_DIR.iterdir():
        if connector_path.name in {"__pycache__", "loader.py"}:
            continue
        if connector_path.is_file() and connector_path.suffix == ".py":
            _copy(connector_path)
        elif connector_path.is_dir():
            _shutil.copytree(
                connector_path,
                build_context / connector_path.relative_to(PROJECT_ROOT),
                ignore=_shutil.ignore_patterns("__pycache__", "*.pyc"),
                dirs_exist_ok=True,
            )

    staged_dockerfile = build_context / "Dockerfile"
    staged_dockerfile.parent.mkdir(parents=True, exist_ok=True)
    staged_dockerfile.write_text(DOCKERFILE_FILE.read_text())
    return build_context


def deploy_agent(agent: Agent, session: Session) -> None:
    ensure_bedrock_agentcore_config()
    agent_id = agent.agent_id
    build_context: Path | None = None

    agent.bedrock_agentcore_deployment_status = "deploying"
    agent.bedrock_agentcore_deployment_error = None
    if not persist_agent_state(session, agent):
        logger.warning(
            "Skipped Bedrock AgentCore deploy for agent %s because its database row changed",
            agent_id,
        )
        return

    try:
        try:
            from bedrock_agentcore_starter_toolkit.operations.runtime import (  # type: ignore[import-untyped]
                configure_bedrock_agentcore,
                launch_bedrock_agentcore,
            )
        except ImportError as exc:
            raise RuntimeError(
                "bedrock-agentcore-starter-toolkit is required to deploy AgentCore agents"
            ) from exc

        agent_name = agentcore_agent_name(agent)
        wait_for_deleting_agent_runtime_name(
            agent_name,
            credential_id=agent.aws_credential_id,
        )
        if not agent.bedrock_agentcore_resource_arn:
            clear_bedrock_agentcore_config(agent_name)
        build_context = prepare_bedrock_agentcore_build_context(agent_name)
        write_agent_bundle(build_context, agent)
        staged_entrypoint = build_context / ENTRYPOINT_FILE.relative_to(PROJECT_ROOT)
        staged_requirements = build_context / REQUIREMENTS_FILE.relative_to(
            PROJECT_ROOT
        )
        configure_kwargs = {
            "entrypoint_path": staged_entrypoint,
            "auto_create_execution_role": BEDROCK_AGENTCORE_AUTO_CREATE_EXECUTION_ROLE,
            "auto_create_ecr": BEDROCK_AGENTCORE_AUTO_CREATE_ECR,
            "requirements_file": str(staged_requirements),
            "region": AWS_REGION,
            "agent_name": agent_name,
            "source_path": str(build_context),
            "deployment_type": "container",
            "non_interactive": True,
        }
        if BEDROCK_AGENTCORE_EXECUTION_ROLE:
            configure_kwargs["execution_role"] = BEDROCK_AGENTCORE_EXECUTION_ROLE

        with (
            pushd(PROJECT_ROOT),
            aws_credentials_env(
                session,
                agent.aws_credential_id,
            ),
        ):
            configure_result = configure_bedrock_agentcore(**configure_kwargs)
            try:
                launch_result = launch_bedrock_agentcore(
                    configure_result.config_path,
                    env_vars=build_runtime_env_vars(session, agent),
                    auto_update_on_conflict=True,
                )
            except Exception as exc:
                if not is_resource_not_found_exception(exc):
                    raise

                logger.warning(
                    "Bedrock AgentCore config for %s referenced a missing runtime; "
                    "clearing local runtime IDs and retrying deploy once",
                    agent_name,
                )
                clear_bedrock_agentcore_config(agent_name)
                configure_result = configure_bedrock_agentcore(**configure_kwargs)
                launch_result = launch_bedrock_agentcore(
                    configure_result.config_path,
                    env_vars=build_runtime_env_vars(session, agent),
                    auto_update_on_conflict=True,
                )

        resource_arn = resource_arn_from_launch_result(launch_result)
        if not resource_arn:
            raise ValueError(
                "Bedrock AgentCore deployment did not return an agent runtime ARN"
            )

        agent.bedrock_agentcore_resource_arn = resource_arn
        agent.bedrock_agentcore_deployment_status = "deployed"
        agent.bedrock_agentcore_deployment_error = None
        if not persist_agent_state(session, agent):
            logger.warning(
                "Bedrock AgentCore deploy finished for agent %s but its database row changed before persistence",
                agent_id,
            )
    except Exception as exc:
        session.rollback()
        logger.exception("Failed to deploy Bedrock AgentCore agent %s", agent_id)
        agent.bedrock_agentcore_deployment_status = "failed"
        agent.bedrock_agentcore_deployment_error = str(exc)
        persist_agent_state(session, agent)
        raise
    finally:
        try:
            cleanup_bedrock_agentcore_build_context(build_context)
        except Exception:
            logger.exception(
                "Failed to remove temporary Bedrock AgentCore build context for agent %s",
                agent_id,
            )


def cleanup_agent(agent: Agent) -> None:
    agent_name = agentcore_agent_name(agent)
    agent_arn = agent.bedrock_agentcore_resource_arn
    agent_runtime_id = agent_runtime_id_for_agent(agent, agent_name)

    if not agent_runtime_id:
        logger.warning(
            "Unable to find Bedrock AgentCore runtime ID for %s (%s); "
            "assuming it is already deleted",
            agent_name,
            agent_arn or "no stored ARN",
        )
        clear_bedrock_agentcore_config(agent_name)
        return

    client = create_bedrock_boto3_client(
        "bedrock-agentcore-control",
        credential_id=agent.aws_credential_id,
    )

    try:
        response = client.delete_agent_runtime(agentRuntimeId=agent_runtime_id)
        status = response.get("status")
        logger.info(
            "Bedrock AgentCore runtime deletion initiated for %s (status: %s)",
            agent_arn or agent_runtime_id,
            status,
        )
        wait_for_agent_runtime_deleted(
            agent_runtime_id,
            credential_id=agent.aws_credential_id,
        )
    except ClientError as exc:
        if not is_not_found_error(exc):
            logger.exception(
                "Failed to delete Bedrock AgentCore runtime for %s using runtime ID %s",
                agent_arn or agent_name,
                agent_runtime_id,
            )
            raise
        logger.info(
            "Bedrock AgentCore runtime %s was already deleted",
            agent_runtime_id,
        )
    except Exception:
        logger.exception(
            "Failed to delete Bedrock AgentCore runtime for %s using runtime ID %s",
            agent_arn or agent_name,
            agent_runtime_id,
        )
        raise

    clear_bedrock_agentcore_config(agent_name)


def disable_agent(agent: Agent, session: Session) -> None:
    agent.bedrock_agentcore_deployment_status = "disabling"
    agent.bedrock_agentcore_deployment_error = None
    persist_agent_state(session, agent)

    try:
        cleanup_agent(agent)
    except Exception as exc:
        session.rollback()
        agent.bedrock_agentcore_deployment_status = "delete_failed"
        agent.bedrock_agentcore_deployment_error = str(exc)
        persist_agent_state(session, agent)
        raise
    else:
        agent.bedrock_agentcore_resource_arn = None
        agent.bedrock_agentcore_deployment_status = "disabled"
        agent.bedrock_agentcore_deployment_error = None
        persist_agent_state(session, agent)


async def invoke_agent(agent: Agent, prompt: str):
    events, _session_id = await chat_agent_invoke_script(
        agent,
        prompt,
        session_id=None,
        user_id="anonymous",
    )
    return events


async def create_session(agent: Agent, *, user_id: str) -> str:
    session_id = str(uuid4())
    event = invoke_agentcore_runtime(
        agent,
        {
            "action": "create_session",
            "user_id": user_id,
            "session_id": session_id,
        },
        runtime_session_id=user_runtime_session_id(agent, user_id),
    )
    raise_for_runtime_error(event)
    returned_session_id = event.get("session_id")
    if not isinstance(returned_session_id, str) or not returned_session_id:
        raise ValueError(
            "Bedrock AgentCore session creation did not return a session id"
        )
    return returned_session_id


async def list_sessions(agent: Agent, *, user_id: str) -> list[dict[str, object]]:
    event = invoke_agentcore_runtime(
        agent,
        {
            "action": "list_sessions",
            "user_id": user_id,
        },
        runtime_session_id=user_runtime_session_id(agent, user_id),
    )
    raise_for_runtime_error(event)
    sessions = event.get("sessions", [])
    if not isinstance(sessions, list):
        raise ValueError("Bedrock AgentCore session list did not return a list")
    return sessions


async def get_session(
    agent: Agent, *, user_id: str, session_id: str
) -> dict[str, object]:
    event = invoke_agentcore_runtime(
        agent,
        {
            "action": "get_session",
            "user_id": user_id,
            "session_id": session_id,
        },
        runtime_session_id=user_runtime_session_id(agent, user_id),
    )
    raise_for_runtime_error(event)
    session = event.get("session")
    if session is None:
        raise ValueError(f"Bedrock AgentCore session '{session_id}' was not found")
    if not isinstance(session, dict):
        raise ValueError("Bedrock AgentCore get session did not return a session")
    return session


async def delete_session(agent: Agent, *, user_id: str, session_id: str) -> None:
    event = invoke_agentcore_runtime(
        agent,
        {
            "action": "delete_session",
            "user_id": user_id,
            "session_id": session_id,
        },
        runtime_session_id=user_runtime_session_id(agent, user_id),
    )
    raise_for_runtime_error(event)


async def chat_agent_invoke_script(
    agent: Agent,
    prompt: str,
    session_id: str | None = None,
    *,
    user_id: str,
):
    if session_id is None:
        session_id = await create_session(agent, user_id=user_id)

    event = invoke_agentcore_runtime(
        agent,
        {
            "prompt": prompt,
            "user_id": user_id,
            "session_id": session_id,
        },
        runtime_session_id=user_runtime_session_id(agent, user_id),
    )
    raise_for_runtime_error(event)
    if isinstance(event, dict) and isinstance(event.get("session_id"), str):
        session_id = event["session_id"]

    return [event], session_id

import json
import logging
import os
import re
import shutil
import time
from contextlib import contextmanager, suppress
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from typing import Any
from uuid import NAMESPACE_URL, UUID, uuid4, uuid5

import boto3
import cloudpickle
import yaml
from botocore.exceptions import ClientError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm.exc import StaleDataError
from sqlmodel import Session

from src.agent_runtime.adk.agent_loader import DatabaseAgentLoader
from src.agent_runtime.adk.cache import cache as agent_cache
from src.agent_runtime.model_stack import resolve_model_stack
from src.database.database import engine
from src.database.models import Agent, Model
from src.utils.aws_credentials import decrypt_aws_credential, get_aws_credential
from src.utils.constants import (
    AWS_REGION,
    ENCRYPTION_KEY,
    POSTGRES_AGENT_SERVER_DATABASE_URL,
)
from src.utils.secrets import decrypt_secret

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[3]
RUNTIME_APP_DIR = PROJECT_ROOT / "src" / "agent_runtime" / "bedrock_agentcore"
CONNECTORS_DIR = PROJECT_ROOT / "src" / "connectors"
PLUGINS_DIR = PROJECT_ROOT / "src" / "plugins"
ENTRYPOINT_FILE = RUNTIME_APP_DIR / "main.py"
REQUIREMENTS_FILE = RUNTIME_APP_DIR / "bedrock_agentcore_requirements.txt"
DOCKERFILE_FILE = RUNTIME_APP_DIR / "Dockerfile"
BEDROCK_BUILD_ROOT = PROJECT_ROOT / ".build" / "bedrock_agentcore"
BEDROCK_AGENTCORE_CONFIG_FILE = PROJECT_ROOT / ".bedrock_agentcore.yaml"
AGENT_BUNDLE_FILENAME = "agent_bundle.pkl"
DELETE_WAIT_SECONDS = int(os.getenv("BEDROCK_AGENTCORE_DELETE_WAIT_SECONDS", "300"))
DELETE_WAIT_INTERVAL_SECONDS = int(
    os.getenv("BEDROCK_AGENTCORE_DELETE_WAIT_INTERVAL_SECONDS", "5")
)
AGENT_RUNTIME_ID_PATTERN = re.compile(r"[A-Za-z][A-Za-z0-9_]{0,99}-[A-Za-z0-9]{10}")


@contextmanager
def pushd(path: Path):
    previous = Path.cwd()
    os.chdir(path)
    try:
        yield
    finally:
        os.chdir(previous)


def persist_agent_state(session: Session, agent: Agent) -> bool:
    try:
        session.add(agent)
        session.commit()
        session.refresh(agent)
        return True
    except StaleDataError:
        session.rollback()
        return False


def ensure_bedrock_agentcore_config() -> None:
    if not AWS_REGION:
        raise ValueError("Missing Bedrock AgentCore configuration: AWS_REGION")
    if not ENTRYPOINT_FILE.exists():
        raise ValueError(f"Bedrock AgentCore entrypoint not found: {ENTRYPOINT_FILE}")
    if not REQUIREMENTS_FILE.exists():
        raise ValueError(
            f"Bedrock AgentCore requirements file not found: {REQUIREMENTS_FILE}"
        )
    if not DOCKERFILE_FILE.exists():
        raise ValueError(f"Bedrock AgentCore Dockerfile not found: {DOCKERFILE_FILE}")


def agentcore_agent_name(agent: Agent) -> str:
    name = re.sub(r"[^A-Za-z0-9_]", "_", agent.agent_id)
    name = re.sub(r"_+", "_", name).strip("_")
    if not name:
        name = f"agent_{uuid4().hex[:8]}"
    if not name[0].isalpha():
        name = f"agent_{name}"
    return name[:48]


def is_relative_to(path: Path, parent: Path) -> bool:
    try:
        path.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def copy_into_build_context(source: Path, build_context: Path) -> Path:
    destination = build_context / source.relative_to(PROJECT_ROOT)
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    logger.info(
        "Staged AgentCore runtime file: source=%s destination=%s",
        source.relative_to(PROJECT_ROOT),
        destination.relative_to(build_context),
    )
    return destination


def prepare_bedrock_agentcore_build_context(agent_name: str) -> Path:
    """Stage a build context whose root Dockerfile is the AgentCore runtime one."""
    build_context = BEDROCK_BUILD_ROOT / agent_name
    if not is_relative_to(build_context, BEDROCK_BUILD_ROOT):
        raise ValueError(f"Invalid Bedrock AgentCore build context: {build_context}")

    if build_context.exists():
        shutil.rmtree(build_context)

    runtime_files = [
        PROJECT_ROOT / "src" / "__init__.py",
        RUNTIME_APP_DIR / "__init__.py",
        RUNTIME_APP_DIR / "main.py",
        RUNTIME_APP_DIR / "agent.py",
        PLUGINS_DIR / "session_summary_plugin.py",
        REQUIREMENTS_FILE,
    ]
    for runtime_file in runtime_files:
        copy_into_build_context(runtime_file, build_context)

    for connector_path in CONNECTORS_DIR.iterdir():
        if connector_path.name == "__pycache__":
            continue
        if connector_path.is_file() and connector_path.suffix == ".py":
            copy_into_build_context(connector_path, build_context)
        elif connector_path.is_dir():
            shutil.copytree(
                connector_path,
                build_context / connector_path.relative_to(PROJECT_ROOT),
                ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
                dirs_exist_ok=True,
            )

    staged_dockerfile = build_context / "Dockerfile"
    staged_dockerfile.parent.mkdir(parents=True, exist_ok=True)
    staged_dockerfile.write_text(DOCKERFILE_FILE.read_text())
    staged_connectors = sorted(
        str(path.relative_to(build_context))
        for path in (build_context / "src" / "connectors").rglob("*.py")
    )
    logger.info(
        "Prepared Bedrock AgentCore build context: agent_name=%s build_context=%s "
        "connectors=%s",
        agent_name,
        build_context,
        staged_connectors,
    )
    return build_context


def cleanup_bedrock_agentcore_build_context(build_context: Path | None) -> None:
    if build_context is None or not build_context.exists():
        return
    if not is_relative_to(build_context, BEDROCK_BUILD_ROOT):
        raise ValueError(f"Invalid Bedrock AgentCore build context: {build_context}")

    shutil.rmtree(build_context)
    with suppress(OSError):
        BEDROCK_BUILD_ROOT.rmdir()


def write_agent_bundle(build_context: Path, agent: Agent) -> Path:
    local_adk_version = package_version("google-adk")
    target_adk_requirement = read_google_adk_requirement()
    if target_adk_requirement and local_adk_version not in target_adk_requirement:
        logger.warning(
            "AgentCore bundle/runtime google-adk version mismatch risk: "
            "local=%s target_requirement=%s",
            local_adk_version,
            target_adk_requirement,
        )

    agent_cache.remove_agent(agent.agent_id)
    runtime_agent = DatabaseAgentLoader().load_agent(
        agent.agent_id,
        allow_non_adk=True,
    )
    if runtime_agent is None:
        raise ValueError(f"Unable to build runtime agent for '{agent.agent_id}'")

    bundle_path = (
        build_context
        / "src"
        / "agent_runtime"
        / "bedrock_agentcore"
        / AGENT_BUNDLE_FILENAME
    )
    with bundle_path.open("wb") as bundle_file:
        cloudpickle.dump(runtime_agent, bundle_file)

    logger.info(
        "Wrote AgentCore agent bundle: agent_id=%s bundle=%s agent_type=%s "
        "google_adk_version=%s tool_names=%s",
        agent.agent_id,
        bundle_path,
        type(runtime_agent).__name__,
        local_adk_version,
        [
            getattr(tool, "name", repr(tool))
            for tool in getattr(runtime_agent, "tools", []) or []
        ],
    )
    return bundle_path


def read_google_adk_requirement() -> str | None:
    for line in REQUIREMENTS_FILE.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped.startswith("google-adk"):
            return stripped
    return None


def package_version(package_name: str) -> str:
    try:
        return version(package_name)
    except PackageNotFoundError:
        return "unknown"


def set_model_env_var(env_vars: dict[str, str], model_config: Model) -> None:
    if not model_config.api_key:
        return

    decrypted_api_key = decrypt_secret(model_config.api_key)
    if model_config.provider.upper() == "BEDROCK":
        env_vars["AWS_BEARER_TOKEN_BEDROCK"] = decrypted_api_key
    else:
        env_vars[f"{model_config.provider.upper()}_API_KEY"] = decrypted_api_key


def agentcore_session_database_url() -> str:
    database_url = POSTGRES_AGENT_SERVER_DATABASE_URL
    if not database_url or not database_url.strip():
        raise ValueError(
            "POSTGRES_AGENT_SERVER_DATABASE_URL is required for Bedrock AgentCore sessions"
        )
    if database_url.startswith("sqlite"):
        raise ValueError(
            "Bedrock AgentCore deployment requires a remote database URL for "
            "AGENT_SERVER_DATABASE_URL. Set POSTGRES_AGENT_SERVER_DATABASE_URL "
            "to a reachable PostgreSQL URL."
        )
    return database_url


def build_runtime_env_vars(session: Session, agent: Agent) -> dict[str, str]:
    env_vars = {
        "AGENT_ID": agent.agent_id,
        "APP_NAME": agent.agent_id,
        "AWS_REGION": AWS_REGION,
        "AGENT_SERVER_DATABASE_URL": agentcore_session_database_url(),
    }
    if ENCRYPTION_KEY:
        env_vars["ENCRYPTION_KEY"] = ENCRYPTION_KEY

    primary_model, fallback_models = resolve_model_stack(session, agent)
    for model in [primary_model, *fallback_models]:
        if model is not None:
            set_model_env_var(env_vars, model)
    logger.info(
        "Built AgentCore runtime env vars: agent_id=%s keys=%s db_url_present=%s",
        agent.agent_id,
        sorted(env_vars.keys()),
        bool(env_vars.get("AGENT_SERVER_DATABASE_URL")),
    )
    return {key: value for key, value in env_vars.items() if value is not None}


def resource_arn_from_launch_result(launch_result: Any) -> str | None:
    if isinstance(launch_result, str):
        arn_match = re.search(r"arn:aws:[^\s,'\"}]+", launch_result)
        return arn_match.group(0) if arn_match else None

    if isinstance(launch_result, dict):
        for key in (
            "agent_runtime_arn",
            "agentRuntimeArn",
            "agent_arn",
            "agentArn",
            "arn",
        ):
            value = launch_result.get(key)
            if isinstance(value, str) and value.startswith("arn:aws:"):
                return value
        for value in launch_result.values():
            resource_arn = resource_arn_from_launch_result(value)
            if resource_arn:
                return resource_arn

    for attr in (
        "agent_runtime_arn",
        "agentRuntimeArn",
        "agent_arn",
        "agentArn",
        "arn",
    ):
        value = getattr(launch_result, attr, None)
        if isinstance(value, str) and value.startswith("arn:aws:"):
            return value

    return None


def create_bedrock_boto3_client(
    service_name: str,
    session: Session | None = None,
    credential_id: UUID | None = None,
):
    try:
        if session is not None:
            credential = decrypt_aws_credential(
                get_aws_credential(session, credential_id)
            )
        else:
            with Session(engine) as credential_session:
                credential = decrypt_aws_credential(
                    get_aws_credential(credential_session, credential_id)
                )
    except SQLAlchemyError:
        credential = None

    if credential is None:
        return boto3.client(service_name, region_name=AWS_REGION)

    return boto3.client(
        service_name,
        region_name=credential.region or AWS_REGION,
        aws_access_key_id=credential.access_key_id,
        aws_secret_access_key=credential.secret_access_key,
        aws_session_token=credential.session_token,
    )


def clear_bedrock_agentcore_config_file(config_path: Path, agent_name: str) -> None:
    if not config_path.exists():
        return

    with config_path.open("r", encoding="utf-8") as config_file:
        config = yaml.safe_load(config_file) or {}

    agents = config.get("agents")
    if not isinstance(agents, dict):
        return

    agent_config = agents.get(agent_name)
    if not isinstance(agent_config, dict):
        return

    bedrock_config = agent_config.get("bedrock_agentcore")
    if not isinstance(bedrock_config, dict):
        return

    changed = False
    for key in ("agent_id", "agent_arn", "agent_session_id"):
        if bedrock_config.get(key) is not None:
            bedrock_config[key] = None
            changed = True

    if not changed:
        return

    with config_path.open("w", encoding="utf-8") as config_file:
        yaml.safe_dump(config, config_file, sort_keys=False)


def clear_bedrock_agentcore_config(agent_name: str) -> None:
    clear_bedrock_agentcore_config_file(BEDROCK_AGENTCORE_CONFIG_FILE, agent_name)


def is_not_found_error(exc: ClientError) -> bool:
    code = exc.response.get("Error", {}).get("Code")
    return code in {
        "ResourceNotFoundException",
        "ResourceNotFound",
        "NotFoundException",
        "NotFound",
        "404",
    }


def is_resource_not_found_exception(exc: Exception) -> bool:
    return isinstance(exc, ClientError) and is_not_found_error(exc)


def wait_for_agent_runtime_deleted(
    agent_runtime_id: str,
    credential_id: UUID | None = None,
) -> None:
    if DELETE_WAIT_SECONDS <= 0:
        return

    client = create_bedrock_boto3_client(
        "bedrock-agentcore-control",
        credential_id=credential_id,
    )
    deadline = time.monotonic() + DELETE_WAIT_SECONDS
    last_status = "UNKNOWN"

    while True:
        try:
            response = client.get_agent_runtime(agentRuntimeId=agent_runtime_id)
        except ClientError as exc:
            if is_not_found_error(exc):
                logger.info(
                    "Bedrock AgentCore runtime %s deletion completed",
                    agent_runtime_id,
                )
                return
            raise

        last_status = str(
            response.get("status")
            or response.get("agentRuntimeStatus")
            or response.get("agent_runtime_status")
            or "UNKNOWN"
        )

        if time.monotonic() >= deadline:
            raise TimeoutError(
                "Timed out waiting for Bedrock AgentCore runtime "
                f"{agent_runtime_id} to finish deleting; last status: {last_status}"
            )

        logger.info(
            "Waiting for Bedrock AgentCore runtime %s deletion; current status: %s",
            agent_runtime_id,
            last_status,
        )
        time.sleep(DELETE_WAIT_INTERVAL_SECONDS)


def runtime_status(response: dict[str, Any]) -> str:
    return str(
        response.get("status")
        or response.get("agentRuntimeStatus")
        or response.get("agent_runtime_status")
        or "UNKNOWN"
    )


def find_agent_runtime_by_name(
    agent_name: str,
    credential_id: UUID | None = None,
) -> dict[str, Any] | None:
    client = create_bedrock_boto3_client(
        "bedrock-agentcore-control",
        credential_id=credential_id,
    )
    next_token = None

    while True:
        kwargs: dict[str, Any] = {"maxResults": 100}
        if next_token:
            kwargs["nextToken"] = next_token

        response = client.list_agent_runtimes(**kwargs)
        for runtime in response.get("agentRuntimes", []):
            if runtime.get("agentRuntimeName") == agent_name:
                return runtime

        next_token = response.get("nextToken")
        if not next_token:
            return None


def agent_runtime_id_from_resource(resource: str | None) -> str | None:
    if not resource:
        return None

    if AGENT_RUNTIME_ID_PATTERN.fullmatch(resource):
        return resource

    resource_tail = resource.rsplit("/", 1)[-1]
    if AGENT_RUNTIME_ID_PATTERN.fullmatch(resource_tail):
        return resource_tail

    return None


def agent_runtime_id_for_agent(agent: Agent, agent_name: str) -> str | None:
    runtime_id = agent_runtime_id_from_resource(agent.bedrock_agentcore_resource_arn)
    if runtime_id:
        return runtime_id

    runtime = find_agent_runtime_by_name(
        agent_name,
        credential_id=agent.aws_credential_id,
    )
    if runtime is None:
        return None

    runtime_id = runtime.get("agentRuntimeId")
    return runtime_id if isinstance(runtime_id, str) and runtime_id else None


def wait_for_deleting_agent_runtime_name(
    agent_name: str,
    credential_id: UUID | None = None,
) -> None:
    runtime = find_agent_runtime_by_name(agent_name, credential_id=credential_id)
    if runtime is None:
        return

    runtime_status_value = runtime_status(runtime).upper()
    runtime_id = runtime.get("agentRuntimeId")
    if (
        runtime_status_value == "DELETING"
        and isinstance(runtime_id, str)
        and runtime_id
    ):
        logger.info(
            "Bedrock AgentCore runtime %s is still DELETING; waiting before deploy",
            runtime_id,
        )
        wait_for_agent_runtime_deleted(runtime_id, credential_id=credential_id)


def raise_for_runtime_error(event: dict[str, Any]) -> None:
    error = event.get("error")
    if isinstance(error, str) and error:
        raise ValueError(error)


def user_runtime_session_id(agent: Agent, user_id: str) -> str:
    session_key = uuid5(NAMESPACE_URL, f"{agent.agent_id}:{user_id}")
    return f"sessions-{session_key}"


def invoke_agentcore_runtime(
    agent: Agent,
    payload: dict[str, Any],
    *,
    runtime_session_id: str,
) -> dict[str, Any]:
    if not agent.bedrock_agentcore_resource_arn:
        raise ValueError(
            f"Agent '{agent.agent_id}' is not deployed on Bedrock AgentCore"
        )

    client = create_bedrock_boto3_client(
        "bedrock-agentcore",
        credential_id=agent.aws_credential_id,
    )
    response = client.invoke_agent_runtime(
        agentRuntimeArn=agent.bedrock_agentcore_resource_arn,
        runtimeSessionId=runtime_session_id,
        payload=json.dumps(payload).encode("utf-8"),
        contentType="application/json",
    )

    response_body = response.get("response") or response.get("body")
    raw_body = response_body.read() if hasattr(response_body, "read") else response_body

    if isinstance(raw_body, bytes):
        raw_body = raw_body.decode("utf-8")

    event = json.loads(raw_body) if isinstance(raw_body, str) else raw_body
    if not isinstance(event, dict):
        raise ValueError("Bedrock AgentCore runtime returned an invalid response")
    logger.info(
        "Bedrock AgentCore runtime response: agent_id=%s session_id=%s keys=%s "
        "has_error=%s",
        agent.agent_id,
        runtime_session_id,
        sorted(event.keys()),
        bool(event.get("error")),
    )
    return event

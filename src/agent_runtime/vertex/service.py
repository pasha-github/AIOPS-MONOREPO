import json
import logging
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from typing import Any, cast
from uuid import uuid4

import vertexai
from google.cloud.aiplatform_v1.types.env_var import SecretRef
from google.oauth2 import service_account
from sqlalchemy.orm.exc import StaleDataError
from sqlmodel import Session, select
from vertexai import agent_engines

from src.agent_runtime.adk.agent_loader import DatabaseAgentLoader
from src.agent_runtime.model_stack import resolve_model_stack
from src.database.database import engine
from src.database.models import Agent, Model, VertexConfig
from src.utils.constants import (
    GOOGLE_CLOUD_LOCATION,
    GOOGLE_CLOUD_PROJECT,
    VERTEX_STAGING_BUCKET,
)
from src.utils.secrets import decrypt_secret

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
REQUIREMENTS_FILE = (
    PROJECT_ROOT / "vertex_requirements.txt"
    if (PROJECT_ROOT / "vertex_requirements.txt").exists()
    else PROJECT_ROOT / "requirements.txt"
)
VertexEnvVars = dict[str, str | SecretRef]
EXTRA_PACKAGES_DIR = PROJECT_ROOT / ".vertex_extra_packages"


class _VertexRuntimeConfig:
    def __init__(
        self,
        *,
        project_id: str | None,
        location: str | None,
        staging_bucket: str | None,
        service_account_json: str | None,
    ):
        self.project_id = project_id
        self.location = location
        self.staging_bucket = staging_bucket
        self.service_account_json = service_account_json


def _load_vertex_runtime_config() -> _VertexRuntimeConfig:
    with Session(engine) as db_session:
        config = db_session.exec(
            select(VertexConfig).where(VertexConfig.id == 1)
        ).first()
    if config is not None:
        return _VertexRuntimeConfig(
            project_id=config.project_id,
            location=config.location,
            staging_bucket=config.staging_bucket,
            service_account_json=decrypt_secret(config.service_account_json)
            if config.service_account_json
            else None,
        )
    return _VertexRuntimeConfig(
        project_id=GOOGLE_CLOUD_PROJECT,
        location=GOOGLE_CLOUD_LOCATION,
        staging_bucket=VERTEX_STAGING_BUCKET,
        service_account_json=None,
    )


def _build_vertex_credentials(config: _VertexRuntimeConfig):
    if config.service_account_json:
        credentials = service_account.Credentials.from_service_account_info(
            json.loads(config.service_account_json)
        )
        return credentials.with_scopes(
            ["https://www.googleapis.com/auth/cloud-platform"]
        )
    return None


def _new_vertex_client(config: _VertexRuntimeConfig) -> Any:
    credentials = _build_vertex_credentials(config)
    cast(Any, vertexai).init(
        project=config.project_id,
        location=config.location,
        credentials=credentials,
    )
    return cast(Any, vertexai).Client(
        project=config.project_id, location=config.location, credentials=credentials
    )


def _persist_agent_state(session: Session, agent: Agent) -> bool:
    # Background reconcile can race with agent update/delete requests. If the
    # row disappears underneath us, treat that as a no-op instead of masking the
    # original deployment error with a stale ORM failure.
    try:
        session.add(agent)
        session.commit()
        session.refresh(agent)
        return True
    except StaleDataError:
        session.rollback()
        return False


def _ensure_vertex_config(config: _VertexRuntimeConfig) -> None:
    # Vertex deployment only works when project, location, and staging bucket
    # are configured in the environment.
    missing = [
        name
        for name, value in (
            ("GOOGLE_CLOUD_PROJECT", config.project_id),
            ("GOOGLE_CLOUD_LOCATION", config.location),
            ("VERTEX_STAGING_BUCKET", config.staging_bucket),
        )
        if not value
    ]
    if missing:
        raise ValueError("Missing Vertex configuration: " + ", ".join(sorted(missing)))


def _set_model_env_var(env_vars: VertexEnvVars, model_config: Model) -> None:
    # Vertex can use provider credentials from env vars at runtime.
    if not model_config.api_key:
        return

    # Prefer service-account auth for Google/Gemini on Vertex.
    if model_config.provider.lower() == "google":
        return

    decrypted_api_key = decrypt_secret(model_config.api_key)
    if model_config.provider.upper() == "BEDROCK":
        env_vars["AWS_BEARER_TOKEN_BEDROCK"] = decrypted_api_key
    else:
        env_vars[f"{model_config.provider.upper()}_API_KEY"] = decrypted_api_key


def _build_runtime_env_vars(session: Session, agent: Agent) -> VertexEnvVars:
    # These env vars are packaged with the deployed Vertex agent so it can
    # authenticate to non-Google model providers at runtime.
    env_vars: VertexEnvVars = {}
    # Prefer Vertex-backed auth for Gemini when running inside Vertex Agent Engine.
    # Note: Vertex Agent Engine reserves some env var names (including
    # GOOGLE_CLOUD_PROJECT), so avoid injecting project/location here.
    env_vars["GOOGLE_GENAI_USE_VERTEXAI"] = "true"
    env_vars["GOOGLE_GENAI_USE_ENTERPRISE"] = "TRUE"

    primary_model, fallback_models = resolve_model_stack(session, agent)
    for model in [primary_model, *fallback_models]:
        if model is not None:
            _set_model_env_var(env_vars, model)
    return env_vars


def _build_local_agent(agent: Agent):
    # Build the same ADK agent object locally first, then hand that object to
    # Vertex Agent Engine for deployment.
    runtime_agent = DatabaseAgentLoader().load_agent(agent.agent_id, allow_non_adk=True)
    if runtime_agent is None:
        raise ValueError(f"Unable to build runtime agent for '{agent.agent_id}'")
    return runtime_agent


def _read_vertex_requirements() -> list[str]:
    return REQUIREMENTS_FILE.read_text(encoding="utf-8").splitlines()


def _build_connector_extra_package_wheel() -> Path:
    EXTRA_PACKAGES_DIR.mkdir(parents=True, exist_ok=True)
    stage_root = EXTRA_PACKAGES_DIR / f"connector-wheel-{uuid4().hex}"
    connectors_src = PROJECT_ROOT / "src" / "connectors"
    package_root = stage_root / "package"
    connectors_dst = package_root / "connectors"
    stage_root.mkdir(parents=True, exist_ok=True)
    shutil.copytree(connectors_src, connectors_dst, dirs_exist_ok=True)
    (package_root / "base_connector.py").write_text(
        "from connectors.base_connector import BaseConnector, connector_tool\n",
        encoding="utf-8",
    )
    (package_root / "pyproject.toml").write_text(
        "\n".join(
            [
                "[build-system]",
                'requires = ["setuptools>=61", "wheel"]',
                'build-backend = "setuptools.build_meta"',
                "",
                "[project]",
                'name = "vertex-connector-bundle"',
                'version = "0.0.1"',
                "",
                "[tool.setuptools]",
                'py-modules = ["base_connector"]',
                "",
                "[tool.setuptools.packages.find]",
                'where = ["."]',
                'include = ["connectors*"]',
            ]
        ),
        encoding="utf-8",
    )
    dist_dir = stage_root / "dist"
    subprocess.run(
        [
            sys.executable,
            "-m",
            "pip",
            "wheel",
            str(package_root),
            "--no-deps",
            "-w",
            str(dist_dir),
        ],
        check=True,
        cwd=PROJECT_ROOT,
    )
    wheels = sorted(dist_dir.glob("*.whl"))
    if not wheels:
        raise ValueError("Failed to build connector wheel for Vertex extra_packages")
    wheel_path = wheels[-1]
    root_wheel_path = PROJECT_ROOT / wheel_path.name
    shutil.copy2(wheel_path, root_wheel_path)
    _validate_connector_wheel(root_wheel_path)
    shutil.rmtree(stage_root, ignore_errors=True)
    return root_wheel_path


def _validate_connector_wheel(wheel_path: Path) -> None:
    if not wheel_path.exists():
        raise ValueError(f"Connector wheel not found: {wheel_path}")

    with zipfile.ZipFile(wheel_path) as whl:
        names = set(whl.namelist())
    if "base_connector.py" not in names:
        raise ValueError("Connector wheel is missing base_connector.py at wheel root")

    with tempfile.TemporaryDirectory() as temp_dir:
        install_target = Path(temp_dir) / "site"
        install_target.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            [
                sys.executable,
                "-m",
                "pip",
                "install",
                "--no-deps",
                "--target",
                str(install_target),
                str(wheel_path),
            ],
            check=True,
            cwd=PROJECT_ROOT,
        )
        subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "import sys; "
                    f"sys.path.insert(0, r'{install_target}'); "
                    "import base_connector"
                ),
            ],
            check=True,
            cwd=PROJECT_ROOT,
        )


def _resource_name_from_agent_engine(agent_engine: Any) -> str | None:
    api_resource = getattr(agent_engine, "api_resource", None)
    return (
        getattr(agent_engine, "resource_name", None)
        or getattr(agent_engine, "name", None)
        or getattr(api_resource, "name", None)
    )


def _select_matching_remote_agent(client: Any, agent: Agent):
    # If we do not have a saved resource name yet, try to find the most likely
    # remote agent by display name/description.
    display_name = agent.name or agent.agent_id
    description = agent.description
    matches = []
    for remote in client.agent_engines.list():
        api_resource = getattr(remote, "api_resource", None)
        if getattr(api_resource, "display_name", None) != display_name:
            continue
        if description and getattr(api_resource, "description", None) != description:
            continue
        matches.append(remote)

    if not matches:
        return None

    matches.sort(
        key=lambda remote: (
            getattr(getattr(remote, "api_resource", None), "update_time", None)
            or getattr(getattr(remote, "api_resource", None), "create_time", None)
            or ""
        ),
        reverse=True,
    )
    return matches[0]


def reconcile_remote_deployment_state(agent: Agent, session: Session) -> bool:
    # This is a recovery path for agents stuck in "deploying". It checks Vertex
    # to see whether the remote resource already exists, then updates the DB.
    if (agent.deployment_target or "internal").lower() != "vertex":
        return False
    if agent.vertex_deployment_status != "deploying":
        return False

    config = _load_vertex_runtime_config()
    _ensure_vertex_config(config)
    client = _new_vertex_client(config)

    remote = None
    if agent.vertex_resource_name:
        remote = client.agent_engines.get(name=_adk_resource_name(agent, config))
    else:
        remote = _select_matching_remote_agent(client, agent)

    resource_name = _resource_name_from_agent_engine(remote) if remote else None
    if not resource_name:
        return False

    agent.vertex_resource_name = resource_name
    agent.vertex_deployment_status = "deployed"
    agent.vertex_deployment_error = None
    return _persist_agent_state(session, agent)


def deploy_agent(agent: Agent, session: Session) -> None:
    # Deploy or update this agent on Vertex Agent Engine.
    agent_id = agent.agent_id
    runtime_config = _load_vertex_runtime_config()
    _ensure_vertex_config(runtime_config)
    client = _new_vertex_client(runtime_config)

    agent.vertex_deployment_status = "deploying"
    agent.vertex_deployment_error = None
    if not _persist_agent_state(session, agent):
        logger.warning(
            "Skipped Vertex deploy for agent %s because its database row changed",
            agent_id,
        )
        return

    connector_wheel: Path | None = None
    try:
        # Clear the local ADK cache so the agent is rebuilt fresh from the
        # current database config (model stack, tools, etc.) rather than
        # returning a stale cached object from a previous deployment.
        from src.agent_runtime.adk.cache import cache as adk_cache

        adk_cache.remove_agent(agent.agent_id)

        # First build the local ADK agent definition from database config.
        local_agent = _build_local_agent(agent)

        # Wrap the ADK agent in a deployable Vertex ADK app.
        remote_agent = agent_engines.AdkApp(
            agent=local_agent,
            app_name=agent.agent_id,
        )
        env_vars = cast(
            VertexEnvVars | None, _build_runtime_env_vars(session, agent) or None
        )
        # Vertex uses the staging bucket as temporary packaging/upload storage
        # during create/update.
        gcs_dir_name = f"agents/{agent.agent_id}-{uuid4().hex}"
        connector_wheel = _build_connector_extra_package_wheel()
        requirements = _read_vertex_requirements()
        requirements.append(connector_wheel.name)
        deploy_config = {
            "requirements": requirements,
            "display_name": agent.name or agent.agent_id,
            "description": agent.description,
            "gcs_dir_name": gcs_dir_name,
            "env_vars": env_vars,
            "staging_bucket": runtime_config.staging_bucket,
            "extra_packages": [connector_wheel.name],
        }

        if agent.vertex_resource_name:
            # Update the existing remote agent if we already know its resource.
            deployed = client.agent_engines.update(
                name=cast(str, agent.vertex_resource_name),
                agent=remote_agent,
                config=deploy_config,
            )
        else:
            # Otherwise create a brand new remote agent on Vertex.
            deployed = client.agent_engines.create(
                agent=remote_agent,
                config=deploy_config,
            )

        # Persist the remote resource name so future chat/update/delete calls
        # can address the same deployed Vertex agent.
        resource_name = _resource_name_from_agent_engine(deployed)
        if not resource_name:
            fallback_remote = _select_matching_remote_agent(client, agent)
            resource_name = (
                _resource_name_from_agent_engine(fallback_remote)
                if fallback_remote is not None
                else None
            )
        if not resource_name:
            raise ValueError("Vertex deployment did not return a resource name")

        agent.vertex_resource_name = resource_name
        agent.vertex_deployment_status = "deployed"
        agent.vertex_deployment_error = None
        if not _persist_agent_state(session, agent):
            logger.warning(
                "Vertex deploy finished for agent %s but its database row changed before persistence",
                agent_id,
            )
    except Exception as exc:
        session.rollback()
        logger.exception("Failed to deploy vertex agent %s", agent_id)
        agent.vertex_deployment_status = "failed"
        agent.vertex_deployment_error = str(exc)
        _persist_agent_state(session, agent)
        raise
    finally:
        if connector_wheel is not None:
            connector_wheel.unlink(missing_ok=True)


def cleanup_agent(agent: Agent) -> None:
    # Delete the remote Vertex agent when the local config is removed or disabled.
    if not agent.vertex_resource_name:
        return

    config = _load_vertex_runtime_config()
    _ensure_vertex_config(config)
    client = _new_vertex_client(config)
    # Force-delete to avoid 400s when the agent has child resources (e.g. sessions).
    client.agent_engines.delete(name=_adk_resource_name(agent, config), force=True)


def disable_agent(agent: Agent, session: Session) -> None:
    # Disabling a Vertex agent means deleting the remote deployment and marking
    # the local record as disabled for runtime purposes.
    if agent.vertex_resource_name:
        cleanup_agent(agent)

    agent.vertex_resource_name = None
    agent.vertex_deployment_status = "disabled"
    agent.vertex_deployment_error = None
    _persist_agent_state(session, agent)


async def invoke_agent(agent: Agent, prompt: str):
    # One-off invoke uses the same chat path, but without a caller-managed session.
    events, _session_id = await chat_agent(
        agent,
        prompt,
        session_id=None,
        user_id="anonymous",
    )
    return events


async def create_session(agent: Agent, *, user_id: str) -> str:
    # Sessions are created on the remote Vertex ADK app, not locally.
    config = _load_vertex_runtime_config()
    _ensure_vertex_config(config)
    client = _new_vertex_client(config)
    adk_app = client.agent_engines.get(name=_adk_resource_name(agent, config))
    session = await adk_app.async_create_session(user_id=user_id)
    session_id = getattr(session, "id", None) or session.get("id")
    if not isinstance(session_id, str) or not session_id:
        raise ValueError("Vertex ADK session creation did not return a session id")
    return session_id


async def list_sessions(agent: Agent, *, user_id: str) -> list[dict[str, Any]]:
    # Normalize the Vertex SDK response into plain dicts for the API layer.
    config = _load_vertex_runtime_config()
    _ensure_vertex_config(config)
    client = _new_vertex_client(config)
    adk_app = client.agent_engines.get(name=_adk_resource_name(agent, config))
    response = await adk_app.async_list_sessions(user_id=user_id)
    sessions = response["sessions"] if isinstance(response, dict) else response.sessions
    return [
        dict(session) if isinstance(session, dict) else session.model_dump()
        for session in sessions
    ]


async def get_session(agent: Agent, *, user_id: str, session_id: str) -> dict[str, Any]:
    # Fetch one remote session from the deployed Vertex app.
    config = _load_vertex_runtime_config()
    _ensure_vertex_config(config)
    client = _new_vertex_client(config)
    adk_app = client.agent_engines.get(name=_adk_resource_name(agent, config))
    session = await adk_app.async_get_session(user_id=user_id, session_id=session_id)
    return session


async def delete_session(agent: Agent, *, user_id: str, session_id: str) -> None:
    # Remove one remote session from the deployed Vertex app.
    config = _load_vertex_runtime_config()
    _ensure_vertex_config(config)
    client = _new_vertex_client(config)
    adk_app = client.agent_engines.get(name=_adk_resource_name(agent, config))
    await adk_app.async_delete_session(user_id=user_id, session_id=session_id)


def _adk_resource_name(agent: Agent, config: _VertexRuntimeConfig) -> str:
    # Accept either a full Vertex resource path or a bare resource id from DB.
    if not agent.vertex_resource_name:
        raise ValueError(f"Agent '{agent.agent_id}' is not deployed on Vertex")
    resource_name = cast(str, agent.vertex_resource_name)
    if resource_name.startswith("projects/"):
        return resource_name
    return (
        f"projects/{config.project_id}/locations/"
        f"{config.location}/reasoningEngines/{resource_name}"
    )


async def chat_agent(
    agent: Agent,
    prompt: str,
    session_id: str | None = None,
    *,
    user_id: str,
):
    # Send one chat message to the already-deployed Vertex ADK app and stream
    # back the raw events produced by the model/tools.
    config = _load_vertex_runtime_config()
    _ensure_vertex_config(config)
    client = _new_vertex_client(config)
    adk_app = client.agent_engines.get(name=_adk_resource_name(agent, config))

    # Vertex session state is keyed by user_id, so callers must be stable here.
    if session_id is None:
        session_id = await create_session(agent, user_id=user_id)

    # Reuse the same session id to keep multi-turn conversation state.
    events = []
    async for event in adk_app.async_stream_query(
        user_id=user_id,
        session_id=session_id,
        message=prompt,
    ):
        events.append(event)
    return events, session_id

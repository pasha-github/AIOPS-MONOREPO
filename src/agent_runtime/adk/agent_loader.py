import logging
import os
from typing import Any
from uuid import UUID

from google.adk.agents import LlmAgent, LoopAgent
from google.adk.cli.utils.base_agent_loader import BaseAgentLoader
from google.adk.models.lite_llm import LiteLlm
from google.adk.tools.agent_tool import AgentTool
from google.adk.tools.mcp_tool import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import (
    SseConnectionParams,
    StreamableHTTPConnectionParams,
)
from google.adk.tools.tool_context import ToolContext
from sqlmodel import Session, select

from src.agent_runtime.adk.cache import cache
from src.connectors.loader import resolve_connector_tools
from src.database.database import engine
from src.database.models import Agent, ConnectorConfig, Model, ModelDefaults
from src.utils.secrets import decrypt_secret

logger = logging.getLogger(__name__)


def _litellm_model_name(model_config: Model) -> str:
    if model_config.provider.lower() == "google":
        return f"gemini/{model_config.name}"
    return f"{model_config.provider}/{model_config.name}"


def _set_model_env(model_config: Model):
    if not model_config.api_key:
        return

    decrypted_api_key = decrypt_secret(model_config.api_key)
    if model_config.provider.upper() == "BEDROCK":
        os.environ["AWS_BEARER_TOKEN_BEDROCK"] = decrypted_api_key
    else:
        os.environ[f"{model_config.provider.upper()}_API_KEY"] = decrypted_api_key


def _resolve_model_stack(
    session: Session,
    agent_config: Agent,
) -> tuple[Model | None, list[Model]]:
    defaults = session.get(ModelDefaults, 1)

    def _resolve_slot(
        use_global: bool,
        explicit_model_id: str | None,
        default_model_id: str | None,
    ) -> Model | None:
        model_id = default_model_id if use_global else explicit_model_id
        if model_id is None:
            return None
        return session.get(Model, model_id)

    primary_model = _resolve_slot(
        agent_config.primary_use_global,
        agent_config.primary_model_id,
        defaults.primary_model_id if defaults else None,
    )
    secondary_model = _resolve_slot(
        agent_config.secondary_use_global,
        agent_config.secondary_model_id,
        defaults.secondary_model_id if defaults else None,
    )
    tertiary_model = _resolve_slot(
        agent_config.tertiary_use_global,
        agent_config.tertiary_model_id,
        defaults.tertiary_model_id if defaults else None,
    )
    fallbacks = [
        model for model in (secondary_model, tertiary_model) if model is not None
    ]
    return primary_model, fallbacks


class DatabaseAgentLoader(BaseAgentLoader):
    def __init__(self):
        super().__init__()

    def list_agents(self) -> list[str]:
        """Lists the names of enabled agents from the database."""
        with Session(engine) as session:
            statement = select(Agent.agent_id).where(Agent.isEnabled)
            results = session.exec(statement).all()
            return list(results)

    def load_agent(self, agent_name: str) -> Any | None:
        """Loads an agent configuration from the database, initializes it, and returns it."""

        # Check cache first
        cached_agent = cache.get_agent(agent_name)
        if cached_agent:
            return cached_agent

        with Session(engine) as session:
            # Fetch agent config
            statement = select(Agent).where(Agent.agent_id == agent_name)
            agent_config = session.exec(statement).first()

            if not agent_config:
                logger.warning(f"Agent {agent_name} not found in database.")
                return None

            if not agent_config.isEnabled:
                logger.warning(f"Agent {agent_name} is disabled.")
                return None

            model_config, fallback_model_configs = _resolve_model_stack(
                session, agent_config
            )
            if not model_config:
                logger.error(f"Primary model for agent {agent_name} not found.")
                return None

            # Initialize Model (LiteLLM)
            # Assuming LlmAgent takes model name/config.
            # We might need to set env vars for keys or pass them explicitly if supported.
            # For now, we'll assume LlmAgent handles it or we set it globally/contextually.
            # LiteLLM usually reads from env, so we might need to set os.environ temporarily or globally.
            _set_model_env(model_config)
            for fallback_model in fallback_model_configs:
                _set_model_env(fallback_model)

            # Prepare Tools List
            tools_list = []

            # Attach Custom Python Tools
            if agent_config.tools:
                try:
                    # Execute the tool code to define functions
                    # This is dangerous in production but accepted per requirements
                    local_scope = {}
                    exec(agent_config.tools, {}, local_scope)

                    # Iterate and add callables to tools_list
                    for _, func in local_scope.items():
                        if callable(func):
                            tools_list.append(func)
                except Exception as e:
                    logger.error(f"Error loading tools for agent {agent_name}: {e}")

            # Attach MCP Tools
            if agent_config.mcp_servers:
                for url in agent_config.mcp_servers:
                    try:
                        if url.endswith("/sse"):
                            connection_params = SseConnectionParams(url=url)
                        elif url.endswith("/mcp"):
                            connection_params = StreamableHTTPConnectionParams(url=url)
                        else:
                            raise ValueError(f"Invalid MCP server URL: {url}")

                        mcp_toolset = McpToolset(connection_params=connection_params)
                        tools_list.append(mcp_toolset)
                    except Exception as e:
                        logger.error(
                            f"Error loading MCP tool '{url}' for agent {agent_name}: {e}"
                        )

            if agent_config.connector_config_ids:
                for connector_config_id in agent_config.connector_config_ids:
                    try:
                        connector_config: ConnectorConfig | None = session.get(
                            ConnectorConfig, UUID(connector_config_id)
                        )
                        if connector_config is None:
                            raise ValueError(
                                f"Connector config '{connector_config_id}' not found."
                            )
                        connector_tools = resolve_connector_tools(connector_config)
                        tools_list.extend(connector_tools)
                    except Exception as e:
                        logger.error(
                            f"Error loading connector config '{connector_config_id}' for agent {agent_name}: {e}"
                        )

            # Attach Sub Agents
            sub_agents = []
            loaded_sub_agent_ids = set()
            if agent_config.sub_agents:
                for sub_agent_id in agent_config.sub_agents:
                    # Skip self-references and duplicates
                    if (
                        sub_agent_id == agent_name
                        or sub_agent_id in loaded_sub_agent_ids
                    ):
                        continue
                    try:
                        # TODO: Remove recursive call
                        sub_agent = self.load_agent(sub_agent_id)
                        if sub_agent:
                            sub_agents.append(AgentTool(agent=sub_agent))
                            loaded_sub_agent_ids.add(sub_agent_id)
                    except Exception as e:
                        logger.error(
                            f"Error loading sub agent config '{sub_agent_id}' for agent {agent_name}: {e}"
                        )

            tools_list.extend(sub_agents)

            model_name = _litellm_model_name(model_config)
            fallbacks = [
                _litellm_model_name(fallback_model)
                for fallback_model in fallback_model_configs
            ]

            model = LiteLlm(
                model=model_name,
                fallbacks=fallbacks,
                num_retries=0,
                timeout=60,
            )

            # Create LlmAgent
            if agent_config.type.lower() == "automation":
                # --- Tool Definition ---
                def exit_loop(tool_context: ToolContext):
                    """Call this function ONLY when the tasks are completed and no further changes are needed, signaling the iterative process should end."""
                    logger.info(
                        f"  [Tool Call] exit_loop triggered by {tool_context.agent_name}"
                    )
                    tool_context.actions.escalate = True
                    tool_context.actions.skip_summarization = True
                    # Return empty dict as tools should typically return JSON-serializable output
                    return {}

                core_automation_agent = LlmAgent(
                    model=model,
                    name="core_automation_agent",
                    description=agent_config.description,
                    instruction=agent_config.instruction,
                    tools=[exit_loop, *tools_list],
                    sub_agents=[],
                )
                agent = LoopAgent(
                    name=agent_config.agent_id,
                    description="Agent for looping automation agents",
                    sub_agents=[core_automation_agent],
                    max_iterations=3,
                )

            else:
                agent = LlmAgent(
                    model=model,
                    name=agent_config.agent_id,
                    description=agent_config.description,
                    instruction=agent_config.instruction,
                    tools=tools_list,
                    sub_agents=[],
                )
            # Store in cache
            cache.set_agent(agent_name, agent)

            return agent

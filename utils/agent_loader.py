import logging
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

from database.database import engine
from database.models import Agent, ConnectorConfig, Model
from utils.cache import cache
from utils.helper import resolve_connector_tools
from utils.secrets import decrypt_secret
from utils.session_summary import make_session_summary_callback

logger = logging.getLogger(__name__)


def _build_summarizer_model(provider: str, model_name: str) -> str:
    if provider.lower() == "google":
        return f"gemini/{model_name}"
    return f"{provider}/{model_name}"


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

            # Fetch model config
            model_config = session.get(Model, agent_config.model_id)
            if not model_config:
                logger.error(
                    f"Model {agent_config.model_id} for agent {agent_name} not found."
                )
                return None

            # Initialize Model (LiteLLM)
            # Assuming LlmAgent takes model name/config.
            # We might need to set env vars for keys or pass them explicitly if supported.
            # For now, we'll assume LlmAgent handles it or we set it globally/contextually.
            # LiteLLM usually reads from env, so we might need to set os.environ temporarily or globally.
            import os

            if model_config.api_key:
                decrypted_api_key = decrypt_secret(model_config.api_key)
                # This is a simple way, might strictly need to be scoped if multiple providers
                if model_config.provider.upper() == "BEDROCK":
                    os.environ["AWS_BEARER_TOKEN_BEDROCK"] = decrypted_api_key
                else:
                    os.environ[f"{model_config.provider.upper()}_API_KEY"] = (
                        decrypted_api_key
                    )

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
                        connector_config = session.get(
                            ConnectorConfig, UUID(connector_config_id)
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

            summary_callback = make_session_summary_callback(
                _build_summarizer_model(model_config.provider, model_config.name)
            )

            if model_config.provider.lower() == "google":
                model = model_config.name
            else:
                model = LiteLlm(model=f"{model_config.provider}/{model_config.name}")

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
                    before_model_callback=summary_callback,
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
                    before_model_callback=summary_callback,
                )
            # Store in cache
            cache.set_agent(agent_name, agent)

            return agent

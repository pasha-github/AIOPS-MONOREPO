from typing import List, Optional, Dict, Any, Union
from google.adk.tools.mcp_tool import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import SseConnectionParams, StreamableHTTPConnectionParams
from google.adk.cli.utils.base_agent_loader import BaseAgentLoader
from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from sqlmodel import select
from database.database import get_session, engine
from database.models import Agent, Model, ConnectorConfig
from utils.cache import cache
from sqlmodel import Session
from utils.helper import resolve_connector_tools
import logging
from uuid import UUID


logger = logging.getLogger(__name__)

class DatabaseAgentLoader(BaseAgentLoader):
    def __init__(self):
        super().__init__()

    def list_agents(self) -> List[str]:
        """Lists the names of enabled agents from the database."""
        with Session(engine) as session:
            statement = select(Agent.agent_id).where(Agent.isEnabled == True)
            results = session.exec(statement).all()
            return list(results)

    def load_agent(self, agent_name: str) -> Optional[Any]:
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
                logger.error(f"Model {agent_config.model_id} for agent {agent_name} not found.")
                return None

            # Initialize Model (LiteLLM)
            # Assuming LlmAgent takes model name/config. 
            # We might need to set env vars for keys or pass them explicitly if supported.
            # For now, we'll assume LlmAgent handles it or we set it globally/contextually.
            # LiteLLM usually reads from env, so we might need to set os.environ temporarily or globally.
            import os
            if model_config.api_key:
                 # This is a simple way, might strictly need to be scoped if multiple providers
                os.environ[f"{model_config.provider.upper()}_API_KEY"] = model_config.api_key
            
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
                    for name, func in local_scope.items():
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
                        logger.error(f"Error loading MCP tool '{url}' for agent {agent_name}: {e}")

            if agent_config.connector_config_ids:
                for connector_config_id in agent_config.connector_config_ids:
                    try:
                        connector_config = session.get(ConnectorConfig, UUID(connector_config_id))
                        connector_tools = resolve_connector_tools(connector_config)
                        tools_list.extend(connector_tools)
                    except Exception as e:
                        logger.error(f"Error loading connector config '{connector_config_id}' for agent {agent_name}: {e}")

            # Attach Sub Agents
            sub_agents = []
            loaded_sub_agent_ids = set()
            if agent_config.sub_agents:
                for sub_agent_id in agent_config.sub_agents:
                    # Skip self-references and duplicates
                    if sub_agent_id == agent_name or sub_agent_id in loaded_sub_agent_ids:
                        continue
                    try:
                        sub_agent = self.load_agent(sub_agent_id)
                        if sub_agent:
                            sub_agents.append(sub_agent)
                            loaded_sub_agent_ids.add(sub_agent_id)
                    except Exception as e:
                        logger.error(f"Error loading sub agent config '{sub_agent_id}' for agent {agent_name}: {e}")


            # Create LlmAgent
            print(tools_list)
            if model_config.provider.lower() == "google":
                agent = LlmAgent(
                    model=model_config.name, # Using google's default
                    name=agent_config.agent_id,
                    description=agent_config.description,
                    instruction=agent_config.instruction,
                    tools=tools_list,
                    sub_agents=sub_agents,
                )
                
            else:
                agent = LlmAgent(
                    model=LiteLlm(model=f"{model_config.provider}/{model_config.name}"), # Passing model name to LiteLLM
                    name=agent_config.agent_id,
                    description=agent_config.description,
                    instruction=agent_config.instruction,
                    tools=tools_list,
                    sub_agents=sub_agents,
                )

            # Store in cache
            cache.set_agent(agent_name, agent)
            
            return agent

from typing import List, Optional, Dict, Any, Union
from google.adk.cli.utils.base_agent_loader import BaseAgentLoader
from google.adk.agents import LlmAgent
from sqlmodel import select
from database import get_session, engine
from models import Agent, Model
from cache import cache
from sqlmodel import Session
import logging

logger = logging.getLogger(__name__)

class DatabaseAgentLoader(BaseAgentLoader):
    def __init__(self):
        super().__init__()

    def list_agents(self) -> List[str]:
        """Lists the names of enabled agents from the database."""
        with Session(engine) as session:
            statement = select(Agent.name).where(Agent.isEnabled == True)
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
            statement = select(Agent).where(Agent.name == agent_name)
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
            
            # Create LlmAgent
            agent = LlmAgent(
                name=agent_config.name,
                description=agent_config.description,
                instruction=agent_config.instruction,
                model=model_config.name, # Passing model name to LiteLLM
            )

            # Attach Tools (Python functions)
            if agent_config.tools:
                try:
                    # Execute the tool code to define functions
                    # This is dangerous in production but accepted per requirements
                    local_scope = {}
                    exec(agent_config.tools, {}, local_scope)
                    
                    # Assume tools are functions in local_scope
                    # adk might have a specific way to attach tools, e.g., agent.add_tool()
                    # For now, we will iterate and add callables
                    for name, func in local_scope.items():
                        if callable(func):
                             # Verify if adk supports add_tool or we pass in constructor
                             # If constructor, we'd need to change instantiation above.
                             # Checking LlmAgent signature (from memory/docs), it often takes `tools` list.
                             # If dynamic execution is needed, we might need to recreate agent or use setter.
                             # Assuming a method exists or we can pass to LlmAgent
                             pass 
                             # TODO: implementations detail on how to attach tools to LlmAgent
                except Exception as e:
                    logger.error(f"Error loading tools for agent {agent_name}: {e}")

            # Attach MCP Config
            if agent_config.mcp_server_sse_config:
                # TODO: Implement MCP Client attachment
                pass

            # Store in cache
            cache.set_agent(agent_name, agent)
            
            return agent

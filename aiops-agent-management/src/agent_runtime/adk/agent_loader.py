import logging
import os
from typing import Any, cast
from uuid import UUID

from google.adk.agents import LlmAgent, LoopAgent
from google.adk.cli.utils.base_agent_loader import BaseAgentLoader
from google.adk.code_executors.unsafe_local_code_executor import UnsafeLocalCodeExecutor
from google.adk.models import Gemini
from google.adk.models.lite_llm import LiteLlm
from google.adk.tools.agent_tool import AgentTool
from google.adk.tools.load_memory_tool import LoadMemoryTool
from google.adk.tools.mcp_tool import McpToolset
from google.adk.tools.skill_toolset import SkillToolset
from google.adk.tools.tool_context import ToolContext
from sqlmodel import Session, select

from src.agent_runtime.adk.cache import cache
from src.agent_runtime.model_stack import resolve_model_stack
from src.connectors.loader import resolve_connector_tools
from src.database.database import engine
from src.database.models import Agent, ConnectorConfig, MCPServer, Model, Skill
from src.skills.runtime import build_skill_model
from src.utils.mcp import build_mcp_auth_headers, build_mcp_connection_params
from src.utils.secrets import decrypt_secret

logger = logging.getLogger(__name__)


def compile_instruction(agent: Any) -> str:
    sections = [
        ("prompt_role", "# Role"),
        ("prompt_objectives", "# Objectives"),
        ("prompt_behavior", "# Behavior"),
        ("prompt_output_format", "# Output Format"),
        ("prompt_constraints", "# Constraints"),
        ("prompt_safety", "# Safety"),
        ("prompt_tools_instructions", "# Tools"),
        ("prompt_policy", "# Policy"),
        ("prompt_examples", "# Examples"),
    ]
    parts = []
    for field, heading in sections:
        value = getattr(agent, field, None)
        if value:
            parts.append(f"{heading}\n{value}")

    prompt = "\n\n".join(parts) if parts else (agent.instruction or "")

    additional = getattr(agent, "prompt_additional_info", None)
    if additional:
        prompt += f"\n\n# Additional Info\n{additional}"

    logger.info(
        "\n%s\nCOMPILED PROMPT [%s]\n%s\n%s\n%s",
        "=" * 60,
        getattr(agent, "name", agent),
        "=" * 60,
        prompt,
        "=" * 60,
    )

    return prompt


def _tool_names(tools: list[Any]) -> list[str]:
    names = []
    for tool in tools:
        names.append(getattr(tool, "name", getattr(tool, "__name__", repr(tool))))
    return names


def _append_mcp_tool(
    tools_list: list[Any],
    *,
    url: str,
    auth_type: str = "none",
    auth_username: str | None = None,
    auth_secret: str | None = None,
):
    headers = build_mcp_auth_headers(
        auth_type,
        bearer_token=auth_secret if auth_type == "bearer" else None,
        username=auth_username if auth_type == "basic" else None,
        password=auth_secret if auth_type == "basic" else None,
    )
    connection_params = build_mcp_connection_params(url, headers=headers)
    try:
        tools_list.append(
            McpToolset(connection_params=connection_params, errlog=cast(Any, None))
        )
    except TypeError:
        # Backward compatibility for MCP tool constructors/mocks that don't
        # accept errlog yet.
        tools_list.append(McpToolset(connection_params=connection_params))


def _tool_name(tool: Any) -> str | None:
    return getattr(tool, "name", None) or getattr(tool, "__name__", None)


def _litellm_model_name(model_config: Model) -> str:
    # Normalize provider/model into the format LiteLLM expects.
    if model_config.provider.lower() == "google":
        return f"gemini/{model_config.name}"
    return f"{model_config.provider}/{model_config.name}"


def _set_model_env(model_config: Model):
    # Some model SDKs read credentials from environment variables.
    if not model_config.api_key:
        return

    decrypted_api_key = decrypt_secret(model_config.api_key)
    if model_config.provider.upper() == "BEDROCK":
        os.environ["AWS_BEARER_TOKEN_BEDROCK"] = decrypted_api_key
    else:
        os.environ[f"{model_config.provider.upper()}_API_KEY"] = decrypted_api_key

    extra = getattr(model_config, "extra_config", None) or {}
    if api_base := extra.get("api_base"):
        os.environ[f"{model_config.provider.upper()}_API_BASE"] = api_base


def _build_agent_callbacks(
    fallbacks: list,
    *,
    guardrail_enabled: bool = False,
    guardrails_config: dict | None = None,
) -> tuple:
    # Everything below is inlined so cloudpickle does not create a dependency
    # on the local `src` package when the agent is serialized for Vertex AI.
    _SUMMARY_KEY = "first_message_summary"
    _FALLBACKS_KEY = "summary_fallbacks"
    _FALLBACK_MAX_LEN = 120

    cfg = guardrails_config or {}
    pii_patterns = cfg.get("pii_patterns", [])
    sensitive_patterns = cfg.get("sensitive_patterns", [])
    harmful_keywords = cfg.get("harmful_keywords", [])

    def run_guardrails(text: str) -> str:
        import contextlib
        import re

        PII_REGEX = {
            "email": (
                r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}",
                re.IGNORECASE,
            ),
            "phone": (r"(\+?\d{1,3}[\s\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}", 0),
            "ssn": (r"\b\d{3}-\d{2}-\d{4}\b", 0),
            "credit_card": (r"\b(?:\d[ \-]?){13,19}\b", 0),
            "ip_address": (r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b", 0),
        }
        for name in pii_patterns:
            entry = PII_REGEX.get(name)
            if entry:
                text = re.sub(entry[0], "[REDACTED]", text, flags=entry[1])
        for pattern in sensitive_patterns:
            with contextlib.suppress(re.error):
                text = re.sub(pattern, "[REDACTED]", text)
        for keyword in harmful_keywords:
            with contextlib.suppress(re.error):
                text = re.sub(
                    r"\b" + re.escape(keyword) + r"\b",
                    "[CONTENT FILTERED]",
                    text,
                    flags=re.IGNORECASE,
                )
        return text

    async def before_agent_cb(callback_context: Any) -> None:
        if callback_context.state.get(_FALLBACKS_KEY):
            return None
        callback_context.state[_FALLBACKS_KEY] = fallbacks
        return None

    async def before_model_cb(callback_context: Any, llm_request: Any) -> None:
        # Guardrails run on every message — must be before the summary early-return.
        if guardrail_enabled:
            try:
                contents = getattr(llm_request, "contents", None) or []
                if contents:
                    latest = contents[-1]
                    if getattr(latest, "role", None) == "user":
                        for part in getattr(latest, "parts", []):
                            text = getattr(part, "text", None)
                            if text:
                                masked = run_guardrails(text)
                                logger.warning(
                                    "Guardrails before_model | original=%r masked=%r",
                                    text,
                                    masked,
                                )
                                part.text = masked
            except Exception:
                logger.exception("Guardrails before_model_cb failed — skipping")

        # Summary is only generated once (first message).
        if callback_context.state.get(_SUMMARY_KEY):
            return None

        # Extract the latest user message text.
        user_text = ""
        contents = getattr(llm_request, "contents", None) or []
        if contents:
            latest = contents[-1]
            if getattr(latest, "role", None) == "user":
                parts = []
                for part in getattr(latest, "parts", []):
                    text = getattr(part, "text", None)
                    if text:
                        parts.append(text.strip())
                user_text = " ".join(p for p in parts if p).strip()

        if not user_text:
            return None

        model = getattr(llm_request, "model", None) or ""
        import os

        if (
            model.startswith("gemini-")
            and os.environ.get("GOOGLE_API_KEY")
            and os.environ.get("GOOGLE_GENAI_USE_VERTEXAI", "").lower() != "true"
        ):
            summarizer: str | None = f"gemini/{model}"
        else:
            summarizer = model or None

        summary = ""
        if summarizer:
            try:
                import litellm

                sync_fallbacks = callback_context.state.get(_FALLBACKS_KEY, [])
                response = litellm.completion(
                    model=summarizer,
                    fallbacks=sync_fallbacks,
                    messages=[
                        {
                            "role": "system",
                            "content": (
                                "You will be given ONE user message. "
                                "Rewrite that message as a concise 3-6 word title, preserving the same intent and key terms. "
                                "Do NOT answer the question and do NOT add new facts. "
                                "Return ONLY the 3-6 word title."
                            ),
                        },
                        {"role": "user", "content": user_text},
                    ],
                    temperature=0.0,
                )
                content = response.choices[0].message.content  # type: ignore
                summary = content.strip() if isinstance(content, str) else ""
            except Exception as exc:
                logger.warning("Session summary callback failed: %s", exc)

        if not summary:
            # Fallback: truncate the raw user text to a short title.
            normalized = " ".join(user_text.split()).strip()
            if len(normalized) <= _FALLBACK_MAX_LEN:
                summary = normalized
            else:
                cutoff = normalized.rfind(" ", 0, _FALLBACK_MAX_LEN)
                summary = (
                    normalized[: cutoff if cutoff != -1 else _FALLBACK_MAX_LEN].rstrip()
                    + "..."
                )

        if summary:
            callback_context.state[_SUMMARY_KEY] = summary

        return None

    async def after_model_cb(callback_context: Any, llm_response: Any) -> None:
        if not guardrail_enabled:
            return None
        try:
            candidates = getattr(llm_response, "candidates", None) or []
            for candidate in candidates:
                content = getattr(candidate, "content", None)
                for part in getattr(content, "parts", []):
                    text = getattr(part, "text", None)
                    if text:
                        masked = run_guardrails(text)
                        logger.warning(
                            "Guardrails after_model | original=%r masked=%r",
                            text,
                            masked,
                        )
                        part.text = masked
        except Exception:
            logger.exception("Guardrails after_model_cb failed — skipping")
        return None

    async def after_agent_cb(callback_context: Any) -> None:
        # Save recent session events to Memory Bank after each turn so the
        # agent can recall past context in future sessions.
        import contextlib

        with contextlib.suppress(Exception):
            await callback_context.add_events_to_memory(
                events=callback_context.session.events,
                custom_metadata={"wait_for_completion": True},
            )
        return None

    return before_agent_cb, before_model_cb, after_model_cb, after_agent_cb


class DatabaseAgentLoader(BaseAgentLoader):
    def __init__(self):
        super().__init__()

    def list_agents(self) -> list[str]:
        """Lists the names of enabled agents from the database."""
        with Session(engine) as session:
            # Only local ADK agents should be exposed through the ADK loader.
            statement = select(Agent.agent_id).where(
                Agent.isEnabled,
                (Agent.deployment_target == "internal")
                | (Agent.deployment_target == "adk"),
            )
            results = session.exec(statement).all()
            return list(results)

    def load_agent(self, agent_name: str, allow_non_adk: bool = False) -> Any | None:
        """Loads an agent configuration from the database, initializes it, and returns it."""

        # Reuse the already-built runtime agent when possible.
        cached_agent = cache.get_agent(agent_name)
        if cached_agent:
            with Session(engine) as session:
                agent_config = session.exec(
                    select(Agent).where(Agent.agent_id == agent_name)
                ).first()
                if agent_config:
                    compiled = compile_instruction(agent_config)
                    logger.info(
                        "\n%s\nCOMPILED PROMPT (cached) [%s]\n%s\n%s\n%s",
                        "=" * 60,
                        agent_config.name,
                        "=" * 60,
                        compiled,
                        "=" * 60,
                    )
            return cached_agent

        with Session(engine) as session:
            # Pull the latest agent configuration from the database.
            statement = select(Agent).where(Agent.agent_id == agent_name)
            agent_config = session.exec(statement).first()

            if not agent_config:
                logger.warning(f"Agent {agent_name} not found in database.")
                return None

            if not agent_config.isEnabled:
                logger.warning(f"Agent {agent_name} is disabled.")
                return None

            deployment_target = (
                getattr(agent_config, "deployment_target", None) or "internal"
            ).lower()
            if deployment_target == "adk":
                deployment_target = "internal"
            if not allow_non_adk and deployment_target != "internal":
                logger.warning(
                    f"Agent {agent_name} is configured for "
                    f"{deployment_target}, not ADK."
                )
                return None

            # Models are resolved before tools so we can fail early on invalid config.
            model_config, fallback_model_configs = resolve_model_stack(
                session, agent_config
            )
            if not model_config:
                logger.error(f"Primary model for agent {agent_name} not found.")
                return None

            # Export credentials before building the model wrapper.
            _set_model_env(model_config)
            for fallback_model in fallback_model_configs:
                _set_model_env(fallback_model)

            # Collect every tool source into one flat list for the ADK agent.
            tools_list = []

            # Load inline Python tools stored on the agent record.
            if agent_config.tools:
                try:
                    # This executes database-provided code, so it is intentionally
                    # permissive and should be treated as trusted admin input.
                    local_scope = {}
                    exec(agent_config.tools, {}, local_scope)

                    # Any callable defined in that snippet becomes an ADK tool.
                    for _, func in local_scope.items():
                        if callable(func):
                            tools_list.append(func)
                except Exception as e:
                    logger.error(f"Error loading tools for agent {agent_name}: {e}")

            # Add MCP toolsets backed by remote MCP servers.
            if agent_config.mcp_servers:
                for url in agent_config.mcp_servers:
                    try:
                        _append_mcp_tool(tools_list, url=url)
                    except Exception as e:
                        logger.error(
                            f"Error loading MCP tool '{url}' for agent {agent_name}: {e}"
                        )

            if agent_config.mcp_server_ids:
                for mcp_server_id in agent_config.mcp_server_ids:
                    try:
                        mcp_server = session.get(MCPServer, UUID(mcp_server_id))
                        if mcp_server is None:
                            raise ValueError(f"MCP server '{mcp_server_id}' not found.")
                        auth_secret = (
                            decrypt_secret(mcp_server.auth_secret)
                            if mcp_server.auth_secret
                            else None
                        )
                        _append_mcp_tool(
                            tools_list,
                            url=mcp_server.server_url,
                            auth_type=mcp_server.auth_type,
                            auth_username=mcp_server.auth_username,
                            auth_secret=auth_secret,
                        )
                    except Exception as e:
                        logger.error(
                            f"Error loading MCP server '{mcp_server_id}' for agent {agent_name}: {e}"
                        )

            if agent_config.connector_config_ids:
                # Resolve connector configs into callable tools.
                for connector_config_id in agent_config.connector_config_ids:
                    try:
                        logger.info(
                            "Loading connector config for agent %s: config_id=%s",
                            agent_name,
                            connector_config_id,
                        )
                        connector_config: ConnectorConfig | None = session.get(
                            ConnectorConfig, UUID(connector_config_id)
                        )
                        if connector_config is None:
                            raise ValueError(
                                f"Connector config '{connector_config_id}' not found."
                            )
                        connector_tools = resolve_connector_tools(connector_config)
                        logger.info(
                            "Loaded connector config for agent %s: config_id=%s "
                            "connector_id=%s tool_names=%s",
                            agent_name,
                            connector_config_id,
                            connector_config.connector_id,
                            _tool_names(connector_tools),
                        )
                        tools_list.extend(connector_tools)
                    except Exception:
                        logger.exception(
                            "Error loading connector config %s for agent %s",
                            connector_config_id,
                            agent_name,
                        )

            if agent_config.skill_ids:
                skill_models = []
                skill_additional_tools: list[Any] = []
                additional_tool_names: set[str] = set()

                for skill_id in agent_config.skill_ids:
                    try:
                        skill = session.get(Skill, UUID(skill_id))
                        if skill is None:
                            raise ValueError(f"Skill '{skill_id}' not found.")

                        skill_models.append(build_skill_model(skill))
                        additional_tool_names.update(skill.tools or [])

                        for connector_config_id in skill.connector_config_ids or []:
                            connector_config = session.get(
                                ConnectorConfig, UUID(connector_config_id)
                            )
                            if connector_config is None:
                                raise ValueError(
                                    "Connector config "
                                    f"'{connector_config_id}' not found for skill."
                                )

                            connector_tools = resolve_connector_tools(connector_config)
                            for tool in connector_tools:
                                if _tool_name(tool) in additional_tool_names:
                                    skill_additional_tools.append(tool)

                        for mcp_server_id in skill.mcp_server_ids or []:
                            mcp_server = session.get(MCPServer, UUID(mcp_server_id))
                            if mcp_server is None:
                                raise ValueError(
                                    f"MCP server '{mcp_server_id}' not found for skill."
                                )
                            auth_secret = (
                                decrypt_secret(mcp_server.auth_secret)
                                if mcp_server.auth_secret
                                else None
                            )
                            headers = build_mcp_auth_headers(
                                mcp_server.auth_type,
                                bearer_token=auth_secret
                                if mcp_server.auth_type == "bearer"
                                else None,
                                username=mcp_server.auth_username
                                if mcp_server.auth_type == "basic"
                                else None,
                                password=auth_secret
                                if mcp_server.auth_type == "basic"
                                else None,
                            )
                            connection_params = build_mcp_connection_params(
                                mcp_server.server_url,
                                headers=headers,
                            )
                            skill_additional_tools.append(
                                McpToolset(connection_params=connection_params)
                            )
                    except Exception as e:
                        logger.error(
                            f"Error loading skill '{skill_id}' for agent {agent_name}: {e}"
                        )

                if skill_models:
                    tools_list.append(
                        cast(Any, SkillToolset)(
                            skills=skill_models,
                            code_executor=UnsafeLocalCodeExecutor(),
                            additional_tools=skill_additional_tools,
                        )
                    )

            # Wrap sub-agents as tools so the main agent can call them.
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
                        # Recursive loading is the current way sub-agents are built.
                        sub_agent = self.load_agent(
                            sub_agent_id,
                            allow_non_adk=allow_non_adk,
                        )
                        if sub_agent:
                            sub_agents.append(AgentTool(agent=sub_agent))
                            loaded_sub_agent_ids.add(sub_agent_id)
                    except Exception as e:
                        logger.error(
                            f"Error loading sub agent config '{sub_agent_id}' for agent {agent_name}: {e}"
                        )

            tools_list.extend(sub_agents)

            memory_enabled = getattr(agent_config, "memory_enabled", False)
            memory_tool_type = getattr(agent_config, "memory_tool_type", None) or "load"
            if memory_enabled:
                if memory_tool_type == "preload":
                    from google.adk.tools.preload_memory_tool import PreloadMemoryTool

                    tools_list.append(PreloadMemoryTool())
                else:
                    tools_list.append(LoadMemoryTool())

            logger.info(
                "Agent %s assembled tools: count=%s tool_names=%s",
                agent_name,
                len(tools_list),
                _tool_names(tools_list),
            )

            model_name = _litellm_model_name(model_config)
            fallbacks = [
                _litellm_model_name(fallback_model)
                for fallback_model in fallback_model_configs
            ]

            extra = getattr(model_config, "extra_config", None) or {}
            litellm_kwargs: dict = {
                "model": model_name,
                "fallbacks": fallbacks,
                "num_retries": 0,
                "timeout": 60,
            }
            if api_base := extra.get("api_base"):
                litellm_kwargs["api_base"] = api_base

            _guardrail_on = getattr(agent_config, "guardrail_sensitive_data", False)
            before_agent_cb, before_model_cb, after_model_cb, after_agent_cb = (
                _build_agent_callbacks(
                    fallbacks,
                    guardrail_enabled=_guardrail_on,
                    guardrails_config=getattr(agent_config, "guardrails_config", None),
                )
            )
            after_cb = after_agent_cb if memory_enabled else None

            if deployment_target in {"vertex", "bedrock_agentcore"}:
                # Managed runtimes use ADK's native Gemini model for Google providers
                # to avoid LiteLLM response-shape issues during tool calls.
                if model_config.provider.lower() == "google":
                    model = Gemini(model=model_config.name)
                else:
                    model = LiteLlm(**litellm_kwargs)
            else:
                # Local ADK runtime uses LiteLLM consistently.
                model = LiteLlm(**litellm_kwargs)

            # Automation agents are wrapped in a loop controller; normal agents
            # are a single LlmAgent.
            if agent_config.type.lower() == "automation":
                # --- Tool Definition ---
                def exit_loop(tool_context: ToolContext):
                    """Call this function ONLY when the tasks are completed and no further changes are needed, signaling the iterative process should end."""
                    logger.info(
                        f"  [Tool Call] exit_loop triggered by {tool_context.agent_name}"
                    )
                    tool_context.actions.escalate = True
                    tool_context.actions.skip_summarization = True
                    # Return JSON-serializable output because ADK tools expect it.
                    return {}

                core_automation_agent = LlmAgent(
                    model=model,
                    name="core_automation_agent",
                    description=agent_config.description,
                    instruction=compile_instruction(agent_config),
                    tools=[exit_loop, *tools_list],
                    sub_agents=[],
                    before_agent_callback=before_agent_cb,
                    before_model_callback=before_model_cb,
                    after_model_callback=after_model_cb,
                    after_agent_callback=after_cb,
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
                    instruction=compile_instruction(agent_config),
                    tools=tools_list,
                    sub_agents=[],
                    before_agent_callback=before_agent_cb,
                    before_model_callback=before_model_cb,
                    after_model_callback=after_model_cb,
                    after_agent_callback=after_cb,
                )
            # Cache the built runtime object so later requests can reuse it.
            cache.set_agent(agent_name, agent)

            return agent

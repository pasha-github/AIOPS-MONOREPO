import json
import logging
import pathlib

from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from pydantic import BaseModel
from sqlmodel import Session, select

from src.database.models import ConnectorConfig, MCPServer, Model, ModelDefaults, Skill

logger = logging.getLogger(__name__)


class OrchestratorOutput(BaseModel):
    name: str
    description: str
    prompt_role: str
    prompt_objectives: str
    prompt_behavior: str
    prompt_output_format: str
    prompt_constraints: str
    prompt_safety: str
    prompt_tools_instructions: str
    prompt_policy: str
    prompt_examples: str | None = None
    prompt_additional_info: str | None = None
    connector_config_ids: list[str]
    mcp_server_ids: list[str]
    skill_ids: list[str]


class OrchestratorPatchOutput(BaseModel):
    name: str
    description: str
    prompt_role: str | None = None
    prompt_objectives: str | None = None
    prompt_behavior: str | None = None
    prompt_output_format: str | None = None
    prompt_constraints: str | None = None
    prompt_safety: str | None = None
    prompt_tools_instructions: str | None = None
    prompt_policy: str | None = None
    prompt_examples: str | None = None
    prompt_additional_info: str | None = None
    connector_config_ids: list[str]
    mcp_server_ids: list[str]
    skill_ids: list[str]


CREATE_INSTRUCTION = """You are an agent configuration generator.

Given a user description and a list of available connectors and MCP servers, generate a complete agent configuration.

Fields to fill:
- name: Human-readable name for the agent. Use only letters, spaces, and numbers — no special characters like &, /, -, (, ) etc.
- description: 1-2 sentence summary of what the agent does
- prompt_role: Who the agent is — its persona and identity (e.g. 'You are a DevOps monitoring agent...')
- prompt_objectives: Numbered list of what the agent must accomplish
- prompt_behavior: Tone, style, and how the agent interacts with users
- prompt_output_format: How the agent should structure its responses
- prompt_constraints: What the agent must never do
- prompt_safety: Safety and ethics rules the agent must follow
- prompt_tools_instructions: Detailed instructions for every tool the agent has access to. For each recommended connector, list every tool by its exact name, explain when to call it, what arguments to pass, and what to do with the result. The agent depends entirely on this field to know how to use its tools.
- prompt_policy: Company or compliance policies the agent must follow
- prompt_examples: Few-shot examples if helpful, otherwise null
- prompt_additional_info: Any other relevant info, otherwise null
- connector_config_ids: Required. Copy the exact UUID strings (e.g. "9a1fe543-8e55-4ca8-818a-236d797d08e0") from the Available Connector Configs list for connectors relevant to this agent. Use [] only if truly none are relevant. Never invent IDs.
- mcp_server_ids: Required. Copy the exact UUID strings from the Available MCP Servers list for servers relevant to this agent. Use [] if none are relevant. Never invent IDs.
- skill_ids: Required. Copy the exact UUID strings from the Available Skills list for skills relevant to this agent. Use [] if none are relevant. Never invent IDs.
"""

PATCH_INSTRUCTION = """You are an agent configuration generator.

You will be given an existing agent configuration and a user request describing what to change. Generate an updated configuration.

Fields (always include name and description; include other fields only if they need to change):
- name: Human-readable name. Use only letters, spaces, and numbers — no special characters like &, /, -, (, ) etc.
- description: 1-2 sentence summary
- prompt_role, prompt_objectives, prompt_behavior, prompt_output_format, prompt_constraints, prompt_safety, prompt_tools_instructions, prompt_policy, prompt_examples, prompt_additional_info
- connector_config_ids: Required. Start with existing IDs from current_config, then add the exact UUID strings from the Available Connector Configs list for any connectors the user's request mentions or implies. Never invent IDs.
- mcp_server_ids: Required. Same merge rule as connector_config_ids.
- skill_ids: Required. Start with existing IDs from current_config, then add the exact UUID strings from the Available Skills list for any skills the user's request mentions or implies. Never invent IDs.

Rules:
- Always include name and description — derive them from the updated role/purpose.
- Always include connector_config_ids — merge existing ones with any newly relevant connectors the user's request mentions or implies. Copy exact UUIDs from the available list.
- For prompt_tools_instructions: if included, describe ALL tools from both existing and newly added connectors.
- Only include prompt fields that the user's request asks to change or that are impacted by the change.
"""


def _load_connector_meta(connector_id: str) -> dict:
    meta_path = (
        pathlib.Path(__file__).resolve().parents[2]
        / "connectors"
        / connector_id
        / "metadata.json"
    )
    if meta_path.exists():
        try:
            return json.loads(meta_path.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def build_connector_context(session: Session) -> str:
    configs = session.exec(select(ConnectorConfig)).all()
    mcps = session.exec(select(MCPServer)).all()

    lines = ["Available Connector Configs:"]
    for c in configs:
        meta = _load_connector_meta(c.connector_id)
        tools_desc = " | ".join(
            f"{t['name']}: {t.get('documentation', '')}"
            for t in (meta.get("tools") or [])
        )
        line = f"- ID: {c.connector_config_id} | Name: {c.name}"
        if c.description:
            line += f" | Description: {c.description}"
        if tools_desc:
            line += f" | Tools: {tools_desc}"
        lines.append(line)

    lines.append("\nAvailable MCP Servers:")
    for m in mcps:
        line = f"- ID: {m.mcp_server_id} | Name: {m.name}"
        if m.description:
            line += f" | Description: {m.description}"
        else:
            line += f" | URL: {m.server_url}"
        lines.append(line)

    skills = session.exec(select(Skill)).all()
    lines.append("\nAvailable Skills:")
    for s in skills:
        line = f"- ID: {s.skill_id} | Name: {s.name} | Description: {s.description}"
        if s.tools:
            line += f" | Tools: {', '.join(s.tools)}"
        lines.append(line)

    return "\n".join(lines)


def _build_model(session: Session) -> LiteLlm:
    defaults = session.get(ModelDefaults, 1)

    def _get(model_id: str | None) -> Model | None:
        return session.get(Model, model_id) if model_id else None

    primary = _get(defaults.primary_model_id if defaults else None)
    secondary = _get(defaults.secondary_model_id if defaults else None)
    tertiary = _get(defaults.tertiary_model_id if defaults else None)

    def _model_name(m: Model) -> str:
        if m.provider.lower() == "google":
            return f"gemini/{m.name}"
        return f"{m.provider}/{m.name}"

    fallbacks = [_model_name(m) for m in [secondary, tertiary] if m is not None]
    model_name = _model_name(primary) if primary else "gemini/gemini-2.0-flash"

    return LiteLlm(model=model_name, fallbacks=fallbacks, timeout=60)


class SkillOrchestratorOutput(BaseModel):
    name: str
    description: str
    instructions: str
    tools: list[str]
    connector_config_ids: list[str]
    mcp_server_ids: list[str]


class SkillOrchestratorPatchOutput(BaseModel):
    name: str | None = None
    description: str | None = None
    instructions: str | None = None
    tools: list[str] | None = None
    connector_config_ids: list[str] | None = None
    mcp_server_ids: list[str] | None = None


SKILL_CREATE_INSTRUCTION = """You are a skill configuration generator for an AI agent system.

A skill is a reusable, self-contained procedure that an agent follows to accomplish a specific task using tools (connectors or MCP servers). Skills are NOT high-level descriptions — they are exact, operational protocols the agent reads and executes.

Given a user description and a list of available connectors and MCP servers, generate a complete skill configuration.

Fields to fill:

- name: kebab-case or snake_case unique skill name (e.g. 'sharepoint-folder-access-manager'). Lowercase letters, numbers, hyphens or underscores only. No spaces.

- description: 1-2 sentence summary of what the skill does and when an agent should use it.

- instructions: Write the instructions in the following structured format — this produces the best agent behavior:

  ## When to use this skill
  List 3-5 bullet points describing the exact user intents or situations that should trigger this skill.
  Example:
  - The user asks who has access to a SharePoint folder
  - The user wants to copy permissions from one user to another

  ## How it works
  A short paragraph explaining the approach — which tools are called, in what order, and why.

  ## Steps
  Numbered list of exact procedural steps the agent must follow:
  1. Collect required inputs from the user (list each input and what it is for)
  2. Call <exact_tool_name>(arg1=<source>, arg2=<source>) — explain where each argument comes from
  3. Check result.status — if 'error', return result.message to the user and stop
  4. On success, extract result.<field> and present it clearly to the user
  5. Any follow-up tool calls with same pattern

  ## Notes
  - Edge cases the agent should handle
  - What to do if a required input is ambiguous
  - Any environment or permission requirements
  - Fallback behavior if a tool returns no results

  IMPORTANT: Be specific. Name exact tool names, exact argument names, exact response field names. Do NOT write vague descriptions like "use the connector to get the data".

- tools: List of exact tool names this skill uses. Only use tool names that appear in the Available Connector Configs tool list. Use [] if none.
- connector_config_ids: Copy exact UUID strings from the Available Connector Configs list for connectors this skill needs. Use [] if none. Never invent IDs.
- mcp_server_ids: Copy exact UUID strings from the Available MCP Servers list. Use [] if none. Never invent IDs.
"""

SKILL_PATCH_INSTRUCTION = """You are a skill configuration generator for an AI agent system.

A skill is a reusable, self-contained procedure that an agent follows to accomplish a specific task using tools. Skills are exact, step-by-step protocols — not high-level descriptions.

You will be given an existing skill configuration and a user request describing what to change. Return ONLY the fields that need to change — set everything else to null.

CRITICAL RULES:
- The user's message is an INSTRUCTION describing what to change — it is NOT the new value for any field.
- Return null for every field the user did NOT ask to change.
- Return the new value only for fields the user explicitly asked to change.
- name must be kebab-case or snake_case (lowercase, hyphens or underscores only). Never spaces or special characters.
- tools and connector_config_ids: if changing, merge existing ones with any newly relevant ones. Never remove existing unless user explicitly asks.
- If instructions need to change: rewrite as numbered, exact procedural steps referencing specific tool names and response fields (result.status, result.message, etc.).
- Never invent IDs — copy exact UUIDs from the available list.

Example: if user says "rename this skill to copy-access", return name="copy-access" and null for all other fields.
Example: if user says "add error handling to instructions", return updated instructions and null for name, description, tools, connector_config_ids, mcp_server_ids.
"""


async def run_skill_orchestrator(
    system_instruction: str,
    user_prompt: str,
    session: Session,
    patch: bool = False,
) -> dict:
    model = _build_model(session)
    schema = SkillOrchestratorPatchOutput if patch else SkillOrchestratorOutput
    agent = LlmAgent(
        model=model,
        name="skill_orchestrator",
        description="Generates skill configurations from natural language.",
        instruction=system_instruction,
        output_schema=schema,
        output_key="result",
        tools=[],
    )
    session_service = InMemorySessionService()
    runner = Runner(
        agent=agent, app_name="skill_orchestrator", session_service=session_service
    )
    adk_session = await session_service.create_session(
        app_name="skill_orchestrator", user_id="system"
    )

    result: dict = {}
    async for event in runner.run_async(
        user_id="system",
        session_id=adk_session.id,
        new_message=types.Content(role="user", parts=[types.Part(text=user_prompt)]),
    ):
        delta = getattr(getattr(event, "actions", None), "state_delta", None) or {}
        if "result" in delta:
            result = delta["result"]

    return result


async def run_orchestrator(
    system_instruction: str,
    user_prompt: str,
    session: Session,
    patch: bool = False,
) -> dict:
    model = _build_model(session)
    schema = OrchestratorPatchOutput if patch else OrchestratorOutput
    agent = LlmAgent(
        model=model,
        name="agent_orchestrator",
        description="Generates agent configurations from natural language.",
        instruction=system_instruction,
        output_schema=schema,
        output_key="result",
        tools=[],
    )
    session_service = InMemorySessionService()
    runner = Runner(
        agent=agent, app_name="orchestrator", session_service=session_service
    )
    adk_session = await session_service.create_session(
        app_name="orchestrator", user_id="system"
    )

    result: dict = {}
    async for event in runner.run_async(
        user_id="system",
        session_id=adk_session.id,
        new_message=types.Content(role="user", parts=[types.Part(text=user_prompt)]),
    ):
        delta = getattr(getattr(event, "actions", None), "state_delta", None) or {}
        if "result" in delta:
            result = delta["result"]

    return result

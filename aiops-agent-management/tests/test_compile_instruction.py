"""
Unit tests for compile_instruction and _litellm_model_name in agent_loader.py.

compile_instruction builds the full agent system prompt from prompt_* fields.
If a field is dropped or ordering changes, the agent silently gets a broken prompt.

_litellm_model_name normalizes provider/model names for LiteLLM. The google/
vs gemini/ bug was already caught once — this keeps it from regressing.
"""

from types import SimpleNamespace

from src.agent_runtime.adk.agent_loader import _litellm_model_name, compile_instruction


def _agent(**kwargs) -> SimpleNamespace:
    defaults = {
        "name": "test-agent",
        "instruction": None,
        "prompt_role": None,
        "prompt_objectives": None,
        "prompt_behavior": None,
        "prompt_output_format": None,
        "prompt_constraints": None,
        "prompt_safety": None,
        "prompt_tools_instructions": None,
        "prompt_policy": None,
        "prompt_examples": None,
        "prompt_additional_info": None,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _model(provider: str, name: str) -> SimpleNamespace:
    return SimpleNamespace(provider=provider, name=name)


# ---------------------------------------------------------------------------
# compile_instruction — field inclusion
# ---------------------------------------------------------------------------


def test_compile_instruction_includes_role():
    agent = _agent(prompt_role="You are a DevOps agent.")
    assert "You are a DevOps agent." in compile_instruction(agent)


def test_compile_instruction_includes_objectives():
    agent = _agent(prompt_objectives="1. Monitor systems")
    assert "1. Monitor systems" in compile_instruction(agent)


def test_compile_instruction_includes_behavior():
    agent = _agent(prompt_behavior="Be concise.")
    assert "Be concise." in compile_instruction(agent)


def test_compile_instruction_includes_output_format():
    agent = _agent(prompt_output_format="Return JSON.")
    assert "Return JSON." in compile_instruction(agent)


def test_compile_instruction_includes_constraints():
    agent = _agent(prompt_constraints="Never expose secrets.")
    assert "Never expose secrets." in compile_instruction(agent)


def test_compile_instruction_includes_safety():
    agent = _agent(prompt_safety="Follow OWASP guidelines.")
    assert "Follow OWASP guidelines." in compile_instruction(agent)


def test_compile_instruction_includes_tools_instructions():
    agent = _agent(prompt_tools_instructions="Call search_files to find files.")
    assert "Call search_files to find files." in compile_instruction(agent)


def test_compile_instruction_includes_policy():
    agent = _agent(prompt_policy="Follow company policy.")
    assert "Follow company policy." in compile_instruction(agent)


def test_compile_instruction_includes_examples():
    agent = _agent(prompt_examples="User: hello\nAgent: hi")
    assert "User: hello" in compile_instruction(agent)


def test_compile_instruction_includes_additional_info():
    agent = _agent(prompt_additional_info="Extra context here.")
    assert "Extra context here." in compile_instruction(agent)


# ---------------------------------------------------------------------------
# compile_instruction — section headings
# ---------------------------------------------------------------------------


def test_compile_instruction_adds_role_heading():
    agent = _agent(prompt_role="You are X.")
    assert "# Role" in compile_instruction(agent)


def test_compile_instruction_adds_objectives_heading():
    agent = _agent(prompt_objectives="obj")
    assert "# Objectives" in compile_instruction(agent)


def test_compile_instruction_adds_additional_info_heading():
    agent = _agent(prompt_additional_info="extra")
    assert "# Additional Info" in compile_instruction(agent)


# ---------------------------------------------------------------------------
# compile_instruction — None fields are skipped
# ---------------------------------------------------------------------------


def test_compile_instruction_skips_none_fields():
    agent = _agent(prompt_role="Role only")
    result = compile_instruction(agent)
    assert "# Objectives" not in result
    assert "# Behavior" not in result
    assert "# Additional Info" not in result


def test_compile_instruction_skips_empty_string_fields():
    agent = _agent(prompt_role="Role", prompt_objectives="")
    result = compile_instruction(agent)
    assert "# Objectives" not in result


def test_compile_instruction_all_none_falls_back_to_instruction():
    agent = _agent(instruction="Fallback instruction")
    assert compile_instruction(agent) == "Fallback instruction"


def test_compile_instruction_all_none_no_instruction_returns_empty():
    agent = _agent()
    assert compile_instruction(agent) == ""


# ---------------------------------------------------------------------------
# compile_instruction — ordering
# ---------------------------------------------------------------------------


def test_compile_instruction_role_before_objectives():
    agent = _agent(prompt_role="ROLE", prompt_objectives="OBJ")
    result = compile_instruction(agent)
    assert result.index("ROLE") < result.index("OBJ")


def test_compile_instruction_additional_info_is_last():
    agent = _agent(prompt_role="ROLE", prompt_additional_info="EXTRA")
    result = compile_instruction(agent)
    assert result.index("ROLE") < result.index("EXTRA")


def test_compile_instruction_sections_separated_by_double_newline():
    agent = _agent(prompt_role="Role", prompt_objectives="Obj")
    result = compile_instruction(agent)
    assert "\n\n" in result


# ---------------------------------------------------------------------------
# _litellm_model_name — provider normalization
# ---------------------------------------------------------------------------


def test_litellm_model_name_google_uses_gemini_prefix():
    m = _model("google", "gemini-2.0-flash")
    assert _litellm_model_name(m) == "gemini/gemini-2.0-flash"


def test_litellm_model_name_google_case_insensitive():
    assert _litellm_model_name(_model("Google", "gemini-pro")) == "gemini/gemini-pro"
    assert _litellm_model_name(_model("GOOGLE", "gemini-pro")) == "gemini/gemini-pro"


def test_litellm_model_name_openai_uses_provider_prefix():
    m = _model("openai", "gpt-4o")
    assert _litellm_model_name(m) == "openai/gpt-4o"


def test_litellm_model_name_anthropic_uses_provider_prefix():
    m = _model("anthropic", "claude-3-5-sonnet")
    assert _litellm_model_name(m) == "anthropic/claude-3-5-sonnet"


def test_litellm_model_name_bedrock_uses_provider_prefix():
    m = _model("bedrock", "amazon.titan-text-express-v1")
    assert _litellm_model_name(m) == "bedrock/amazon.titan-text-express-v1"


def test_litellm_model_name_google_never_uses_google_prefix():
    """Regression: google/ prefix is invalid for LiteLLM — must be gemini/."""
    m = _model("google", "gemini-2.5-flash")
    result = _litellm_model_name(m)
    assert not result.startswith("google/"), (
        f"LiteLLM does not accept 'google/' prefix — got {result!r}. "
        "Use 'gemini/' for Google models."
    )

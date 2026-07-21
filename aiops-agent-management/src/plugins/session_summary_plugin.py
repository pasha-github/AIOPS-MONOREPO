import logging
import os

import litellm
from google.adk.agents.base_agent import BaseAgent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.adk.plugins.base_plugin import BasePlugin

logger = logging.getLogger(__name__)

FIRST_MESSAGE_SUMMARY_KEY = "first_message_summary"
SUMMARY_FALLBACKS_KEY = "summary_fallbacks"
FALLBACK_SUMMARY_MAX_LENGTH = 120


def _extract_user_text(llm_request: LlmRequest) -> str:
    if not llm_request.contents:
        return ""

    latest_content = llm_request.contents[-1]
    if getattr(latest_content, "role", None) != "user":
        return ""

    text_parts = []
    for part in getattr(latest_content, "parts", []):
        text = getattr(part, "text", None)
        if text:
            text_parts.append(text.strip())

    return " ".join(part for part in text_parts if part).strip()


def _fallback_summary(user_text: str) -> str:
    normalized = " ".join(user_text.split()).strip()
    if not normalized:
        return ""

    if len(normalized) <= FALLBACK_SUMMARY_MAX_LENGTH:
        return normalized

    cutoff = normalized.rfind(" ", 0, FALLBACK_SUMMARY_MAX_LENGTH)
    if cutoff == -1:
        cutoff = FALLBACK_SUMMARY_MAX_LENGTH

    return normalized[:cutoff].rstrip() + "..."


def _litellm_summary_model(model: str | None) -> str | None:
    if not model:
        return None

    # ADK's native Gemini model reports bare names like `gemini-2.5-flash`.
    # In Bedrock AgentCore we authenticate Gemini through GOOGLE_API_KEY, so
    # LiteLLM needs the AI Studio provider prefix instead of defaulting to
    # Vertex ADC.
    if (
        model.startswith("gemini-")
        and os.environ.get("GOOGLE_API_KEY")
        and os.environ.get("GOOGLE_GENAI_USE_VERTEXAI", "").lower() != "true"
    ):
        return f"gemini/{model}"

    return model


class SessionSummaryPlugin(BasePlugin):
    def __init__(self, name: str = "session_summary_plugin"):
        super().__init__(name=name)

    async def before_agent_callback(
        self,
        *,
        agent: BaseAgent,
        callback_context: CallbackContext,
    ) -> None:
        model = getattr(agent, "model", None)
        fallbacks = getattr(model, "_additional_args", {}).get("fallbacks", [])

        if callback_context.state.get(SUMMARY_FALLBACKS_KEY):
            return None

        callback_context.state[SUMMARY_FALLBACKS_KEY] = fallbacks

    async def before_model_callback(
        self,
        *,
        callback_context: CallbackContext,
        llm_request: LlmRequest,
    ) -> LlmResponse | None:
        if callback_context.state.get(FIRST_MESSAGE_SUMMARY_KEY):
            return None

        user_text = _extract_user_text(llm_request)
        if not user_text:
            return None

        summary = ""
        summarizer_model = _litellm_summary_model(llm_request.model)

        if summarizer_model:
            try:
                sync_fallbacks = callback_context.state.get(SUMMARY_FALLBACKS_KEY, [])

                response = litellm.completion(
                    model=summarizer_model,
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
                logger.warning("Session summary plugin failed: %s", exc)

        if not summary:
            summary = _fallback_summary(user_text)

        if summary:
            callback_context.state[FIRST_MESSAGE_SUMMARY_KEY] = summary

        return None


plugin = SessionSummaryPlugin()

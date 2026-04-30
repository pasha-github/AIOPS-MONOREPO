import logging

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
        summarizer_model = llm_request.model

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
                                "Summarize this user message in 3-6 words. "
                                "Return only the summary."
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

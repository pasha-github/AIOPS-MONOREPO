import logging
import os

import litellm
from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse

logger = logging.getLogger(__name__)
FIRST_MESSAGE_SUMMARY_KEY = "first_message_summary"
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


def make_session_summary_callback(model: str):
    summarizer_model = os.getenv("SUMMARIZER_MODEL") or model

    def callback(
        callback_context: CallbackContext,
        llm_request: LlmRequest,
    ) -> LlmResponse | None:
        agent_name = getattr(callback_context, "agent_name", "unknown")
        if callback_context.state.get(FIRST_MESSAGE_SUMMARY_KEY):
            return None

        user_text = _extract_user_text(llm_request)
        if not user_text:
            return None

        user_text_preview = _fallback_summary(user_text)
        summary = ""

        logger.info(
            "Session summary request: agent=%s summarizer_model=%s user_text=%r",
            agent_name,
            summarizer_model,
            user_text_preview,
        )

        try:
            response = litellm.completion(
                model=summarizer_model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Summarize the first message in one concise sentence in just 3-6 words capturing the main intent or request. "
                            "Write the summary as a direct statement, not referring to “the user” or describing the act of asking. "
                            "Do not include explanations or extra details."
                        ),
                    },
                    {"role": "user", "content": user_text},
                ],
                temperature=0.0,
            )
            logger.info(
                "Session summary raw response: agent=%s summarizer_model=%s response=%r",
                agent_name,
                summarizer_model,
                response,
            )
            content = response.choices[0].message.content  # type: ignore
            summary = content.strip() if isinstance(content, str) else ""
            logger.info(
                "Session summary response: agent=%s summarizer_model=%s content_type=%s content=%r",
                agent_name,
                summarizer_model,
                type(content).__name__,
                content,
            )
        except Exception as exc:
            logger.warning(
                "Failed to generate first message summary: agent=%s summarizer_model=%s error=%s",
                agent_name,
                summarizer_model,
                exc,
            )

        if not summary:
            logger.warning(
                "Session summary fallback used: agent=%s summarizer_model=%s fallback=%r",
                agent_name,
                summarizer_model,
                user_text_preview,
            )
            summary = _fallback_summary(user_text)

        if summary:
            callback_context.state[FIRST_MESSAGE_SUMMARY_KEY] = summary
            logger.info(
                "Session summary stored: agent=%s summarizer_model=%s summary=%r",
                agent_name,
                summarizer_model,
                summary,
            )

        return None

    return callback

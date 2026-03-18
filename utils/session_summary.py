import logging
import os
from typing import Optional

import litellm
from google.adk.agents.callback_context import CallbackContext
from google.adk.models import LlmRequest, LlmResponse


logger = logging.getLogger(__name__)
FIRST_MESSAGE_SUMMARY_KEY = "first_message_summary"


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


def make_session_summary_callback(model: str):
    summarizer_model = os.getenv("SUMMARIZER_MODEL") or model

    def callback(
        callback_context: CallbackContext,
        llm_request: LlmRequest,
    ) -> Optional[LlmResponse]:
        if callback_context.state.get(FIRST_MESSAGE_SUMMARY_KEY):
            return None

        user_text = _extract_user_text(llm_request)
        if not user_text:
            return None

        try:
            response = litellm.completion(
                model=summarizer_model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Summarize the first message in one concise sentence capturing the main intent or request. "
                            "Write the summary as a direct statement, not referring to “the user” or describing the act of asking. "
                            "Do not include explanations or extra details."
                        ),
                    },
                    {"role": "user", "content": user_text},
                ],
                max_tokens=30,
                temperature=0.0,
            )
        except Exception as exc:
            logger.warning("Failed to generate first message summary: %s", exc)
            return None

        summary = response.choices[0].message.content.strip()
        if summary:
            callback_context.state[FIRST_MESSAGE_SUMMARY_KEY] = summary

        return None

    return callback

import asyncio

from httpx import HTTPStatusError
from microsoft.teams.api import MessageActivity, MessageActivityInput, TypingActivityInput
from microsoft.teams.apps import ActivityContext, App

from services.agent_client import fetch_agent_reply
from services.email_mapping import collect_candidate_emails, onboard_personal_chat
from services.subscriptions import (
    delete_subscription,
    detect_scope,
    save_subscription,
)
from utils.config import Config
from utils.helpers import normalize_conversation_id

EMPTY_TEXT_MESSAGE = "Please send a text message."
MISSING_AGENT_CONFIG_MESSAGE = (
    "Agent chat is not configured. Set AGENT_ADK_BASE_URL and AGENT_APP_NAME in environment."
)
MISSING_USER_EMAIL_MESSAGE = (
    "I could not determine a stable identity from Teams, so I cannot start the agent session."
)
AGENT_UNAVAILABLE_MESSAGE = "I could not reach the configured agent service right now."
TRANSIENT_SEND_STATUS_CODES = {502, 503, 504}
TRANSIENT_SEND_ATTEMPTS = 3


def get_message_text(ctx: ActivityContext[MessageActivity]) -> str:
    """Extract user text from Teams activity, stripping mentions when possible."""
    raw_text = (ctx.activity.text or "").strip()
    if not raw_text:
        return ""

    try:
        cleaned_activity = ctx.activity.strip_mentions_text()
        return (cleaned_activity.text or raw_text).strip()
    except Exception:
        return raw_text


async def send_with_retry(
    ctx: ActivityContext[MessageActivity],
    app: App,
    activity,
    *,
    label: str,
    required: bool,
):
    delay_seconds = 0.5

    for attempt in range(1, TRANSIENT_SEND_ATTEMPTS + 1):
        try:
            return await ctx.send(activity)
        except HTTPStatusError as exc:
            status_code = exc.response.status_code
            response_excerpt = (exc.response.text or "").strip()[:300]
            is_transient = status_code in TRANSIENT_SEND_STATUS_CODES
            has_retry = attempt < TRANSIENT_SEND_ATTEMPTS
            if is_transient and has_retry:
                app.logger.warning(
                    "Transient Teams send failure for %s (%s, body=%r), retrying attempt %s/%s.",
                    label,
                    status_code,
                    response_excerpt,
                    attempt,
                    TRANSIENT_SEND_ATTEMPTS,
                )
                await asyncio.sleep(delay_seconds)
                delay_seconds *= 2
                continue
            if required:
                raise
            app.logger.warning(
                "Failed to send optional %s to Teams (%s, body=%r).",
                label,
                status_code,
                response_excerpt,
                exc_info=True,
            )
            return None
        except Exception:
            if required:
                raise
            app.logger.warning(
                "Failed to send optional %s to Teams.",
                label,
                exc_info=True,
            )
            return None


async def send_optional_typing(ctx: ActivityContext[MessageActivity], app: App) -> None:
    await send_with_retry(
        ctx,
        app,
        TypingActivityInput(),
        label="typing indicator",
        required=False,
    )


def register_handlers(app: App, config: Config) -> None:
    # -----------------------------------------------------------------------
    # Teams activity handlers
    # -----------------------------------------------------------------------
    def save_current_subscription(ctx) -> None:
        save_subscription(ctx, app.api.service_url)

    @app.on_install_add
    async def handle_install_add(ctx):
        """Auto-register subscription when bot/app is installed in a scope."""

        save_current_subscription(ctx)

    @app.on_installation_update
    async def handle_installation_update(ctx):
        """Refresh subscription when Teams sends installation update events."""

        save_current_subscription(ctx)

    @app.on_install_remove
    async def handle_install_remove(ctx):
        """Remove subscription automatically when bot is removed from a conversation."""
        scope = detect_scope(ctx)
        conversation_id = normalize_conversation_id(ctx.activity.conversation.id, scope)
        if conversation_id:
            delete_subscription(conversation_id)

    @app.on_message
    async def handle_message(ctx: ActivityContext[MessageActivity]):
        """Forward Teams text messages to configured agent API and return its response."""
        user_text = get_message_text(ctx)
        if not user_text:
            await send_with_retry(
                ctx,
                app,
                EMPTY_TEXT_MESSAGE,
                label="empty-text warning",
                required=True,
            )
            return
        await send_optional_typing(ctx, app)
        scope = detect_scope(ctx)

        # Keep channel/group targets fresh when users interact in non-personal scopes.
        if scope != "personal":
            save_subscription(ctx, app.api.service_url)
        # Silent background registration for first personal message.
        await onboard_personal_chat(ctx, app.api.service_url)

        if not config.AGENT_ADK_BASE_URL or not config.AGENT_APP_NAME:
            await send_with_retry(
                ctx,
                app,
                MISSING_AGENT_CONFIG_MESSAGE,
                label="missing-agent-config warning",
                required=True,
            )
            return

        status_activity = None

        try:
            session_id = normalize_conversation_id(
                ctx.activity.conversation.id, scope
            ) or (ctx.activity.conversation.id or "").strip()
            candidate_emails = await collect_candidate_emails(ctx)
            fallback_user_id = str(getattr(ctx.activity.from_, "id", "") or "").strip()
            if not candidate_emails and not fallback_user_id:
                await send_with_retry(
                    ctx,
                    app,
                    MISSING_USER_EMAIL_MESSAGE,
                    label="missing-user-email warning",
                    required=True,
                )
                return
            adk_user_id = candidate_emails[0] if candidate_emails else fallback_user_id
            status_lines: list[str] = []

            async def send_progress_event(event_label: str) -> None:
                nonlocal status_activity
                status_lines.append(f"- {event_label}")
                status_text = "Agent status:\n" + "\n".join(status_lines)
                if status_activity is None:
                    status_activity = await send_with_retry(
                        ctx,
                        app,
                        status_text,
                        label="agent status message",
                        required=False,
                    )
                    return
                updated_activity = await send_with_retry(
                    ctx,
                    app,
                    MessageActivityInput(text=status_text).with_id(status_activity.id),
                    label="agent status update",
                    required=False,
                )
                if updated_activity is not None:
                    status_activity = updated_activity

            agent_response = await fetch_agent_reply(
                adk_base_url=config.AGENT_ADK_BASE_URL,
                app_name=config.AGENT_APP_NAME,
                user_id=adk_user_id,
                session_id=session_id,
                message=user_text,
                on_event=send_progress_event,
            )
        except Exception:
            app.logger.exception("Failed to call configured agent chat endpoint.")
            if status_activity is None:
                await send_with_retry(
                    ctx,
                    app,
                    AGENT_UNAVAILABLE_MESSAGE,
                    label="agent-unavailable message",
                    required=True,
                )
            else:
                await send_with_retry(
                    ctx,
                    app,
                    MessageActivityInput(text=AGENT_UNAVAILABLE_MESSAGE).with_id(
                        status_activity.id
                    ),
                    label="agent-unavailable update",
                    required=True,
                )
            return

        if status_activity is None:
            await send_with_retry(
                ctx,
                app,
                agent_response.text,
                label="agent response",
                required=True,
            )
        else:
            await send_with_retry(
                ctx,
                app,
                agent_response.text,
                label="agent response",
                required=True,
            )

import logging
import secrets
from typing import Any

from fastapi import HTTPException, Request
from microsoft_teams.api import MessageActivityInput
from microsoft_teams.apps import App

from services.activity_cache import cache_activity_text
from services.activity_store import save_activity_text
from services.email_mapping import fetch_subscription_for_email
from services.subscriptions import delete_subscription, fetch_subscription
from utils.config import Config
from utils.contracts import SubscriptionPayload
from utils.helpers import (
    dedupe_preserve_order,
    is_valid_email,
    normalize_email,
    normalize_target_conversation_input,
)
from utils.schemas import (
    AlertConversationFailure,
    AlertConversationRequest,
    AlertConversationResponse,
    EmailAlertBatchResponse,
    EmailAlertDelivery,
    EmailAlertFailure,
    EmailAlertRequest,
    EmailAlertSingleResponse,
)

logger = logging.getLogger(__name__)


async def parse_json_body(request: Request) -> dict[str, Any]:
    """Parse request body and ensure payload is a JSON object."""

    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload.") from exc

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Payload must be a JSON object.")

    return payload


def require_message(payload: dict[str, Any]) -> str:
    """Extract required `message` field from payload."""

    message = str(payload.get("message") or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="'message' is required.")
    return message


def get_api_key(request: Request) -> str:
    """Read auth key from x-alert-key or Authorization: Bearer."""

    api_key_header = request.headers.get("x-alert-key", "").strip()
    if api_key_header:
        return api_key_header

    authorization_value = request.headers.get("authorization", "").strip()
    if authorization_value.lower().startswith("bearer "):
        return authorization_value[7:].strip()

    return ""


def validate_api_key(request: Request, config: Config) -> None:
    """Validate the shared key used by alert ingestion endpoints."""
    expected_api_key = config.ALERT_API_KEY.strip()
    if not expected_api_key:
        raise HTTPException(status_code=500, detail="ALERT_API_KEY is not configured.")

    received_api_key = get_api_key(request)
    if not received_api_key or not secrets.compare_digest(
        received_api_key, expected_api_key
    ):
        raise HTTPException(status_code=401, detail="Unauthorized.")


def is_stale_error(error: Exception) -> bool:
    """Detect failures that imply subscription should be cleaned up."""

    error_response = getattr(error, "response", None)
    response_status = getattr(error_response, "status_code", None)
    return response_status in {401, 403, 404}


def is_bot_missing_error(error: Exception) -> bool:
    """Detect Teams errors that indicate the bot is not installed in the target channel/chat."""

    error_response = getattr(error, "response", None)
    response_status = getattr(error_response, "status_code", None)
    if response_status not in {403, 404}:
        return False

    error_message = str(error).lower()
    return any(
        token in error_message
        for token in (
            "botnotinconversationroster",
            "not in conversation roster",
            "not in conversation",
            "not a member",
            "forbiddenoperationexception",
        )
    )


async def send_proactive_alert(
    app: App, subscription: SubscriptionPayload, message_text: str
) -> None:
    """Send a proactive message to a specific subscribed conversation."""

    if not app.id:
        raise RuntimeError("Cannot send alerts because CLIENT_ID is not configured.")

    sent_activity = await app.send(
        str(subscription["conversation_id"]),
        MessageActivityInput(text=message_text),
    )
    sent_activity_id = str(getattr(sent_activity, "id", "") or "").strip()
    if sent_activity_id:
        cache_activity_text(sent_activity_id, message_text)
        save_activity_text(
            sent_activity_id,
            str(subscription.get("conversation_id") or ""),
            message_text,
        )


def parse_conversation_request(
    payload: dict[str, Any],
) -> AlertConversationRequest:
    """Parse and normalize `/api/alerts` payload."""
    message = require_message(payload)
    conversation_input = str(payload.get("conversation_id") or "").strip()
    normalized_conversation_id = normalize_target_conversation_input(conversation_input)
    if not normalized_conversation_id:
        raise HTTPException(status_code=400, detail="'conversation_id' is required.")

    return AlertConversationRequest(
        conversation_id=normalized_conversation_id,
        message=message,
    )


def normalize_email_targets(payload: dict[str, Any]) -> tuple[str, list[str] | None]:
    """
    Parse single and batch email inputs from payload.

    Returns:
        (single_email, email_list_or_none)
        If the second value is None, caller should use single-email mode.
    """
    single_email = normalize_email(payload.get("email"))
    batch_emails_input = payload.get("emails")

    if batch_emails_input is None:
        return single_email, None

    if not isinstance(batch_emails_input, list):
        raise HTTPException(
            status_code=400, detail="'emails' must be an array of email strings."
        )

    normalized_candidates: list[str] = []
    if single_email:
        normalized_candidates.append(single_email)

    for value in batch_emails_input:
        normalized_value = normalize_email(value)
        if normalized_value:
            normalized_candidates.append(normalized_value)

    return single_email, dedupe_preserve_order(normalized_candidates)


def parse_email_request(payload: dict[str, Any]) -> EmailAlertRequest:
    """Parse and normalize `/api/alerts/by-email` payload."""
    message = require_message(payload)
    single_email, unique_emails = normalize_email_targets(payload)
    return EmailAlertRequest(
        message=message,
        email=single_email or None,
        emails=unique_emails,
    )


def register_alert_routes(app: App, config: Config) -> None:
    # -----------------------------------------------------------------------
    # Alert ingestion endpoint
    # -----------------------------------------------------------------------
    @app.http.post("/api/alerts")
    async def post_alert(request: Request):
        """Send a proactive alert to a specific subscribed conversation."""
        # API key validation protects this endpoint from unauthenticated posts.
        validate_api_key(request, config)

        payload = await parse_json_body(request)
        print(
            "[teams_bot] alert_request",
            {
                "payload": payload,
            },
            flush=True,
        )
        alert_request = parse_conversation_request(payload)
        print(
            "[teams_bot] alert_parsed",
            {
                "conversation_id": alert_request.conversation_id,
                "message": alert_request.message,
            },
            flush=True,
        )

        target_subscription = fetch_subscription(alert_request.conversation_id)
        if target_subscription is None:
            raise HTTPException(
                status_code=404,
                detail="Bot is not added in this channel. Add bot to channel first.",
            )
        print(
            "[teams_bot] alert_subscription",
            {
                "subscription": dict(target_subscription),
            },
            flush=True,
        )

        delivered_to: list[str] = []
        delivery_failures: list[AlertConversationFailure] = []

        conversation_id = str(target_subscription.get("conversation_id") or "")
        try:
            await send_proactive_alert(app, target_subscription, alert_request.message)
            print(
                "[teams_bot] alert_send_success",
                {"conversation_id": conversation_id},
                flush=True,
            )
            delivered_to.append(conversation_id)
        except Exception as exc:
            if is_bot_missing_error(exc):
                raise HTTPException(
                    status_code=403, detail="Bot is not added in this channel."
                ) from exc
            logger.exception("Failed to deliver alert to conversation_id=%s", conversation_id)
            delivery_failures.append(
                AlertConversationFailure(
                    conversation_id=conversation_id, error="delivery failed"
                )
            )
            if conversation_id and is_stale_error(exc):
                # Drop stale targets to keep future sends clean.
                delete_subscription(conversation_id)

        response = AlertConversationResponse(
            status="ok",
            requested_count=1,
            sent_count=len(delivered_to),
            failed_count=len(delivery_failures),
            sent_to=delivered_to,
            failures=delivery_failures,
        )
        return response.model_dump()

    @app.http.post("/api/alerts/by-email")
    async def post_alert_by_email(request: Request):
        """Send personal proactive alert(s) using local email-to-conversation mapping."""
        validate_api_key(request, config)

        payload = await parse_json_body(request)
        email_request = parse_email_request(payload)
        single_email = email_request.email or ""
        unique_emails = email_request.emails

        # Backward-compatible single-email mode.
        if unique_emails is None:
            if not single_email:
                raise HTTPException(status_code=400, detail="'email' is required.")
            if not is_valid_email(single_email):
                raise HTTPException(
                    status_code=400, detail="'email' must be a valid email address."
                )

            subscription, conversation_id, error_message = fetch_subscription_for_email(
                single_email
            )
            if subscription is None:
                raise HTTPException(status_code=404, detail=error_message)

            try:
                await send_proactive_alert(app, subscription, email_request.message)
            except Exception as exc:
                if is_stale_error(exc):
                    delete_subscription(conversation_id)
                raise HTTPException(
                    status_code=502,
                    detail="Failed to send personal alert to mapped user.",
                ) from exc

            response = EmailAlertSingleResponse(
                status="ok",
                email=single_email,
                conversation_id=conversation_id,
                message_sent=True,
            )
            return response.model_dump()

        # Batch mode for multiple recipients.
        if not unique_emails:
            raise HTTPException(
                status_code=400,
                detail="Provide at least one email in 'emails' or 'email'.",
            )

        delivered_to: list[EmailAlertDelivery] = []
        delivery_failures: list[EmailAlertFailure] = []

        for email in unique_emails:
            if not is_valid_email(email):
                delivery_failures.append(
                    EmailAlertFailure(email=email, error="invalid email format")
                )
                continue

            subscription, conversation_id, error_message = fetch_subscription_for_email(
                email
            )
            if subscription is None:
                delivery_failures.append(
                    EmailAlertFailure(
                        email=email, error=str(error_message or "mapping not found")
                    )
                )
                continue

            try:
                await send_proactive_alert(app, subscription, email_request.message)
                delivered_to.append(
                    EmailAlertDelivery(email=email, conversation_id=conversation_id)
                )
            except Exception as exc:
                if is_stale_error(exc):
                    delete_subscription(conversation_id)
                logger.exception(
                    "Failed to deliver email alert to email=%s conversation_id=%s",
                    email,
                    conversation_id,
                )
                delivery_failures.append(
                    EmailAlertFailure(
                        email=email,
                        conversation_id=conversation_id,
                        error="delivery failed",
                    )
                )

        response = EmailAlertBatchResponse(
            status="ok",
            requested_count=len(unique_emails),
            sent_count=len(delivered_to),
            failed_count=len(delivery_failures),
            sent_to=delivered_to,
            failures=delivery_failures,
        )
        return response.model_dump()

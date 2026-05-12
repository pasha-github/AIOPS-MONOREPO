from typing import Any, cast

from microsoft_teams.apps import ActivityContext
from sqlalchemy import delete

from database.database import session_scope
from database.models import EmailSubscriptionRecord, SubscriptionRecord
from utils.contracts import SubscriptionPayload
from utils.helpers import normalize_conversation_id, normalize_service_url


def to_subscription_payload(
    record: SubscriptionRecord,
) -> SubscriptionPayload | None:
    """Convert subscription ORM record into payload used by existing bot logic."""

    service_url = normalize_service_url(str(record.service_url or ""))
    if not service_url:
        return None

    conversation_type = str(record.conversation_type or "personal")
    if conversation_type == "channel":
        scope = "team"
    elif conversation_type == "groupChat":
        scope = "groupChat"
    else:
        scope = "personal"
    conversation_id = normalize_conversation_id(
        str(record.conversation_id or ""), scope
    )
    if not conversation_id:
        return None

    return cast(
        SubscriptionPayload,
        {
            "conversation_id": conversation_id,
            "service_url": service_url,
            "channel_id": str(record.channel_id or "msteams"),
            "conversation_type": conversation_type,
            "tenant_id": record.tenant_id,
        },
    )


def detect_scope(ctx: ActivityContext[Any]) -> str:
    """Infer Teams scope from activity metadata."""

    activity = ctx.activity
    channel_data = getattr(activity, "channel_data", None)
    if getattr(channel_data, "team", None):
        return "team"

    conversation = activity.conversation
    conversation_type = (conversation.conversation_type or "").lower()

    if conversation_type in {"channel", "team"}:
        return "team"
    if conversation_type in {"groupchat", "group"}:
        return "groupChat"
    if conversation.is_group:
        return "groupChat"

    return "personal"


def resolve_conversation_type(raw_type: str, scope: str) -> str:
    """Normalize platform-specific conversation type values."""

    raw_type = (raw_type or "").strip().lower()

    if raw_type in {"groupchat", "group"}:
        return "groupChat"
    if raw_type in {"channel", "team"}:
        return "channel"
    if raw_type == "personal":
        return "personal"

    if scope == "team":
        return "channel"
    if scope == "groupChat":
        return "groupChat"
    return "personal"


def compose_subscription_payload(
    ctx: ActivityContext[Any], fallback_service_url: str
) -> SubscriptionPayload | None:
    """Build the subscription payload for the current conversation."""

    activity = ctx.activity
    conversation = activity.conversation
    scope = detect_scope(ctx)
    conversation_id = normalize_conversation_id(conversation.id, scope)
    if not conversation_id:
        return None

    raw_conversation_type = conversation.conversation_type or ""
    conversation_type = resolve_conversation_type(raw_conversation_type, scope)
    # Prefer conversation_ref.service_url captured from activity pipeline.
    service_url = normalize_service_url(
        ctx.conversation_ref.service_url or activity.service_url or fallback_service_url
    )
    if not service_url:
        return None

    return cast(
        SubscriptionPayload,
        {
            "conversation_id": conversation_id,
            "service_url": service_url,
            "channel_id": str(
                ctx.conversation_ref.channel_id or activity.channel_id or "msteams"
            ),
            "conversation_type": conversation_type,
            "tenant_id": conversation.tenant_id,
        },
    )


def save_subscription(ctx: ActivityContext[Any], fallback_service_url: str) -> bool:
    """Add or update the active conversation subscription."""

    subscription = compose_subscription_payload(ctx, fallback_service_url)
    if subscription is None:
        return False

    conversation_id = subscription["conversation_id"]
    with session_scope() as session:
        record = session.get(SubscriptionRecord, conversation_id)
        if record is None:
            session.add(
                SubscriptionRecord(
                    conversation_id=conversation_id,
                    service_url=normalize_service_url(
                        str(subscription.get("service_url") or "")
                    ),
                    channel_id=str(subscription.get("channel_id") or "msteams"),
                    conversation_type=str(
                        subscription.get("conversation_type") or "personal"
                    ),
                    tenant_id=subscription.get("tenant_id"),
                )
            )
            return True

        record.service_url = normalize_service_url(
            str(subscription.get("service_url") or "")
        )
        record.channel_id = str(subscription.get("channel_id") or "msteams")
        record.conversation_type = str(
            subscription.get("conversation_type") or "personal"
        )
        record.tenant_id = subscription.get("tenant_id")
    return True


def delete_subscription(conversation_id: str) -> bool:
    """Delete a subscription by conversation ID."""

    if not conversation_id:
        return False

    with session_scope() as session:
        record = session.get(SubscriptionRecord, conversation_id)
        if record is None:
            return False

        session.execute(
            delete(EmailSubscriptionRecord).where(
                EmailSubscriptionRecord.conversation_id == conversation_id
            )
        )
        session.delete(record)
        return True


def fetch_subscription(conversation_id: str) -> SubscriptionPayload | None:
    """Fetch a subscription by conversation ID."""

    normalized_conversation_id = (conversation_id or "").strip()
    if not normalized_conversation_id:
        return None

    with session_scope() as session:
        record = session.get(SubscriptionRecord, normalized_conversation_id)

    if record is None:
        return None
    return to_subscription_payload(record)

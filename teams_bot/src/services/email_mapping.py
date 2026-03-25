from typing import Any

from microsoft.teams.api import MessageActivity
from microsoft.teams.apps import ActivityContext
from sqlalchemy import select

from database.database import session_scope
from database.models import EmailSubscriptionRecord
from services.subscriptions import (
    detect_scope,
    fetch_subscription,
    save_subscription,
)
from utils.contracts import PersonalOnboardingResult, SubscriptionPayload
from utils.helpers import (
    is_valid_email,
    normalize_conversation_id,
    normalize_email,
    utc_now_iso,
)

EMAIL_CANDIDATE_KEYS = (
    "email",
    "mail",
    "userPrincipalName",
    "user_principal_name",
    "upn",
)


def save_email_mapping(email: str, conversation_id: str) -> None:
    """Create or update an email mapping to a personal conversation ID."""

    normalized_email = normalize_email(email)
    updated_at_utc = utc_now_iso()
    with session_scope() as session:
        record = session.get(EmailSubscriptionRecord, normalized_email)
        if record is None:
            session.add(
                EmailSubscriptionRecord(
                    email=normalized_email,
                    conversation_id=conversation_id,
                    updated_at_utc=updated_at_utc,
                )
            )
            return

        record.conversation_id = conversation_id
        record.updated_at_utc = updated_at_utc


def add_valid_email(candidates: set[str], value: Any) -> None:
    normalized_value = normalize_email(value)
    if normalized_value and is_valid_email(normalized_value):
        candidates.add(normalized_value)


def collect_mapping_emails(candidates: set[str], values: Any) -> None:
    if not isinstance(values, dict):
        return

    for key in EMAIL_CANDIDATE_KEYS:
        add_valid_email(candidates, values.get(key))


def collect_account_emails(account: Any) -> set[str]:
    """Collect candidate emails from an account-like object."""

    candidates: set[str] = set()
    if account is None:
        return candidates

    for field in ("email", "mail", "user_principal_name", "userPrincipalName", "upn"):
        value = getattr(account, field, None)
        add_valid_email(candidates, value)

    collect_mapping_emails(candidates, getattr(account, "model_extra", None))
    collect_mapping_emails(candidates, getattr(account, "properties", None))

    return candidates


async def fetch_member_account(
    ctx: ActivityContext[MessageActivity],
) -> Any | None:
    """Fetch member profile from conversation API for richer identity fields."""

    conversation_id = str(getattr(ctx.activity.conversation, "id", "") or "").strip()
    member_id = str(getattr(ctx.activity.from_, "id", "") or "").strip()
    if not conversation_id or not member_id:
        return None

    try:
        return await ctx.api.conversations.members(conversation_id).get(member_id)
    except Exception:
        return None


async def collect_candidate_emails(ctx: ActivityContext[MessageActivity]) -> list[str]:
    """Collect candidate emails from activity metadata and member profile."""

    candidates: set[str] = set()

    from_account = getattr(ctx.activity, "from_", None)
    candidates.update(collect_account_emails(from_account))

    member_account = await fetch_member_account(ctx)
    candidates.update(collect_account_emails(member_account))

    return sorted(candidates)


async def onboard_personal_chat(
    ctx: ActivityContext[MessageActivity], fallback_service_url: str
) -> PersonalOnboardingResult:
    """
    Save conversation details on first personal message.
    Also save email->conversation mapping when email is discoverable.
    Returns state flags so caller can avoid repetitive confirmations.
    """

    if detect_scope(ctx) != "personal":
        return {"onboarded": False}

    conversation_id = normalize_conversation_id(
        ctx.activity.conversation.id, "personal"
    )
    if not conversation_id:
        return {"onboarded": False}

    subscription_existed = fetch_subscription(conversation_id) is not None
    if not subscription_existed and not save_subscription(ctx, fallback_service_url):
        return {"onboarded": False}

    mapped_before = set(list_emails_for_conversation(conversation_id))

    # Registration already exists with email mapping; no need to remap each message.
    if subscription_existed and mapped_before:
        return {
            "onboarded": True,
            "new_registration": False,
            "new_mapped_emails": [],
            "mapped_emails": sorted(mapped_before),
        }

    candidates = await collect_candidate_emails(ctx)
    for email in candidates:
        save_email_mapping(email, conversation_id)

    mapped_after = set(list_emails_for_conversation(conversation_id))
    new_mapped_emails = sorted(mapped_after - mapped_before)

    return {
        "onboarded": True,
        "new_registration": not subscription_existed,
        "new_mapped_emails": new_mapped_emails,
        "mapped_emails": sorted(mapped_after),
    }


def fetch_email_mapping(email: str) -> dict[str, str] | None:
    """Return mapping record for a normalized email."""

    normalized_email = normalize_email(email)
    if not normalized_email:
        return None

    with session_scope() as session:
        record = session.get(EmailSubscriptionRecord, normalized_email)

    if record is None:
        return None

    conversation_id = str(record.conversation_id or "").strip()
    if not conversation_id:
        return None

    return {
        "email": normalize_email(record.email),
        "conversation_id": conversation_id,
        "updated_at_utc": str(record.updated_at_utc or utc_now_iso()),
    }


def fetch_subscription_for_email(
    email: str,
) -> tuple[SubscriptionPayload | None, str, str | None]:
    """Resolve email mapping to an active subscription."""

    mapping = fetch_email_mapping(email)
    if mapping is None:
        return (
            None,
            "",
            "No local mapping found for this email. "
            "Ask the user to open personal chat with the bot so profile-based mapping can be captured.",
        )

    conversation_id = str(mapping.get("conversation_id") or "")
    subscription = fetch_subscription(conversation_id)
    if subscription is None:
        # Remove stale mapping so next setup starts cleanly.
        delete_email_mapping(email)
        return (
            None,
            conversation_id,
            "Email mapping exists but the subscription is inactive. "
            "Add a valid conversation subscription and update the email mapping.",
        )

    return subscription, conversation_id, None


def delete_email_mapping(email: str) -> bool:
    """Remove an email mapping by email address."""

    normalized_email = normalize_email(email)
    if not normalized_email:
        return False

    with session_scope() as session:
        record = session.get(EmailSubscriptionRecord, normalized_email)
        if record is None:
            return False
        session.delete(record)
        return True


def list_emails_for_conversation(conversation_id: str) -> list[str]:
    """List all mapped emails for a conversation."""

    if not conversation_id:
        return []

    with session_scope() as session:
        rows = session.execute(
            select(EmailSubscriptionRecord.email).where(
                EmailSubscriptionRecord.conversation_id == conversation_id
            )
        ).all()

    return sorted(str(row[0]) for row in rows if row[0])

import re
from datetime import datetime, timezone
from typing import Iterable, TypeVar
from urllib.parse import unquote, urlparse

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
T = TypeVar("T")


def utc_now_iso() -> str:
    """Return current UTC timestamp in ISO format for metadata fields."""
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def normalize_conversation_id(conversation_id: str, scope: str) -> str:
    """Normalize conversation IDs for stable proactive messaging targets."""
    value = (conversation_id or "").strip()
    if not value:
        return value

    # In Teams channel threads, IDs can include ';messageid=...'.
    # For production alerts, target channel root so bot posts are top-level channel posts.
    if scope == "team" and ";messageid=" in value:
        value = value.split(";messageid=", 1)[0]
    return value


def normalize_target_conversation_input(value: str) -> str:
    """Normalize API input into a canonical Teams conversation ID."""
    normalized = (value or "").strip()
    if not normalized:
        return ""

    if normalized.startswith("https://teams.microsoft.com/l/channel/"):
        path = urlparse(normalized).path
        prefix = "/l/channel/"
        if prefix in path:
            normalized = path.split(prefix, 1)[1].split("/", 1)[0]

    normalized = unquote(normalized)
    if ";messageid=" in normalized:
        normalized = normalized.split(";messageid=", 1)[0]

    return normalized.strip()


def normalize_service_url(service_url: str) -> str:
    """
    Normalize Teams service URLs before SDK clients append versioned API paths.

    The current Teams SDK concatenates `service_url + "/v3/..."`, so preserving a
    trailing slash from inbound activities produces malformed `//v3/...` requests.
    """

    return str(service_url or "").strip().rstrip("/")


def is_valid_email(email: str) -> bool:
    """Validate basic email shape for mapping commands and API payloads."""
    return bool(EMAIL_REGEX.match((email or "").strip().lower()))


def normalize_email(value: object) -> str:
    """Normalize loose email-like input to a lowercase string."""
    return str(value or "").strip().lower()


def dedupe_preserve_order(values: Iterable[T]) -> list[T]:
    """Return input values without duplicates while preserving first-seen order."""
    seen: set[T] = set()
    ordered: list[T] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        ordered.append(value)
    return ordered

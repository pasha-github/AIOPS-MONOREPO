from typing import NotRequired, TypedDict


class SubscriptionPayload(TypedDict):
    conversation_id: str
    service_url: str
    channel_id: str
    conversation_type: str
    tenant_id: str | None


class PersonalOnboardingResult(TypedDict):
    onboarded: bool
    new_registration: NotRequired[bool]
    new_mapped_emails: NotRequired[list[str]]
    mapped_emails: NotRequired[list[str]]

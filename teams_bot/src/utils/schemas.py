from pydantic import BaseModel


class AlertConversationRequest(BaseModel):
    conversation_id: str
    message: str


class EmailAlertRequest(BaseModel):
    message: str
    email: str | None = None
    emails: list[str] | None = None


class AlertConversationFailure(BaseModel):
    conversation_id: str
    error: str


class AlertConversationResponse(BaseModel):
    status: str
    requested_count: int
    sent_count: int
    failed_count: int
    sent_to: list[str]
    failures: list[AlertConversationFailure]


class EmailAlertDelivery(BaseModel):
    email: str
    conversation_id: str


class EmailAlertFailure(BaseModel):
    email: str
    conversation_id: str | None = None
    error: str


class EmailAlertSingleResponse(BaseModel):
    status: str
    email: str
    conversation_id: str
    message_sent: bool


class EmailAlertBatchResponse(BaseModel):
    status: str
    requested_count: int
    sent_count: int
    failed_count: int
    sent_to: list[EmailAlertDelivery]
    failures: list[EmailAlertFailure]

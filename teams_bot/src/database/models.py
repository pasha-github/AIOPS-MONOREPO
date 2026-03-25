from sqlalchemy import String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class SubscriptionRecord(Base):
    __tablename__ = "subscriptions"

    conversation_id: Mapped[str] = mapped_column(String(512), primary_key=True)
    service_url: Mapped[str] = mapped_column(String(512), nullable=False)
    channel_id: Mapped[str] = mapped_column(
        String(64), nullable=False, default="msteams"
    )
    conversation_type: Mapped[str] = mapped_column(
        String(32), nullable=False, default="personal"
    )
    tenant_id: Mapped[str | None] = mapped_column(String(64), nullable=True)


class EmailSubscriptionRecord(Base):
    __tablename__ = "email_subscriptions"

    email: Mapped[str] = mapped_column(String(320), primary_key=True)
    conversation_id: Mapped[str] = mapped_column(
        String(512), index=True, nullable=False
    )
    updated_at_utc: Mapped[str] = mapped_column(String(40), nullable=False)

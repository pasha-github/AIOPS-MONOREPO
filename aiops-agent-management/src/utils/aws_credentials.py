import os
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from uuid import UUID

from sqlmodel import Session, col, select

from src.database.models import AwsCredential
from src.utils.constants import AWS_REGION
from src.utils.secrets import decrypt_secret


@dataclass(frozen=True)
class DecryptedAwsCredential:
    access_key_id: str
    secret_access_key: str
    session_token: str | None
    region: str


def get_default_aws_credential(session: Session) -> AwsCredential | None:
    return session.exec(
        select(AwsCredential)
        .where(col(AwsCredential.is_default).is_(True))
        .order_by(col(AwsCredential.updated_at).desc())
    ).first()


def get_aws_credential(
    session: Session,
    credential_id: UUID | None,
) -> AwsCredential | None:
    if credential_id is None:
        return get_default_aws_credential(session)
    if isinstance(credential_id, str):
        try:
            credential_id = UUID(credential_id)
        except ValueError:
            return None
    return session.get(AwsCredential, credential_id)


def decrypt_aws_credential(
    credential: AwsCredential | None,
) -> DecryptedAwsCredential | None:
    if credential is None:
        return None

    return DecryptedAwsCredential(
        access_key_id=decrypt_secret(credential.access_key_id),
        secret_access_key=decrypt_secret(credential.secret_access_key),
        session_token=(
            decrypt_secret(credential.session_token)
            if credential.session_token
            else None
        ),
        region=credential.region or AWS_REGION,
    )


@contextmanager
def aws_credentials_env(
    session: Session,
    credential_id: UUID | None = None,
) -> Iterator[None]:
    credential = decrypt_aws_credential(get_aws_credential(session, credential_id))
    if credential is None:
        yield
        return

    updates = {
        "AWS_ACCESS_KEY_ID": credential.access_key_id,
        "AWS_SECRET_ACCESS_KEY": credential.secret_access_key,
        "AWS_SESSION_TOKEN": credential.session_token,
        "AWS_REGION": credential.region,
        "AWS_DEFAULT_REGION": credential.region,
    }
    previous = {key: os.environ.get(key) for key in updates}
    try:
        for key, value in updates.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        yield
    finally:
        for key, value in previous.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

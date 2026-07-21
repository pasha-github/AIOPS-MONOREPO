from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from src.database.database import get_session
from src.database.models import AwsCredential
from src.utils.aws_credentials import get_default_aws_credential
from src.utils.constants import AWS_REGION
from src.utils.secrets import decrypt_secret, encrypt_secret

router = APIRouter(prefix="/aws/credentials", tags=["aws-credentials"])


class AwsCredentialCreate(BaseModel):
    name: str = Field(min_length=1)
    access_key_id: str = Field(min_length=1)
    secret_access_key: str = Field(min_length=1)
    session_token: str | None = None
    region: str = Field(default=AWS_REGION, min_length=1)
    is_default: bool = True


class AwsCredentialUpdate(BaseModel):
    name: str | None = None
    access_key_id: str | None = None
    secret_access_key: str | None = None
    session_token: str | None = None
    region: str | None = None
    is_default: bool | None = None


class AwsCredentialRead(BaseModel):
    credential_id: UUID
    name: str
    access_key_id: str
    region: str
    is_default: bool
    has_session_token: bool
    created_at: datetime
    updated_at: datetime


def _mask_access_key_id(value: str) -> str:
    decrypted = decrypt_secret(value)
    if len(decrypted) <= 4:
        return "****"
    return f"{'*' * max(len(decrypted) - 4, 4)}{decrypted[-4:]}"


def _to_read_model(credential: AwsCredential) -> AwsCredentialRead:
    return AwsCredentialRead(
        credential_id=credential.credential_id,
        name=credential.name,
        access_key_id=_mask_access_key_id(credential.access_key_id),
        region=credential.region,
        is_default=credential.is_default,
        has_session_token=bool(credential.session_token),
        created_at=credential.created_at,
        updated_at=credential.updated_at,
    )


def _clean_region(region: str | None) -> str:
    if region is None or not region.strip():
        raise HTTPException(status_code=400, detail="region cannot be empty")

    cleaned_region = region.strip()
    return cleaned_region


def _clean_session_token(session_token: str | None) -> str | None:
    if session_token is None:
        return None

    cleaned_token = session_token.strip()
    return cleaned_token


def _unset_default_for_other_credentials(
    session: Session,
    credential_id: UUID | None = None,
) -> None:
    credentials = session.exec(select(AwsCredential)).all()
    for credential in credentials:
        if credential.credential_id != credential_id:
            credential.is_default = False
            session.add(credential)


@router.post("/", response_model=AwsCredentialRead)
def create_aws_credential(
    credential: AwsCredentialCreate,
    session: Session = Depends(get_session),
):
    if credential.is_default:
        _unset_default_for_other_credentials(session)

    db_credential = AwsCredential(
        name=credential.name.strip(),
        access_key_id=encrypt_secret(credential.access_key_id.strip()),
        secret_access_key=encrypt_secret(credential.secret_access_key.strip()),
        session_token=(
            encrypt_secret(cleaned_session_token)
            if (cleaned_session_token := _clean_session_token(credential.session_token))
            else None
        ),
        region=_clean_region(credential.region),
        is_default=credential.is_default,
    )
    session.add(db_credential)
    session.commit()
    session.refresh(db_credential)
    return _to_read_model(db_credential)


@router.get("/", response_model=list[AwsCredentialRead])
def list_aws_credentials(session: Session = Depends(get_session)):
    credentials = session.exec(select(AwsCredential)).all()
    return [_to_read_model(credential) for credential in credentials]


@router.get("/default", response_model=AwsCredentialRead | None)
def get_default_credential(session: Session = Depends(get_session)):
    credential = get_default_aws_credential(session)
    return _to_read_model(credential) if credential else None


@router.patch("/{credential_id}", response_model=AwsCredentialRead)
def update_aws_credential(
    credential_id: UUID,
    credential_update: AwsCredentialUpdate,
    session: Session = Depends(get_session),
):
    credential = session.get(AwsCredential, credential_id)
    if credential is None:
        raise HTTPException(status_code=404, detail="AWS credential not found")

    return _update_aws_credential(credential, credential_update, session)


def _update_aws_credential(
    credential: AwsCredential,
    credential_update: AwsCredentialUpdate,
    session: Session,
) -> AwsCredentialRead:
    update_data = credential_update.model_dump(exclude_unset=True)
    if "name" in update_data:
        if update_data["name"] is None or not update_data["name"].strip():
            raise HTTPException(status_code=400, detail="name cannot be empty")
        credential.name = update_data["name"].strip()
    if "access_key_id" in update_data:
        if (
            update_data["access_key_id"] is None
            or not update_data["access_key_id"].strip()
        ):
            raise HTTPException(status_code=400, detail="access_key_id cannot be empty")
        credential.access_key_id = encrypt_secret(update_data["access_key_id"].strip())
    if "secret_access_key" in update_data:
        if (
            update_data["secret_access_key"] is None
            or not update_data["secret_access_key"].strip()
        ):
            raise HTTPException(
                status_code=400,
                detail="secret_access_key cannot be empty",
            )
        credential.secret_access_key = encrypt_secret(
            update_data["secret_access_key"].strip()
        )
    if "session_token" in update_data:
        credential.session_token = (
            encrypt_secret(cleaned_session_token)
            if (
                cleaned_session_token := _clean_session_token(
                    update_data["session_token"]
                )
            )
            else None
        )
    if "region" in update_data:
        credential.region = _clean_region(update_data["region"])
    if "is_default" in update_data:
        credential.is_default = update_data["is_default"]
        if credential.is_default:
            _unset_default_for_other_credentials(session, credential.credential_id)

    credential.updated_at = datetime.now()
    session.add(credential)
    session.commit()
    session.refresh(credential)
    return _to_read_model(credential)


@router.delete("/{credential_id}")
def delete_aws_credential(
    credential_id: UUID,
    session: Session = Depends(get_session),
):
    credential = session.get(AwsCredential, credential_id)
    if credential is None:
        raise HTTPException(status_code=404, detail="AWS credential not found")

    session.delete(credential)
    session.commit()
    return {"ok": True}

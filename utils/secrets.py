import os
from cryptography.fernet import Fernet, InvalidToken


ENCRYPTION_KEY_ENV = "ENCRYPTION_KEY"


def _get_cipher() -> Fernet:
    key = os.getenv(ENCRYPTION_KEY_ENV)
    if not key:
        raise RuntimeError(
            f"Missing required environment variable: {ENCRYPTION_KEY_ENV}"
        )
    return Fernet(key.encode("utf-8"))


def encrypt_secret(value: str) -> str:
    cipher = _get_cipher()
    return cipher.encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_secret(value: str) -> str:
    cipher = _get_cipher()
    try:
        return cipher.decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        # Backward compatibility for pre-encryption values already in DB.
        return value

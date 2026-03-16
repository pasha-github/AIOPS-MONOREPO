import pytest
from cryptography.fernet import Fernet

from utils.secrets import decrypt_secret, encrypt_secret


def test_encrypt_secret_roundtrip(monkeypatch: pytest.MonkeyPatch):
    key = Fernet.generate_key().decode("utf-8")
    monkeypatch.setenv("ENCRYPTION_KEY", key)

    raw = "my-secret-value"
    encrypted = encrypt_secret(raw)
    decrypted = decrypt_secret(encrypted)

    assert encrypted != raw
    assert decrypted == raw


def test_encrypt_secret_missing_env_key_raises(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("ENCRYPTION_KEY", raising=False)
    with pytest.raises(RuntimeError):
        encrypt_secret("x")


def test_decrypt_secret_legacy_plaintext_returns_input(monkeypatch: pytest.MonkeyPatch):
    key = Fernet.generate_key().decode("utf-8")
    monkeypatch.setenv("ENCRYPTION_KEY", key)

    # Backward compatibility path: non-Fernet token should be returned as-is.
    plaintext = "legacy-plain-text"
    assert decrypt_secret(plaintext) == plaintext

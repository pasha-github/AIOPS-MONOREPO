import base64
import json

from fastapi.testclient import TestClient


def _decode_jwt_payload(token: str):
    _header, payload, _signature = token.split(".")
    padding = "=" * (-len(payload) % 4)
    return json.loads(base64.urlsafe_b64decode(payload + padding))


def test_login_returns_jwt_for_admin_credentials(client: TestClient):
    response = client.post(
        "/login",
        json={"username": "admin", "password": "admin"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"
    assert data["access_token"].count(".") == 2

    payload = _decode_jwt_payload(data["access_token"])
    assert payload["sub"] == "admin"
    assert "iat" in payload
    assert "exp" in payload


def test_login_rejects_incorrect_credentials(client: TestClient):
    response = client.post(
        "/login",
        json={"username": "admin", "password": "wrong"},
    )

    assert response.status_code == 401
    assert response.json() == {"detail": "Incorrect username or password"}

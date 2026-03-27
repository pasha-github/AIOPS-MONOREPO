from fastapi.testclient import TestClient
from sqlmodel import Session

from database.models import Model


def test_create_model(client: TestClient):
    response = client.post(
        "/llms/",
        json={
            "model_id": "gemini-pro",
            "provider": "google",
            "name": "gemini-1.5-pro",
            "api_key": "test-key",
            "description": "A test model",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["model_id"] == "gemini-pro"
    assert "api_key" not in data


def test_list_models(client: TestClient):
    client.post(
        "/llms/",
        json={
            "model_id": "gemini-pro",
            "provider": "google",
            "name": "gemini-1.5-pro",
            "api_key": "test-key",
            "description": "Primary model",
        },
    )
    client.post(
        "/llms/",
        json={
            "model_id": "gemini-flash",
            "provider": "google",
            "name": "gemini-1.5-flash",
            "api_key": "test-key-2",
            "description": "Secondary model",
        },
    )

    response = client.get("/llms/")
    assert response.status_code == 200
    data = response.json()

    model_ids = {model["model_id"] for model in data}
    assert "gemini-pro" in model_ids
    assert "gemini-flash" in model_ids
    assert all("api_key" not in model for model in data)


def test_update_model_name_only(client: TestClient):
    client.post(
        "/llms/",
        json={
            "model_id": "gemini-pro",
            "provider": "google",
            "name": "gemini-1.5-pro",
            "api_key": "test-key",
            "description": "A test model",
        },
    )

    response = client.patch(
        "/llms/gemini-pro",
        json={"name": "gemini-2.0-flash"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["model_id"] == "gemini-pro"
    assert data["name"] == "gemini-2.0-flash"
    assert data["provider"] == "google"
    assert "api_key" not in data


def test_update_model_description_only(client: TestClient):
    client.post(
        "/llms/",
        json={
            "model_id": "gemini-pro",
            "provider": "google",
            "name": "gemini-1.5-pro",
            "api_key": "test-key",
            "description": "Old description",
        },
    )

    response = client.patch(
        "/llms/gemini-pro",
        json={"description": "Updated description"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["model_id"] == "gemini-pro"
    assert data["name"] == "gemini-1.5-pro"
    assert data["provider"] == "google"
    assert data["description"] == "Updated description"
    assert "api_key" not in data


def test_update_model_api_key_only(client: TestClient):
    client.post(
        "/llms/",
        json={
            "model_id": "gemini-pro",
            "provider": "google",
            "name": "gemini-1.5-pro",
            "api_key": "old-key",
            "description": "A test model",
        },
    )

    response = client.patch(
        "/llms/gemini-pro",
        json={"api_key": "new-key"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["model_id"] == "gemini-pro"
    assert data["name"] == "gemini-1.5-pro"
    assert data["provider"] == "google"
    assert "api_key" not in data


def test_update_model_not_found_404(client: TestClient):
    response = client.patch(
        "/llms/does-not-exist",
        json={"name": "new-name"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Model not found"


def test_update_model_empty_name_returns_400(client: TestClient):
    client.post(
        "/llms/",
        json={
            "model_id": "gemini-pro",
            "provider": "google",
            "name": "gemini-1.5-pro",
            "api_key": "test-key",
            "description": "desc",
        },
    )
    response = client.patch("/llms/gemini-pro", json={"name": "   "})
    assert response.status_code == 400
    assert response.json()["detail"] == "name cannot be empty"


def test_update_model_empty_description_returns_400(client: TestClient):
    client.post(
        "/llms/",
        json={
            "model_id": "gemini-pro",
            "provider": "google",
            "name": "gemini-1.5-pro",
            "api_key": "test-key",
            "description": "desc",
        },
    )
    response = client.patch("/llms/gemini-pro", json={"description": "   "})
    assert response.status_code == 400
    assert response.json()["detail"] == "description cannot be empty"


def test_update_model_empty_api_key_returns_400(client: TestClient):
    client.post(
        "/llms/",
        json={
            "model_id": "gemini-pro",
            "provider": "google",
            "name": "gemini-1.5-pro",
            "api_key": "test-key",
            "description": "desc",
        },
    )
    response = client.patch("/llms/gemini-pro", json={"api_key": "   "})
    assert response.status_code == 400
    assert response.json()["detail"] == "api_key cannot be empty"


def test_delete_model_success(client: TestClient):
    client.post(
        "/llms/",
        json={
            "model_id": "gemini-pro",
            "provider": "google",
            "name": "gemini-1.5-pro",
            "api_key": "test-key",
            "description": "A test model",
        },
    )

    response = client.delete("/llms/gemini-pro")
    assert response.status_code == 200
    assert response.json() == {"ok": True}

    list_response = client.get("/llms/")
    assert list_response.status_code == 200
    model_ids = {m["model_id"] for m in list_response.json()}
    assert "gemini-pro" not in model_ids


def test_delete_model_not_found_404(client: TestClient):
    response = client.delete("/llms/does-not-exist")
    assert response.status_code == 404
    assert response.json()["detail"] == "Model not found"


def test_update_model_multiple_fields(client: TestClient):
    client.post(
        "/llms/",
        json={
            "model_id": "gemini-pro",
            "provider": "google",
            "name": "gemini-1.5-pro",
            "api_key": "old-key",
            "description": "Old description",
        },
    )

    response = client.patch(
        "/llms/gemini-pro",
        json={
            "name": "gemini-2.0-pro",
            "description": "New description",
            "api_key": "new-key",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["model_id"] == "gemini-pro"
    assert data["name"] == "gemini-2.0-pro"
    assert data["provider"] == "google"
    assert data["description"] == "New description"
    assert "api_key" not in data


def test_create_model_missing_required_field_422(client: TestClient):
    response = client.post(
        "/llms/",
        json={
            "model_id": "gemini-pro",
            "provider": "google",
            # Missing required field: name
            "api_key": "test-key",
            "description": "A test model",
        },
    )
    assert response.status_code == 422


def test_update_model_empty_body_no_change(client: TestClient):
    client.post(
        "/llms/",
        json={
            "model_id": "gemini-pro",
            "provider": "google",
            "name": "gemini-1.5-pro",
            "api_key": "test-key",
            "description": "Original description",
        },
    )

    patch_response = client.patch("/llms/gemini-pro", json={})
    assert patch_response.status_code == 200
    patched = patch_response.json()
    assert patched["name"] == "gemini-1.5-pro"
    assert patched["description"] == "Original description"

    list_response = client.get("/llms/")
    assert list_response.status_code == 200
    models = {m["model_id"]: m for m in list_response.json()}
    assert models["gemini-pro"]["name"] == "gemini-1.5-pro"
    assert models["gemini-pro"]["description"] == "Original description"


def test_create_model_duplicate_model_id_conflict(client: TestClient):
    payload = {
        "model_id": "gemini-pro",
        "provider": "google",
        "name": "gemini-1.5-pro",
        "api_key": "test-key",
        "description": "A test model",
    }

    first = client.post("/llms/", json=payload)
    assert first.status_code == 200

    duplicate = client.post("/llms/", json=payload)
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "Model already exists"


def test_update_model_api_key_stored_encrypted(client: TestClient, session: Session):
    client.post(
        "/llms/",
        json={
            "model_id": "gemini-pro",
            "provider": "google",
            "name": "gemini-1.5-pro",
            "api_key": "old-key",
            "description": "A test model",
        },
    )

    response = client.patch(
        "/llms/gemini-pro",
        json={"api_key": "new-key"},
    )
    assert response.status_code == 200

    stored_model = session.get(Model, "gemini-pro")
    assert stored_model is not None
    assert stored_model.api_key != "new-key"


def test_delete_model_used_by_agent_returns_conflict(client: TestClient):
    client.post(
        "/llms/",
        json={
            "model_id": "gemini-pro",
            "provider": "google",
            "name": "gemini-1.5-pro",
            "api_key": "test-key",
            "description": "A test model",
        },
    )
    client.post(
        "/agent/",
        json={
            "agent_id": "agent-using-model",
            "name": "Agent",
            "description": "desc",
            "instruction": "instr",
            "model_id": "gemini-pro",
            "isEnabled": True,
        },
    )

    response = client.delete("/llms/gemini-pro")
    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["message"] == "Model is in use by agents"
    assert detail["agent_ids"] == ["agent-using-model"]

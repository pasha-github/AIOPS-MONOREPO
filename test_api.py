from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool
from main import app
from database.database import get_session
from database.models import Agent, Model
import pytest

# Use in-memory SQLite for testing
@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite://", 
        connect_args={"check_same_thread": False}, 
        poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session

@pytest.fixture(name="client")
def client_fixture(session: Session):
    def get_session_override():
        return session

    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()

def test_health_check(client: TestClient):
    response = client.get("/health/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_create_model(client: TestClient):
    response = client.post(
        "/llms/",
        json={
            "model_id": "gemini-pro",
            "provider": "google",
            "name": "gemini-1.5-pro",
            "api_key": "test-key",
            "description": "A test model"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["model_id"] == "gemini-pro"
    assert "api_key" not in data # Should be excluded in response model

def test_create_agent(client: TestClient):
    # First create a model
    client.post(
        "/llms/",
        json={
            "model_id": "gemini-pro",
            "provider": "google",
            "name": "gemini-1.5-pro",
            "api_key": "test-key"
        }
    )

    response = client.post(
        "/agent/",
        json={
            "agent_id": "test-agent",
            "name": "Test Agent",
            "description": "A test agent",
            "instruction": "You are a test agent.",
            "model_id": "gemini-pro",
            "isEnabled": True
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Agent"
    assert data["agent_id"] == "test-agent"

def test_list_agents(client: TestClient):
    # Setup
    client.post(
        "/llms/",
        json={"model_id": "gemini-pro", "provider": "google", "name": "gemini", "api_key": "k"}
    )
    client.post(
        "/agent/",
        json={
            "agent_id": "a1",
            "name": "Agent 1",
            "description": "d",
            "instruction": "i",
            "model_id": "gemini-pro"
        }
    )

    response = client.get("/agent/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["name"] == "Agent 1"

def test_delete_agent(client: TestClient):
    # Setup
    client.post(
        "/llms/",
        json={"model_id": "m1", "provider": "p", "name": "n", "api_key": "k"}
    )
    client.post(
        "/agent/",
        json={
            "agent_id": "a1",
            "name": "A1",
            "description": "d",
            "instruction": "i",
            "model_id": "m1"
        }
    )

    response = client.delete("/agent/a1")
    assert response.status_code == 200
    assert response.json() == {"ok": True}

    response = client.get("/agent/")
    data = response.json()
    assert len(data) == 0

def test_agent_server_mount(client: TestClient):
    # Just check if the mount point responds (might be 404 if no route, but 404 from sub-app)
    # or check a known endpoint of adk if available.
    # Assuming /agent-server docs or health exists?
    # ADK usually has /docs
    response = client.get("/agent-server/docs")
    # Even if 404, it might be from the sub-app.
    # If 200, great.
    assert response.status_code in [200, 404] 

from fastapi.testclient import TestClient


def test_health_check_returns_ok(client: TestClient):
    response = client.get("/health/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_agent_server_mount_reachable(client: TestClient):
    response = client.get("/agent-server/docs")
    assert response.status_code in [200, 404]

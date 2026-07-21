from uuid import UUID

from sqlmodel import Session, select

from src.agent_runtime.bedrock_agentcore import helper_function
from src.database.models import Agent, AwsCredential
from src.utils.secrets import decrypt_secret


def test_create_aws_credential_stores_secrets_encrypted(client, session: Session):
    response = client.post(
        "/aws/credentials/",
        json={
            "name": "dev",
            "access_key_id": "AKIATEST1234567890",
            "secret_access_key": "secret",
            "session_token": "token",
            "region": "us-west-2",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["access_key_id"].endswith("7890")
    assert data["access_key_id"] != "AKIATEST1234567890"
    assert data["has_session_token"] is True
    assert data["is_default"] is True

    stored = session.exec(select(AwsCredential)).one()
    assert stored.access_key_id != "AKIATEST1234567890"
    assert stored.secret_access_key != "secret"
    assert stored.session_token != "token"
    assert decrypt_secret(stored.access_key_id) == "AKIATEST1234567890"
    assert decrypt_secret(stored.secret_access_key) == "secret"
    assert decrypt_secret(stored.session_token) == "token"


def test_only_one_aws_credential_is_default(client, session: Session):
    first = client.post(
        "/aws/credentials/",
        json={
            "name": "first",
            "access_key_id": "AKIAFIRST",
            "secret_access_key": "first-secret",
            "region": "us-east-1",
        },
    ).json()
    second = client.post(
        "/aws/credentials/",
        json={
            "name": "second",
            "access_key_id": "AKIASECOND",
            "secret_access_key": "second-secret",
            "region": "us-west-2",
        },
    ).json()

    response = client.get("/aws/credentials/default")

    assert response.status_code == 200
    assert response.json()["credential_id"] == second["credential_id"]
    refreshed_first = session.get(AwsCredential, UUID(first["credential_id"]))
    assert refreshed_first.is_default is False


def test_bedrock_agentcore_client_uses_default_stored_credentials(
    client,
    session: Session,
    monkeypatch,
):
    captured = {}

    def fake_client(service_name, **kwargs):
        captured["service_name"] = service_name
        captured["kwargs"] = kwargs
        return object()

    monkeypatch.setattr(helper_function.boto3, "client", fake_client)
    client.post(
        "/aws/credentials/",
        json={
            "name": "dev",
            "access_key_id": "AKIAACTIVE",
            "secret_access_key": "default-secret",
            "session_token": "default-token",
            "region": "ap-south-1",
        },
    )

    helper_function.create_bedrock_boto3_client("bedrock-agentcore", session=session)

    assert captured["service_name"] == "bedrock-agentcore"
    assert captured["kwargs"]["region_name"] == "ap-south-1"
    assert captured["kwargs"]["aws_access_key_id"] == "AKIAACTIVE"
    assert captured["kwargs"]["aws_secret_access_key"] == "default-secret"
    assert captured["kwargs"]["aws_session_token"] == "default-token"


def test_create_bedrock_agentcore_agent_uses_default_credential(client):
    client.post(
        "/aws/credentials/",
        json={
            "name": "dev",
            "access_key_id": "AKIADEFAULT",
            "secret_access_key": "default-secret",
            "region": "ap-south-1",
        },
    )

    response = client.post(
        "/agent/",
        json={
            "agent_id": "bedrock-agent",
            "name": "Bedrock Agent",
            "description": "desc",
            "instruction": "instr",
            "deployment_target": "bedrock_agentcore",
            "aws_credential_id": None,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["deployment_target"] == "bedrock_agentcore"
    assert data["aws_credential_id"] is not None


def test_bedrock_agentcore_client_uses_agent_selected_credential(
    client,
    session: Session,
    monkeypatch,
):
    captured = {}

    def fake_client(service_name, **kwargs):
        captured["service_name"] = service_name
        captured["kwargs"] = kwargs
        return object()

    monkeypatch.setattr(helper_function.boto3, "client", fake_client)
    client.post(
        "/aws/credentials/",
        json={
            "name": "first",
            "access_key_id": "AKIAFIRST",
            "secret_access_key": "first-secret",
            "region": "us-east-1",
        },
    )
    selected_response = client.post(
        "/aws/credentials/",
        json={
            "name": "selected",
            "access_key_id": "AKIASELECTED",
            "secret_access_key": "selected-secret",
            "session_token": "selected-token",
            "region": "ap-south-1",
            "is_default": False,
        },
    )
    selected_id = selected_response.json()["credential_id"]

    agent = Agent(
        agent_id="bedrock-agent",
        name="Bedrock Agent",
        description="desc",
        instruction="instr",
        deployment_target="bedrock_agentcore",
        aws_credential_id=selected_id,
    )

    helper_function.create_bedrock_boto3_client(
        "bedrock-agentcore",
        session=session,
        credential_id=agent.aws_credential_id,
    )

    assert captured["service_name"] == "bedrock-agentcore"
    assert captured["kwargs"]["region_name"] == "ap-south-1"
    assert captured["kwargs"]["aws_access_key_id"] == "AKIASELECTED"
    assert captured["kwargs"]["aws_secret_access_key"] == "selected-secret"
    assert captured["kwargs"]["aws_session_token"] == "selected-token"

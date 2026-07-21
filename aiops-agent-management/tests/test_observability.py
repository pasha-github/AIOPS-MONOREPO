from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session

from src.database.models import ObservabilitySpan, ObservabilityTokenUsage


def test_observability_returns_spans_in_adk_format(
    client: TestClient,
    session: Session,
):
    session.add(
        ObservabilitySpan(
            agent_id="cloudfare",
            session_id="session-1",
            name="call_llm",
            span_id="17957863617906536000",
            trace_id="286416009371391660000000000000000000000",
            start_time=1778359585774557200,
            end_time=1778359589676030700,
            attributes={"gen_ai.usage.input_tokens": 912},
            parent_span_id="2235668140932631000",
        )
    )
    session.commit()

    response = client.get("/observability/cloudfare/session-1")

    assert response.status_code == 200
    assert response.json() == [
        {
            "name": "call_llm",
            "span_id": 17957863617906536000,
            "trace_id": 286416009371391660000000000000000000000,
            "start_time": 1778359585774557200,
            "end_time": 1778359589676030700,
            "attributes": {"gen_ai.usage.input_tokens": 912},
            "parent_span_id": 2235668140932631000,
        }
    ]


def test_observability_returns_empty_span_list(client: TestClient):
    response = client.get("/observability/cloudfare/missing-session")

    assert response.status_code == 200
    assert response.json() == []


def test_token_usage_is_cumulative_by_session_agent_and_model(
    client: TestClient,
    session: Session,
):
    session.add_all(
        [
            ObservabilityTokenUsage(
                agent_id="cloudfare",
                session_id="session-1",
                llm_model="gemini/gemini-3-flash-preview",
                input_tokens=100,
                output_tokens=20,
                total_tokens=120,
            ),
            ObservabilityTokenUsage(
                agent_id="cloudfare",
                session_id="session-1",
                llm_model="gemini/gemini-3-flash-preview",
                input_tokens=50,
                output_tokens=10,
                total_tokens=60,
            ),
            ObservabilityTokenUsage(
                agent_id="another-agent",
                session_id="session-2",
                llm_model="gemini/gemini-3-flash-preview",
                input_tokens=7,
                output_tokens=3,
                total_tokens=10,
            ),
            ObservabilityTokenUsage(
                agent_id="another-agent",
                session_id="session-3",
                llm_model="anthropic/claude-haiku-4-5",
                input_tokens=1_000_000,
                output_tokens=1_000_000,
                total_tokens=2_000_000,
            ),
            ObservabilityTokenUsage(
                agent_id="old-agent",
                session_id="session-4",
                llm_model="gemini/gemini-2.5-flash",
                input_tokens=1_000_000,
                output_tokens=1_000_000,
                total_tokens=2_000_000,
                created_at=datetime.now() - timedelta(days=10),
            ),
        ]
    )
    session.commit()

    session_response = client.get(
        "/observability/token-usage/session/cloudfare/session-1"
    )
    agent_response = client.get("/observability/token-usage/agent/cloudfare")
    model_response = client.get(
        "/observability/token-usage/model/gemini%2Fgemini-3-flash-preview"
    )
    all_agents_response = client.get("/observability/token-usage/agents")
    all_models_response = client.get("/observability/token-usage/models")
    recent_models_response = client.get("/observability/token-usage/models?days=2")

    assert session_response.json() == {
        "agent_id": "cloudfare",
        "session_id": "session-1",
        "input_tokens": 150,
        "output_tokens": 30,
        "total_tokens": 180,
    }
    assert agent_response.json() == {
        "agent_id": "cloudfare",
        "input_tokens": 150,
        "output_tokens": 30,
        "total_tokens": 180,
    }
    assert model_response.json() == {
        "llm_model": "gemini/gemini-3-flash-preview",
        "input_tokens": 157,
        "output_tokens": 33,
        "total_tokens": 190,
    }
    assert all_agents_response.json() == [
        {
            "agent_id": "another-agent",
            "input_tokens": 1000007,
            "output_tokens": 1000003,
            "total_tokens": 2000010,
        },
        {
            "agent_id": "cloudfare",
            "input_tokens": 150,
            "output_tokens": 30,
            "total_tokens": 180,
        },
        {
            "agent_id": "old-agent",
            "input_tokens": 1000000,
            "output_tokens": 1000000,
            "total_tokens": 2000000,
        },
    ]
    assert all_models_response.json() == [
        {
            "llm_model": "anthropic/claude-haiku-4-5",
            "input_tokens": 1000000,
            "output_tokens": 1000000,
            "total_tokens": 2000000,
            "input_cost": 1.0,
            "output_cost": 5.0,
            "total_cost": 6.0,
            "pricing": {
                "input_cost_per_million_tokens": 1.0,
                "output_cost_per_million_tokens": 5.0,
            },
        },
        {
            "llm_model": "gemini/gemini-2.5-flash",
            "input_tokens": 1000000,
            "output_tokens": 1000000,
            "total_tokens": 2000000,
            "input_cost": 0.3,
            "output_cost": 2.5,
            "total_cost": 2.8,
            "pricing": {
                "input_cost_per_million_tokens": 0.3,
                "output_cost_per_million_tokens": 2.5,
            },
        },
        {
            "llm_model": "gemini/gemini-3-flash-preview",
            "input_tokens": 157,
            "output_tokens": 33,
            "total_tokens": 190,
            "input_cost": 0.000079,
            "output_cost": 0.000099,
            "total_cost": 0.000178,
            "pricing": {
                "input_cost_per_million_tokens": 0.5,
                "output_cost_per_million_tokens": 3.0,
            },
        },
    ]
    assert recent_models_response.json() == [
        {
            "llm_model": "anthropic/claude-haiku-4-5",
            "input_tokens": 1000000,
            "output_tokens": 1000000,
            "total_tokens": 2000000,
            "input_cost": 1.0,
            "output_cost": 5.0,
            "total_cost": 6.0,
            "pricing": {
                "input_cost_per_million_tokens": 1.0,
                "output_cost_per_million_tokens": 5.0,
            },
        },
        {
            "llm_model": "gemini/gemini-3-flash-preview",
            "input_tokens": 157,
            "output_tokens": 33,
            "total_tokens": 190,
            "input_cost": 0.000079,
            "output_cost": 0.000099,
            "total_cost": 0.000178,
            "pricing": {
                "input_cost_per_million_tokens": 0.5,
                "output_cost_per_million_tokens": 3.0,
            },
        },
    ]

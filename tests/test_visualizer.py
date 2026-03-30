from uuid import uuid4

from fastapi.testclient import TestClient

from database.models import Agent, ConnectorConfig, Job, Model, Webhook


def _create_model(client: TestClient, model_id: str = "viz-model"):
    return client.post(
        "/llms/",
        json={
            "model_id": model_id,
            "provider": "google",
            "name": "gemini-1.5-pro",
            "api_key": "super-secret-key",
            "description": "Visualizer model",
        },
    )


def _edges_by_id(data: dict) -> dict:
    return {edge["id"]: edge for edge in data["edges"]}


def test_visualizer_returns_empty_graph(client: TestClient):
    response = client.get("/visualizer/")

    assert response.status_code == 200
    assert response.json() == {"nodes": [], "edges": []}


def test_visualizer_returns_expected_nodes_edges_and_masked_data(client: TestClient, session):
    _create_model(client, model_id="viz-model")

    connector_id = uuid4()
    session.add(
        ConnectorConfig(
            connector_config_id=connector_id,
            name="ServiceNow Prod",
            connector_id="servicenow_connector",
            config=[
                {"name": "instance_url", "value": "https://example.service-now.com"},
                {"name": "api_token", "value": "plain-secret"},
            ],
        )
    )

    session.add(
        Agent(
            agent_id="child-agent",
            name="Child Agent",
            description="Child agent",
            instruction="Child instructions",
            model_id="viz-model",
        )
    )

    session.add(
        Agent(
            agent_id="parent-agent",
            name="Parent Agent",
            description="Parent agent",
            instruction="Parent instructions",
            model_id="viz-model",
            sub_agents=["child-agent"],
            connector_config_ids=[str(connector_id)],
            mcp_servers=["http://localhost:8000/sse"],
            type="automation",
        )
    )

    session.add(
        Webhook(
            agent_id="parent-agent",
            prompt="run webhook",
        )
    )
    session.add(
        Job(
            agent_id="parent-agent",
            prompt="run scheduled task",
            interval_seconds=60,
        )
    )
    session.commit()

    response = client.get("/visualizer/")

    assert response.status_code == 200
    data = response.json()

    nodes = {node["id"]: node for node in data["nodes"]}
    edges = {(edge["source"], edge["target"]) for edge in data["edges"]}

    assert set(nodes) == {
        "parent-agent",
        "child-agent",
        str(connector_id),
        "http://localhost:8000/sse",
    }
    assert {node["type"] for node in data["nodes"]} == {"agent", "connector", "mcp"}

    assert ("parent-agent", "child-agent") in edges
    assert ("parent-agent", str(connector_id)) in edges
    assert ("parent-agent", "http://localhost:8000/sse") in edges

    parent_agent_data = nodes["parent-agent"]["data"]["agent"]
    assert parent_agent_data["model"]["model_id"] == "viz-model"
    assert parent_agent_data["model"]["api_key"] == "***"
    assert len(parent_agent_data["webhooks"]) == 1
    assert parent_agent_data["webhooks"][0]["agent_id"] == "parent-agent"
    assert len(parent_agent_data["jobs"]) == 1
    assert parent_agent_data["jobs"][0]["interval_seconds"] == 60

    connector_data = nodes[str(connector_id)]["data"]["connector"]
    assert connector_data["name"] == "ServiceNow Prod"
    assert connector_data["config"] == [
        {"name": "instance_url", "value": "***"},
        {"name": "api_token", "value": "***"},
    ]

    mcp_data = nodes["http://localhost:8000/sse"]["data"]["mcp"]
    assert mcp_data == {
        "name": "http://localhost:8000/sse",
        "url": "http://localhost:8000/sse",
    }


def test_visualizer_includes_agents_with_no_optional_relationships(client: TestClient):
    _create_model(client, model_id="solo-model")

    create_agent_response = client.post(
        "/agent/",
        json={
            "agent_id": "solo-agent",
            "name": "Solo Agent",
            "description": "No relationships",
            "instruction": "Work alone",
            "model_id": "solo-model",
        },
    )
    assert create_agent_response.status_code == 200

    response = client.get("/visualizer/")

    assert response.status_code == 200
    data = response.json()
    assert len(data["nodes"]) == 1
    assert data["edges"] == []

    node = data["nodes"][0]
    assert node["id"] == "solo-agent"
    assert node["type"] == "agent"
    assert node["data"]["agent"]["model"]["model_id"] == "solo-model"
    assert node["data"]["agent"]["webhooks"] == []
    assert node["data"]["agent"]["jobs"] == []
    assert node["data"]["agent"]["sub_agents"] == []
    assert node["data"]["agent"]["connector_config_ids"] == []
    assert node["data"]["agent"]["mcp_servers"] == []


def test_visualizer_aggregates_multiple_webhooks_jobs_and_relationships(client: TestClient, session):
    _create_model(client, model_id="agg-model")

    connector_one = uuid4()
    connector_two = uuid4()
    session.add_all(
        [
            ConnectorConfig(
                connector_config_id=connector_one,
                name="Conn One",
                connector_id="example_connector",
                config=[{"name": "token", "value": "a"}],
            ),
            ConnectorConfig(
                connector_config_id=connector_two,
                name="Conn Two",
                connector_id="servicenow_connector",
                config=[{"name": "token", "value": "b"}],
            ),
            Agent(
                agent_id="child-one",
                name="Child One",
                description="child",
                instruction="instr",
                model_id="agg-model",
            ),
            Agent(
                agent_id="child-two",
                name="Child Two",
                description="child",
                instruction="instr",
                model_id="agg-model",
            ),
            Agent(
                agent_id="aggregator",
                name="Aggregator",
                description="parent",
                instruction="instr",
                model_id="agg-model",
                sub_agents=["child-one", "child-two"],
                connector_config_ids=[str(connector_one), str(connector_two)],
                mcp_servers=["http://localhost:7100/sse", "http://localhost:7200/mcp"],
                type="automation",
            ),
            Webhook(agent_id="aggregator", prompt="webhook one"),
            Webhook(agent_id="aggregator", prompt="webhook two"),
            Job(agent_id="aggregator", prompt="job one", interval_seconds=30),
            Job(agent_id="aggregator", prompt="job two", cron_expression="*/5 * * * *"),
        ]
    )
    session.commit()

    response = client.get("/visualizer/")

    assert response.status_code == 200
    data = response.json()
    nodes = {node["id"]: node for node in data["nodes"]}
    edges = _edges_by_id(data)

    aggregator = nodes["aggregator"]["data"]["agent"]
    assert {item["prompt"] for item in aggregator["webhooks"]} == {"webhook one", "webhook two"}
    assert {item["prompt"] for item in aggregator["jobs"]} == {"job one", "job two"}

    assert edges["e-aggregator-child-one"] == {
        "id": "e-aggregator-child-one",
        "source": "aggregator",
        "target": "child-one",
    }
    assert edges["e-aggregator-child-two"] == {
        "id": "e-aggregator-child-two",
        "source": "aggregator",
        "target": "child-two",
    }
    assert edges[f"e-aggregator-{connector_one}"]["target"] == str(connector_one)
    assert edges[f"e-aggregator-{connector_two}"]["target"] == str(connector_two)
    assert edges["e-aggregator-http://localhost:7100/sse"]["target"] == "http://localhost:7100/sse"
    assert edges["e-aggregator-http://localhost:7200/mcp"]["target"] == "http://localhost:7200/mcp"


def test_visualizer_sets_model_to_none_when_linked_model_missing(client: TestClient, session):
    session.add(
        Agent(
            agent_id="orphan-model-agent",
            name="Orphan Model Agent",
            description="missing model",
            instruction="instr",
            model_id="missing-model-id",
        )
    )
    session.commit()

    response = client.get("/visualizer/")

    assert response.status_code == 200
    data = response.json()
    assert len(data["nodes"]) == 1
    assert data["nodes"][0]["data"]["agent"]["model"] is None


def test_visualizer_preserves_duplicate_relationship_entries(client: TestClient, session):
    _create_model(client, model_id="dup-model")

    connector_id = uuid4()
    session.add(
        ConnectorConfig(
            connector_config_id=connector_id,
            name="Duplicate Connector",
            connector_id="example_connector",
            config=[{"name": "token", "value": "secret"}],
        )
    )
    session.add(
        Agent(
            agent_id="dup-agent",
            name="Duplicate Agent",
            description="dup",
            instruction="dup",
            model_id="dup-model",
            sub_agents=["dup-child", "dup-child"],
            connector_config_ids=[str(connector_id), str(connector_id)],
            mcp_servers=["http://localhost:7300/sse", "http://localhost:7300/sse"],
        )
    )
    session.add(
        Agent(
            agent_id="dup-child",
            name="Duplicate Child",
            description="child",
            instruction="child",
            model_id="dup-model",
        )
    )
    session.commit()

    response = client.get("/visualizer/")

    assert response.status_code == 200
    data = response.json()

    assert [edge["id"] for edge in data["edges"]].count("e-dup-agent-dup-child") == 2
    assert [edge["id"] for edge in data["edges"]].count(f"e-dup-agent-{connector_id}") == 2
    assert [edge["id"] for edge in data["edges"]].count("e-dup-agent-http://localhost:7300/sse") == 2

    mcp_nodes = [node for node in data["nodes"] if node["type"] == "mcp"]
    assert len(mcp_nodes) == 1
    assert mcp_nodes[0]["id"] == "http://localhost:7300/sse"


def test_visualizer_masks_only_connector_config_items_with_value_key(client: TestClient, session):
    _create_model(client, model_id="mask-model")

    connector_id = uuid4()
    session.add(
        ConnectorConfig(
            connector_config_id=connector_id,
            name="Mixed Connector",
            connector_id="example_connector",
            config=[
                {"name": "username", "value": "alice"},
                {"name": "metadata", "note": "keep-me"},
            ],
        )
    )
    session.add(
        Agent(
            agent_id="mask-agent",
            name="Mask Agent",
            description="mask",
            instruction="mask",
            model_id="mask-model",
            connector_config_ids=[str(connector_id)],
        )
    )
    session.commit()

    response = client.get("/visualizer/")

    assert response.status_code == 200
    data = response.json()
    nodes = {node["id"]: node for node in data["nodes"]}

    assert nodes[str(connector_id)]["data"]["connector"]["config"] == [
        {"name": "username", "value": "***"},
        {"name": "metadata", "note": "keep-me"},
    ]


def test_visualizer_keeps_non_list_connector_config_unchanged(client: TestClient, session):
    _create_model(client, model_id="non-list-model")

    connector_id = uuid4()
    session.add(
        ConnectorConfig(
            connector_config_id=connector_id,
            name="String Config Connector",
            connector_id="example_connector",
            config="raw-config-value",
        )
    )
    session.add(
        Agent(
            agent_id="non-list-agent",
            name="Non List Agent",
            description="non-list",
            instruction="non-list",
            model_id="non-list-model",
            connector_config_ids=[str(connector_id)],
        )
    )
    session.commit()

    response = client.get("/visualizer/")

    assert response.status_code == 200
    data = response.json()
    nodes = {node["id"]: node for node in data["nodes"]}

    assert nodes[str(connector_id)]["data"]["connector"]["config"] == "raw-config-value"


def test_visualizer_deduplicates_shared_mcp_nodes(client: TestClient, session):
    session.add(
        Model(
            model_id="m1",
            provider="google",
            name="gemini-1.5-flash",
            api_key="encrypted-or-plain",
            description="shared model",
        )
    )
    session.add(
        Agent(
            agent_id="agent-a",
            name="Agent A",
            description="A",
            instruction="A",
            model_id="m1",
            mcp_servers=["http://localhost:9000/sse"],
        )
    )
    session.add(
        Agent(
            agent_id="agent-b",
            name="Agent B",
            description="B",
            instruction="B",
            model_id="m1",
            mcp_servers=["http://localhost:9000/sse"],
        )
    )
    session.commit()

    response = client.get("/visualizer/")

    assert response.status_code == 200
    data = response.json()

    mcp_nodes = [node for node in data["nodes"] if node["type"] == "mcp"]
    assert len(mcp_nodes) == 1
    assert mcp_nodes[0]["id"] == "http://localhost:9000/sse"

    edges = {(edge["source"], edge["target"]) for edge in data["edges"]}
    assert ("agent-a", "http://localhost:9000/sse") in edges
    assert ("agent-b", "http://localhost:9000/sse") in edges

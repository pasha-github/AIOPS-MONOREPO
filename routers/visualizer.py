from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from database.database import get_session
from database.models import Agent, ConnectorConfig, Job, Model, Webhook

router = APIRouter(prefix="/visualizer", tags=["visualizer"])


@router.get("/")
def get_visualizer(session: Session = Depends(get_session)):
    agents = session.exec(select(Agent)).all()
    connectors = session.exec(select(ConnectorConfig)).all()
    models = session.exec(select(Model)).all()
    webhooks = session.exec(select(Webhook)).all()
    jobs = session.exec(select(Job)).all()

    models_map = {}
    for m in models:
        m_dict = m.model_dump()
        if "api_key" in m_dict:
            m_dict["api_key"] = "***"
        models_map[m.model_id] = m_dict

    webhooks_map = {}
    for w in webhooks:
        if w.agent_id not in webhooks_map:
            webhooks_map[w.agent_id] = []
        webhooks_map[w.agent_id].append(w.model_dump())

    jobs_map = {}
    for j in jobs:
        if j.agent_id not in jobs_map:
            jobs_map[j.agent_id] = []
        jobs_map[j.agent_id].append(j.model_dump())

    nodes = []
    edges = []

    mcp_set = set()

    for agent in agents:
        agent_data = agent.model_dump()
        agent_data["model"] = models_map.get(agent.model_id)
        agent_data["webhooks"] = webhooks_map.get(agent.agent_id, [])
        agent_data["jobs"] = jobs_map.get(agent.agent_id, [])

        nodes.append(
            {"id": agent.agent_id, "type": "agent", "data": {"agent": agent_data}}
        )

        if agent.sub_agents:
            for sub_agent_id in agent.sub_agents:
                edges.append(
                    {
                        "id": f"e-{agent.agent_id}-{sub_agent_id}",
                        "source": agent.agent_id,
                        "target": sub_agent_id,
                    }
                )

        if agent.connector_config_ids:
            for conn_id in agent.connector_config_ids:
                edges.append(
                    {
                        "id": f"e-{agent.agent_id}-{conn_id}",
                        "source": agent.agent_id,
                        "target": conn_id,
                    }
                )

        if agent.mcp_servers:
            for mcp_url in agent.mcp_servers:
                mcp_set.add(mcp_url)
                edges.append(
                    {
                        "id": f"e-{agent.agent_id}-{mcp_url}",
                        "source": agent.agent_id,
                        "target": mcp_url,
                    }
                )

    for conn in connectors:
        c_dict = conn.model_dump()
        if "config" in c_dict and isinstance(c_dict["config"], list):
            for item in c_dict["config"]:
                if "value" in item:
                    item["value"] = "***"

        nodes.append(
            {
                "id": str(conn.connector_config_id),
                "type": "connector",
                "data": {"connector": c_dict},
            }
        )

    for mcp_url in mcp_set:
        nodes.append(
            {
                "id": mcp_url,
                "type": "mcp",
                "data": {"mcp": {"name": mcp_url, "url": mcp_url}},
            }
        )

    return {"nodes": nodes, "edges": edges}

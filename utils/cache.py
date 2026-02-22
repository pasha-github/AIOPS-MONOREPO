from typing import Any, Dict, Optional

class AgentCache:
    _instance = None
    _cache: Dict[str, Any] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AgentCache, cls).__new__(cls)
        return cls._instance

    def get_agent(self, agent_id: str) -> Optional[Any]:
        return self._cache.get(agent_id)

    def set_agent(self, agent_id: str, agent: Any):
        self._cache[agent_id] = agent

    def remove_agent(self, agent_id: str):
        if agent_id in self._cache:
            del self._cache[agent_id]

cache = AgentCache()

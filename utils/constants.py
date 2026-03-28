import os

AGENT_SERVER_DATABASE_URL = os.getenv(
    "AGENT_SERVER_DATABASE_URL", "sqlite:///agent_management.db"
)
ENV = os.getenv("ENV", "DEV")
A2A = os.getenv("A2A", False)
WEB = ENV == "DEV"

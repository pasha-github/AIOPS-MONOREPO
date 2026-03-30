import os

from dotenv import load_dotenv

load_dotenv()

MAIN_SERVER_DATABASE_URL = os.getenv(
    "MAIN_SERVER_DATABASE_URL", "sqlite:///agent_management.db"
)

AGENT_SERVER_DATABASE_URL = os.getenv(
    "AGENT_SERVER_DATABASE_URL", "sqlite:///agent_management.db"
)

ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
SUMMARIZER_MODEL = os.getenv("SUMMARIZER_MODEL")
ENV = os.getenv("ENV", "DEV")
A2A = os.getenv("A2A", False)

# Derived constants
WEB = ENV == "DEV"

import os

from dotenv import load_dotenv

from utils.db_url import encode_database_url_password

load_dotenv()

MAIN_SERVER_DATABASE_URL = encode_database_url_password(
    os.getenv("MAIN_SERVER_DATABASE_URL", "sqlite:///agent_management.db")
)

AGENT_SERVER_DATABASE_URL = encode_database_url_password(
    os.getenv("AGENT_SERVER_DATABASE_URL", "sqlite:///agent_management.db")
)

ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
SUMMARIZER_MODEL = os.getenv("SUMMARIZER_MODEL")
ENV = os.getenv("ENV", "DEV")
A2A = os.getenv("A2A", False)
HARDCODED_FALLBACK_MODELS = [
    "gemini/gemini-3-flash-preview",
    "anthropic/claude-haiku-4-5-20251001"
]

# Derived constants
WEB = ENV == "DEV"

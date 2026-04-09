import os

from dotenv import load_dotenv

from src.database.db_url import encode_database_url_password

load_dotenv()

MAIN_SERVER_DATABASE_URL = encode_database_url_password(
    os.getenv("MAIN_SERVER_DATABASE_URL", "sqlite:///agent_management.db")
)

AGENT_SERVER_DATABASE_URL = encode_database_url_password(
    os.getenv("AGENT_SERVER_DATABASE_URL", "sqlite:///agent_management.db")
)

ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
ENV = os.getenv("ENV", "DEV")
A2A = os.getenv("A2A", False)

# Derived constants
WEB = ENV == "DEV"

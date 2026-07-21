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
POSTGRES_AGENT_SERVER_DATABASE_URL = encode_database_url_password(
    os.getenv("POSTGRES_AGENT_SERVER_DATABASE_URL", "")
)

ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
ENV = os.getenv("ENV", "DEV")
A2A = os.getenv("A2A", False)
GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT")
GOOGLE_CLOUD_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION")
GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
VERTEX_STAGING_BUCKET = os.getenv("VERTEX_STAGING_BUCKET")
VERTEX_SERVICE_ACCOUNT = os.getenv("VERTEX_SERVICE_ACCOUNT")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
BEDROCK_AGENTCORE_EXECUTION_ROLE = os.getenv("BEDROCK_AGENTCORE_EXECUTION_ROLE")
BEDROCK_AGENTCORE_AUTO_CREATE_EXECUTION_ROLE = (
    os.getenv("BEDROCK_AGENTCORE_AUTO_CREATE_EXECUTION_ROLE", "true").lower() == "true"
)
BEDROCK_AGENTCORE_AUTO_CREATE_ECR = (
    os.getenv("BEDROCK_AGENTCORE_AUTO_CREATE_ECR", "true").lower() == "true"
)

GOOGLE_GCP_AGENT_EVAL_BUCKET = os.getenv("GOOGLE_GCP_AGENT_EVAL_BUCKET", None)

# Derived constants
WEB = ENV == "DEV"

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

# SOP ingestion: run a background ingestion pass on startup when enabled.
INGEST_ON_STARTUP = os.getenv("INGEST_ON_STARTUP", "false").lower() == "true"

# SOP embedding vector dimension. Baked into the pgvector `vector(N)` column and
# its HNSW index on Postgres, so it MUST match the configured SOP_EMBEDDING_MODEL
# (text-embedding-3-small = 1536, text-embedding-3-large = 3072,
# vertex text-embedding-004 = 768). Changing it requires a migration + re-embed.
# On SQLite the column is plain JSON, so this is ignored there.
SOP_EMBEDDING_DIM = int(os.getenv("SOP_EMBEDDING_DIM", "1536"))

# Derived constants
WEB = ENV == "DEV"

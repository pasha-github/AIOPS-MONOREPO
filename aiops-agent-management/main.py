import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from src.agent_runtime.adk.adk_app import ADK_APP
from src.database.database import create_db_and_tables
from src.ingestion.bootstrap import bootstrap_ingestion_sources_from_env
from src.ingestion.trigger import ingestion_trigger
from src.ingestion.types import TriggerSource
from src.routers import (
    agent_files,
    agents,
    auth,
    aws_credentials,
    connectors,
    documents,
    llms,
    mcp,
    observability,
    skills,
    vertex_config,
    visualizer,
)
from src.utils.constants import INGEST_ON_STARTUP, WEB
from src.utils.logging_config import configure_logging
from src.utils.scheduler import start_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    log_file = configure_logging()
    _dest = f"terminal + {log_file}" if log_file else "terminal"
    logging.getLogger(__name__).info(
        "Logging configured → %s (set LOG_LEVEL=DEBUG for step detail + file)", _dest
    )
    create_db_and_tables()
    # Temporary: seed an IngestionSource from env until the management UI lands.
    bootstrap_ingestion_sources_from_env()
    start_scheduler()
    # Bind the running loop so synchronous callers (e.g. the agent tool) can
    # reach the trigger, then optionally kick off a background startup ingestion.
    ingestion_trigger.bind_loop(asyncio.get_running_loop())
    if INGEST_ON_STARTUP:
        await ingestion_trigger.fire(TriggerSource.STARTUP, blocking=False)
    yield


app = FastAPI(lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health Check
@app.get("/health/")
def health_check():
    return {"status": "ok"}


# Routers
app.include_router(agents.router)
app.include_router(agent_files.router)
app.include_router(aws_credentials.router)
app.include_router(auth.router)
app.include_router(llms.router)
app.include_router(connectors.router)
app.include_router(documents.router)
app.include_router(mcp.router)
app.include_router(skills.router)
app.include_router(visualizer.router)
app.include_router(observability.router)
app.include_router(vertex_config.router)

# Mount ADK App
app.mount("/agent-server", ADK_APP)

# Mount Static Files for UI
# Serve index.html at root
# This is for testing only
if WEB:

    @app.get("/")
    async def read_index():
        return FileResponse("static/index.html")

    app.mount("/static", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="localhost", port=8000)

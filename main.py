from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database.database import create_db_and_tables
from routers import agents, llms, connectors
from google.adk.cli.fast_api import get_fast_api_app # as requested
from utils.agent_loader import DatabaseAgentLoader
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

AGENT_SERVER_DATABASE_URL = os.getenv("AGENT_SERVER_DATABASE_URL", "sqlite:///agent_management.db")
ENV = os.getenv("ENV", "DEV")
A2A = os.getenv("A2A", False)
WEB = True if ENV == "DEV" else False

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
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
app.include_router(llms.router)
app.include_router(connectors.router)
# Mount ADK App
# agents_dir is required, we use 'agents' as dummy/default.
adk_app = get_fast_api_app(
    agents_dir="agents",
    web=WEB,
    a2a=bool(A2A),
    agent_loader=DatabaseAgentLoader(),
    auto_create_session=True,
    session_service_uri=AGENT_SERVER_DATABASE_URL,
    url_prefix="/agent-server",
    logo_text="RC AIOps - DEV",
    logo_image_url="/static/royal_cyber.jpeg"
)

app.mount("/agent-server", adk_app)

# Mount Static Files for UI
# Serve index.html at root
# This is for testing only 
if WEB:
    @app.get("/")
    async def read_index():
        return FileResponse('static/index.html')

    app.mount("/static", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="localhost", port=8000)

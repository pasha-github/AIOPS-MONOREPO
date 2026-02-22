from fastapi import FastAPI
from contextlib import asynccontextmanager
from database.database import create_db_and_tables, DATABASE_URL
from routers import agents, llms
from google.adk.cli.fast_api import get_fast_api_app # as requested
from utils.agent_loader import DatabaseAgentLoader
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield

app = FastAPI(lifespan=lifespan)

# Health Check
@app.get("/health/")
def health_check():
    return {"status": "ok"}

# Routers
app.include_router(agents.router)
app.include_router(llms.router)

# Mount ADK App
# agents_dir is required, we use 'agents' as dummy/default.
adk_app = get_fast_api_app(
    agents_dir="agents",
    web=True,
    agent_loader=DatabaseAgentLoader(),
    auto_create_session=True,
    session_service_uri=DATABASE_URL,
    url_prefix="/agent-server",
    logo_text="RC AIOps - DEV",
    logo_image_url="/static/royal_cyber.jpeg"
)

app.mount("/agent-server", adk_app)

# Mount Static Files for UI
# Serve index.html at root
# This is for testing only 
@app.get("/")
async def read_index():
    return FileResponse('static/index.html')

app.mount("/static", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="localhost", port=8000)

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from src.agent_runtime.adk.adk_app import ADK_APP
from src.database.database import create_db_and_tables
from src.routers import agents, connectors, llms, mcp, visualizer
from src.utils.constants import WEB
from src.utils.scheduler import start_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    start_scheduler()
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
app.include_router(mcp.router)
app.include_router(visualizer.router)

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

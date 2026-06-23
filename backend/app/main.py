import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.api.dependencies import get_bq_client, get_bq_service
from app.api.routers import chat, observability

logger = logging.getLogger("main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    logger.info("Starting up FastAPI AI Agent Backend...")
    try:
        # Check and auto-provision BigQuery dataset
        bq_client = get_bq_client()
        bq_service = get_bq_service(bq_client)
        bq_service.ensure_dataset_exists()
    except Exception as e:
        logger.critical(f"Startup check failed: {e}", exc_info=True)
    
    yield
    # Shutdown actions
    logger.info("Shutting down FastAPI AI Agent Backend...")

# Initialize FastAPI
app = FastAPI(
    title="ADK AI Agent API",
    version="1.0.0",
    description="Backend API serving ADK Agent reasoning and BigQuery telemetry.",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development ease, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
register_exception_handlers(app)

# Include API Routers
app.include_router(chat.router, prefix="/api")
app.include_router(observability.router, prefix="/api")

# Static mounting for frontend bundle (resilient to both local and Docker directory structures)
possible_paths = [
    # Local dev: backend/app/main.py -> go up 3 levels to project root, then frontend/dist
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "frontend/dist"),
    # Docker/flat: app/main.py -> go up 2 levels to /workspace, then frontend/dist
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend/dist"),
    # Relative to current working directory
    os.path.abspath("frontend/dist")
]

frontend_dist = None
for path in possible_paths:
    if os.path.exists(path):
        frontend_dist = path
        break

if frontend_dist:
    from fastapi.staticfiles import StaticFiles
    logger.info(f"Mounting static frontend files from '{frontend_dist}'")
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
else:
    logger.warning(f"Static frontend path 'frontend/dist' not found in any candidate locations: {possible_paths}. Serving API endpoints only.")

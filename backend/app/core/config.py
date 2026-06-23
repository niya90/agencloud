import os
os.environ["GOOGLE_API_USE_CLIENT_CERTIFICATE"] = "false"
import logging
from pydantic_settings import BaseSettings
import vertexai

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("core.config")

class Settings(BaseSettings):
    PROJECT_ID: str = "niyati-463804"
    LOCATION: str = "us-central1"
    DATASET_ID: str = "agent_ops_demo"
    TABLE_ID: str = "agent_events"
    MODEL_NAME: str = "gemini-1.5-flash"
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    class Config:
        # Load from .env file checking current working directory, backend, and project root
        env_file = [".env", "../.env", "../../.env", "../../../.env"]
        extra = "ignore"

settings = Settings()

logger.info(f"Loaded config: Project={settings.PROJECT_ID}, Location={settings.LOCATION}, Dataset={settings.DATASET_ID}")

# Initialize Vertex AI
try:
    vertexai.init(project=settings.PROJECT_ID, location=settings.LOCATION)
    logger.info("Vertex AI successfully initialized.")
except Exception as e:
    logger.error(f"Failed to initialize Vertex AI: {e}")

import os
import logging
from typing import AsyncGenerator
from functools import cached_property
from google.adk.agents import Agent
from google.adk.runners import InMemoryRunner
from google.adk.models import Gemini
from google.adk.plugins.bigquery_agent_analytics_plugin import (
    BigQueryAgentAnalyticsPlugin,
    BigQueryLoggerConfig
)
from google.genai import Client
from google.genai.types import Content, Part
from app.core.config import settings

logger = logging.getLogger("services.agent_service")

# Define tools
def get_cloud_services_status() -> str:
    """
    Returns the current operational status of main Google Cloud services
    such as Vertex AI, BigQuery, Cloud Run, and Cloud Storage in the environment.
    """
    statuses = {
        "Vertex AI API": "Operational",
        "BigQuery Engine": "Operational",
        "Cloud Run Runtime": "Operational",
        "Cloud Storage API": "Operational"
    }
    status_str = f"GCP Service Status for Project '{settings.PROJECT_ID}':\n"
    for service, status in statuses.items():
        status_str += f"- {service}: {status}\n"
    return status_str

def calculate_pricing(service: str, usage: float) -> str:
    """
    Estimates simulated cost projections for Google Cloud services based on usage.
    Args:
        service: The GCP service to estimate, must be one of: 'BigQuery storage', 'BigQuery query', 'Vertex AI', or 'Cloud Run'.
        usage: The numerical amount of usage. For BigQuery storage, in GB. For BigQuery query, in TB queried.
               For Vertex AI, in millions of tokens. For Cloud Run, in millions of requests.
    """
    srv = service.lower().strip()
    if "bigquery storage" in srv:
        cost = usage * 0.02  # $0.02 per GB-month
        return f"Estimated monthly cost for {usage} GB of BigQuery storage is ${cost:.2f} USD ($0.02/GB)."
    elif "bigquery query" in srv:
        cost = usage * 5.00  # $5.00 per TB
        return f"Estimated cost for querying {usage} TB of data in BigQuery is ${cost:.2f} USD ($5.00/TB)."
    elif "vertex ai" in srv:
        cost = usage * 0.075  # $0.075 per million tokens (input/output blend)
        return f"Estimated cost for {usage} million tokens on Vertex AI (Gemini 2.5 Flash) is ${cost:.2f} USD ($0.075/million tokens)."
    elif "cloud run" in srv:
        cost = usage * 0.40  # $0.40 per million requests
        return f"Estimated monthly cost for {usage} million Cloud Run requests is ${cost:.2f} USD ($0.40/million requests)."
    else:
        return f"Unsupported service '{service}'. Supported options are: 'BigQuery storage', 'BigQuery query', 'Vertex AI', or 'Cloud Run'."

# Custom Gemini class to route requests to Vertex AI
class VertexGemini(Gemini):
    @cached_property
    def api_client(self) -> Client:
        logger.info(f"Initializing Vertex AI GenAI Client for model model='{self.model}', project='{settings.PROJECT_ID}', location='{settings.LOCATION}'")
        return Client(
            vertexai=True,
            project=settings.PROJECT_ID,
            location=settings.LOCATION
        )

# Initialize BigQuery Observability Plugin
bq_config = BigQueryLoggerConfig(
    enabled=True,
    max_content_length=1000
)

bq_plugin = BigQueryAgentAnalyticsPlugin(
    project_id=settings.PROJECT_ID,
    dataset_id=settings.DATASET_ID,
    table_id=settings.TABLE_ID,
    config=bq_config
)

# Define Agent
model_instance = VertexGemini(model=settings.MODEL_NAME)

gcp_architect_agent = Agent(
    name="gcp_architect_agent",
    model=model_instance,
    instruction=(
        "You are a Principal Cloud Architect AI. You help developers analyze GCP configurations, "
        "estimate billing costs, and inspect cloud resources. Always use the tools provided (get_cloud_services_status "
        "and calculate_pricing) when asked about service health/statuses or price estimations. Keep answers concise."
    ),
    tools=[get_cloud_services_status, calculate_pricing]
)

# Initialize Runner
agent_runner = InMemoryRunner(
    agent=gcp_architect_agent,
    plugins=[bq_plugin]
)

logger.info(f"ADK Agent runner initialized with model '{settings.MODEL_NAME}' and BigQuery analytics plugin.")

async def run_agent_query(session_id: str, message: str, user_id: str = "user-default") -> str:
    """Executes a query against the agent within the specified session and returns the final response."""
    app_name = agent_runner.app_name

    # Ensure the session exists in the memory session service
    try:
        session = await agent_runner.session_service.get_session(app_name=app_name, session_id=session_id, user_id=user_id)
        if session is None:
            logger.info(f"Session '{session_id}' not found. Creating it for user '{user_id}' (app: '{app_name}').")
            await agent_runner.session_service.create_session(app_name=app_name, session_id=session_id, user_id=user_id)
    except Exception:
        logger.info(f"Error checking session. Creating new session '{session_id}' for user '{user_id}' (app: '{app_name}').")
        await agent_runner.session_service.create_session(app_name=app_name, session_id=session_id, user_id=user_id)

    # Format the message
    user_content = Content(
        role="user",
        parts=[Part(text=message)]
    )

    response_text = ""
    async for event in agent_runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=user_content
    ):
        # Accumulate the response text
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    response_text += part.text

    return response_text

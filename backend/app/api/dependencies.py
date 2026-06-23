from fastapi import Depends
from google.cloud import bigquery
from app.core.config import settings
from app.services.bq_service import BigQueryService

# Singleton bigquery client
_bq_client = None

def get_bq_client() -> bigquery.Client:
    """Dependency provider for the Google Cloud BigQuery Client."""
    global _bq_client
    if _bq_client is None:
        _bq_client = bigquery.Client(
            project=settings.PROJECT_ID
        )
    return _bq_client

def get_bq_service(client: bigquery.Client = Depends(get_bq_client)) -> BigQueryService:
    """Dependency provider for the BigQuery Service."""
    return BigQueryService(client=client)

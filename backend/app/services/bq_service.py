import logging
import json
from typing import List, Any
from google.cloud import bigquery
from google.api_core.exceptions import NotFound
from app.core.config import settings
from app.schemas.obs_schema import ObservabilityRow, ContentPart

logger = logging.getLogger("services.bq_service")

class BigQueryService:
    def __init__(self, client: bigquery.Client):
        self.client = client
        self.project_id = settings.PROJECT_ID
        self.dataset_id = settings.DATASET_ID
        self.table_id = settings.TABLE_ID
        self.dataset_ref = bigquery.DatasetReference(self.project_id, self.dataset_id)
        self.table_ref = self.dataset_ref.table(self.table_id)

    def ensure_dataset_exists(self) -> None:
        """Checks if the BigQuery dataset exists, and creates it if it does not."""
        try:
            self.client.get_dataset(self.dataset_ref)
            logger.info(f"BigQuery dataset '{self.project_id}.{self.dataset_id}' already exists.")
        except NotFound:
            logger.warning(f"BigQuery dataset '{self.project_id}.{self.dataset_id}' not found. Creating it...")
            try:
                dataset = bigquery.Dataset(self.dataset_ref)
                dataset.location = settings.LOCATION
                self.client.create_dataset(dataset, timeout=30)
                logger.info(f"Successfully created BigQuery dataset '{self.project_id}.{self.dataset_id}' in region '{settings.LOCATION}'.")
            except Exception as e:
                logger.critical(f"Failed to create BigQuery dataset: {e}", exc_info=True)
                raise e
        except Exception as e:
            logger.error(f"Error checking BigQuery dataset: {e}", exc_info=True)
            raise e

    def _safe_parse_json(self, value: Any) -> Any:
        """Safely parse JSON values returned from BigQuery JSON columns."""
        if not value:
            return None
        if isinstance(value, str):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value
        return value

    def fetch_observability_data(self, limit: int = 100) -> List[ObservabilityRow]:
        """Queries the telemetry table in BigQuery for the latest agent events."""
        query = f"""
            SELECT 
                timestamp,
                event_type,
                agent,
                session_id,
                invocation_id,
                user_id,
                trace_id,
                span_id,
                parent_span_id,
                TO_JSON_STRING(content) as content_str,
                content_parts,
                TO_JSON_STRING(attributes) as attributes_str,
                TO_JSON_STRING(latency_ms) as latency_str,
                status,
                error_message,
                is_truncated
            FROM `{self.project_id}.{self.dataset_id}.{self.table_id}`
            ORDER BY timestamp DESC
            LIMIT @limit
        """
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("limit", "INTEGER", limit)
            ]
        )

        try:
            query_job = self.client.query(query, job_config=job_config)
            results = query_job.result()
            
            rows = []
            for row in results:
                # Convert content_parts record array
                parts = []
                if row.get("content_parts"):
                    for p in row.content_parts:
                        parts.append(ContentPart(
                            mime_type=p.get("mime_type"),
                            uri=p.get("uri"),
                            text=p.get("text"),
                            storage_mode=p.get("storage_mode")
                        ))

                rows.append(ObservabilityRow(
                    timestamp=row.timestamp,
                    event_type=row.event_type,
                    agent=row.agent,
                    session_id=row.session_id,
                    invocation_id=row.invocation_id,
                    user_id=row.user_id,
                    trace_id=row.trace_id,
                    span_id=row.span_id,
                    parent_span_id=row.parent_span_id,
                    content=self._safe_parse_json(row.get("content_str")),
                    content_parts=parts,
                    attributes=self._safe_parse_json(row.get("attributes_str")),
                    latency_ms=self._safe_parse_json(row.get("latency_str")),
                    status=row.status,
                    error_message=row.error_message,
                    is_truncated=row.is_truncated
                ))
            return rows

        except NotFound:
            # Table is not yet created. The ADK BigQuery plugin only creates the table 
            # upon streaming the first event. This is expected on first runs.
            logger.warning(f"BigQuery telemetry table '{self.project_id}.{self.dataset_id}.{self.table_id}' not found. It will be auto-created on the first agent run.")
            return []
        except Exception as e:
            logger.error(f"Error querying BigQuery logs: {e}", exc_info=True)
            raise e

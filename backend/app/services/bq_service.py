import logging
import json
from typing import List, Any
from google.cloud import bigquery
from google.api_core.exceptions import NotFound
from app.core.config import settings
from app.schemas.obs_schema import ObservabilityRow, ContentPart, InvocationMetrics

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

    def fetch_aggregated_invocations(self, limit: int = 100) -> List[InvocationMetrics]:
        """Queries the telemetry table and aggregates events per user query/invocation."""
        query = f"""
            WITH InvocationEvents AS (
              SELECT
                invocation_id,
                session_id,
                user_id,
                timestamp,
                event_type,
                status,
                error_message,
                -- Extract query text from USER_MESSAGE_RECEIVED content
                CASE 
                  WHEN event_type = 'USER_MESSAGE_RECEIVED' THEN JSON_VALUE(content.text_summary)
                  ELSE NULL
                END AS query_text,
                -- Extract response text from LLM_RESPONSE
                CASE
                  WHEN event_type = 'LLM_RESPONSE' THEN JSON_VALUE(content.response)
                  ELSE NULL
                END AS response_text,
                -- Extract tokens
                SAFE_CAST(JSON_VALUE(attributes.usage_metadata.prompt_token_count) AS INT64) AS prompt_tokens,
                SAFE_CAST(JSON_VALUE(attributes.usage_metadata.candidates_token_count) AS INT64) AS output_tokens,
                SAFE_CAST(JSON_VALUE(attributes.usage_metadata.total_token_count) AS INT64) AS total_tokens,
                -- Extract tool names
                CASE
                  WHEN event_type = 'TOOL_STARTING' THEN JSON_VALUE(content.tool)
                  ELSE NULL
                END AS tool_name,
                -- Latency
                SAFE_CAST(JSON_VALUE(latency_ms.total_ms) AS INT64) AS event_latency
              FROM `{self.project_id}.{self.dataset_id}.{self.table_id}`
            )
            SELECT
              invocation_id,
              ANY_VALUE(session_id) AS session_id,
              ANY_VALUE(user_id) AS user_id,
              MIN(timestamp) AS start_time,
              MAX(timestamp) AS end_time,
              -- Total Latency from INVOCATION_COMPLETED or calculated
              MAX(event_latency) AS total_latency_ms,
              -- Aggregate query text
              MAX(query_text) AS query,
              -- Aggregate agent response text
              MAX(response_text) AS response,
              -- Tokens
              MAX(prompt_tokens) AS input_tokens,
              MAX(output_tokens) AS output_tokens,
              MAX(total_tokens) AS total_tokens,
              -- Error / Status
              MAX(CASE WHEN status = 'ERROR' OR error_message IS NOT NULL THEN 'ERROR' ELSE 'OK' END) AS status,
              STRING_AGG(error_message, '; ') AS error_message,
              -- Stages
              ARRAY_TO_STRING(ARRAY_AGG(event_type ORDER BY timestamp ASC), ',') AS stages,
              -- Tools called
              STRING_AGG(tool_name, ', ') AS tools_called
            FROM InvocationEvents
            GROUP BY invocation_id
            ORDER BY start_time DESC
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
                stages_list = [s.strip() for s in row.stages.split(",") if s.strip()] if row.stages else []
                rows.append(InvocationMetrics(
                    invocation_id=row.invocation_id,
                    session_id=row.session_id,
                    user_id=row.user_id,
                    start_time=row.start_time,
                    end_time=row.end_time,
                    total_latency_ms=row.total_latency_ms,
                    query=row.query,
                    response=row.response,
                    input_tokens=row.input_tokens,
                    output_tokens=row.output_tokens,
                    total_tokens=row.total_tokens,
                    status=row.status,
                    error_message=row.error_message,
                    stages=stages_list,
                    tools_called=row.tools_called
                ))
            return rows

        except NotFound:
            logger.warning(f"BigQuery telemetry table '{self.project_id}.{self.dataset_id}.{self.table_id}' not found. Returning empty list.")
            return []
        except Exception as e:
            logger.error(f"Error querying aggregated BigQuery logs: {e}", exc_info=True)
            raise e

    def fetch_events_for_invocation(self, invocation_id: str) -> List[ObservabilityRow]:
        """Queries all raw events associated with a specific invocation_id."""
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
            WHERE invocation_id = @invocation_id
            ORDER BY timestamp ASC
        """
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("invocation_id", "STRING", invocation_id)
            ]
        )

        try:
            query_job = self.client.query(query, job_config=job_config)
            results = query_job.result()
            
            rows = []
            for row in results:
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
            return []
        except Exception as e:
            logger.error(f"Error querying invocation events: {e}", exc_info=True)
            raise e


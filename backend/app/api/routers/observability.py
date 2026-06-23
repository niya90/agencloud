import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from app.schemas.obs_schema import ObservabilityRow
from app.services.bq_service import BigQueryService
from app.api.dependencies import get_bq_service

logger = logging.getLogger("api.routers.observability")

router = APIRouter(prefix="/observability", tags=["Observability"])

@router.get(
    "",
    response_model=List[ObservabilityRow],
    status_code=status.HTTP_200_OK,
    summary="Get Agent Telemetry logs",
    description="Fetches the latest agent operational logs and traces from the BigQuery analytics table."
)
async def get_agent_logs(
    limit: Optional[int] = Query(50, ge=1, le=500, description="Max number of logs to return."),
    bq_service: BigQueryService = Depends(get_bq_service)
):
    logger.info(f"Received request for agent logs. Limit={limit}")
    try:
        logs = bq_service.fetch_observability_data(limit=limit)
        return logs
    except Exception as e:
        logger.error(f"Failed to fetch logs: {e}", exc_info=True)
        # We raise a 500 error, which will be formatted cleanly by the exceptions module
        raise e

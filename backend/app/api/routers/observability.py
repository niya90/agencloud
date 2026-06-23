import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status, HTTPException
from app.schemas.obs_schema import ObservabilityRow, InvocationMetrics, RCARequest, RCAResponse
from app.services.bq_service import BigQueryService
from app.api.dependencies import get_bq_service
from app.services.agent_service import model_instance
from app.core.config import settings

logger = logging.getLogger("api.routers.observability")

router = APIRouter(prefix="/observability", tags=["Observability"])

@router.get(
    "",
    response_model=List[InvocationMetrics],
    status_code=status.HTTP_200_OK,
    summary="Get Aggregated Agent Query Telemetry",
    description="Fetches the aggregated trace metrics per user query from the BigQuery analytics table."
)
async def get_aggregated_logs(
    limit: Optional[int] = Query(50, ge=1, le=500, description="Max number of invocations to return."),
    bq_service: BigQueryService = Depends(get_bq_service)
):
    logger.info(f"Received request for aggregated agent logs. Limit={limit}")
    try:
        logs = bq_service.fetch_aggregated_invocations(limit=limit)
        return logs
    except Exception as e:
        logger.error(f"Failed to fetch aggregated logs: {e}", exc_info=True)
        raise e

@router.get(
    "/invocation/{invocation_id}/events",
    response_model=List[ObservabilityRow],
    status_code=status.HTTP_200_OK,
    summary="Get Raw Events for a Specific Invocation",
    description="Fetches all the raw events logged under a specific invocation ID."
)
async def get_invocation_events(
    invocation_id: str,
    bq_service: BigQueryService = Depends(get_bq_service)
):
    logger.info(f"Received request for raw events of invocation={invocation_id}")
    try:
        events = bq_service.fetch_events_for_invocation(invocation_id=invocation_id)
        return events
    except Exception as e:
        logger.error(f"Failed to fetch raw events for invocation {invocation_id}: {e}", exc_info=True)
        raise e

@router.post(
    "/rca",
    response_model=RCAResponse,
    status_code=status.HTTP_200_OK,
    summary="Perform Root Cause Analysis on a Failed Invocation",
    description="Uses Gemini to analyze telemetry logs of a failed query and explain the root cause."
)
async def perform_root_cause_analysis(
    request: RCARequest,
    bq_service: BigQueryService = Depends(get_bq_service)
):
    logger.info(f"Root Cause Analysis requested for invocation={request.invocation_id}")
    
    # 1. Fetch raw events
    try:
        events = bq_service.fetch_events_for_invocation(request.invocation_id)
    except Exception as e:
        logger.error(f"Failed to fetch logs for RCA: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch log details for analysis: {str(e)}"
        )
        
    if not events:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No events found for invocation ID '{request.invocation_id}'"
        )
        
    # 2. Build markdown log format
    log_lines = []
    has_errors = False
    for ev in events:
        timestamp_str = ev.timestamp.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        log_lines.append(f"[{timestamp_str}] EVENT_TYPE: {ev.event_type} | status: {ev.status or 'N/A'}")
        if ev.agent:
            log_lines.append(f"  Agent: {ev.agent}")
        if ev.error_message:
            has_errors = True
            log_lines.append(f"  ERROR MESSAGE: {ev.error_message}")
        if ev.content:
            import json
            content_str = json.dumps(ev.content)
            if len(content_str) > 800:
                content_str = content_str[:800] + "... (truncated)"
            log_lines.append(f"  CONTENT: {content_str}")
        if ev.latency_ms:
            log_lines.append(f"  LATENCY: {json.dumps(ev.latency_ms)}")
        log_lines.append("-" * 40)
        
    log_history = "\n".join(log_lines)
    
    # 3. Call Gemini to perform RCA
    prompt = f"""
    You are an expert MLOps Engineer and AI Architect.
    Analyze the following execution log of an AI agent query and explain the root cause of the failure.
    
    In your response, provide:
    1. **Failure Summary**: A brief, clear summary of what failed (the exact step or tool).
    2. **Root Cause Analysis**: Why did it fail? Trace back the events (e.g. invalid arguments, model exception, tool execution timeout).
    3. **Actionable Resolution Steps**: Specific instructions or code changes needed to fix this issue.
    
    Make your explanation technical yet easy to understand. Return the response in clean Markdown.
    
    Agent Execution Log:
    {log_history}
    """
    
    try:
        # Use GenAI Client from our model instance
        response = model_instance.api_client.models.generate_content(
            model=settings.MODEL_NAME,
            contents=prompt
        )
        analysis_text = response.text or "Gemini could not generate a response for the root cause analysis."
        
        return RCAResponse(
            invocation_id=request.invocation_id,
            root_cause_explanation=analysis_text
        )
    except Exception as e:
        logger.error(f"Failed to generate RCA using model: {e}", exc_info=True)
        # Return a fallback explanation if API fails
        fallback_msg = f"**System Warning**: Failed to run AI-powered analysis due to model connection issue: {str(e)}.\n\n"
        if has_errors:
            fallback_msg += f"**Detected Errors in Log**:\n"
            for ev in events:
                if ev.error_message:
                    fallback_msg += f"- `{ev.event_type}` reported error: *{ev.error_message}*\n"
        else:
            fallback_msg += "No explicit error messages were captured in the telemetry log."
            
        return RCAResponse(
            invocation_id=request.invocation_id,
            root_cause_explanation=fallback_msg
        )


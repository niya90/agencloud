import logging
import uuid
from fastapi import APIRouter, status, HTTPException
from app.schemas.chat_schema import ChatRequest, ChatResponse
from app.services.agent_service import run_agent_query

logger = logging.getLogger("api.routers.chat")

router = APIRouter(prefix="/chat", tags=["Chat"])

@router.post(
    "",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Send message to AI Agent",
    description="Processes conversation with the ADK agent, saving execution telemetry in BigQuery."
)
async def chat_interaction(request: ChatRequest):
    session_id = request.session_id or str(uuid.uuid4())
    user_id = request.user_id or "user-default"

    logger.info(f"Received chat request: Session={session_id}, User={user_id}, MessageLength={len(request.message)}")

    try:
        response_text = await run_agent_query(
            session_id=session_id,
            message=request.message,
            user_id=user_id
        )

        return ChatResponse(
            response=response_text,
            session_id=session_id,
            user_id=user_id
        )
    except Exception as e:
        logger.error(f"Error executing agent query: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agent execution failed: {str(e)}"
        )

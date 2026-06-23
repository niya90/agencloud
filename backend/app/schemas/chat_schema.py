from pydantic import BaseModel, Field
from typing import Optional

class ChatRequest(BaseModel):
    message: str = Field(..., description="The input query for the AI agent.")
    session_id: Optional[str] = Field(None, description="Optional unique identifier for the conversation session.")
    user_id: Optional[str] = Field("user-default", description="Optional unique identifier for the user.")

class ChatResponse(BaseModel):
    response: str = Field(..., description="The final text response from the agent.")
    session_id: str = Field(..., description="The session identifier used for this response.")
    user_id: str = Field(..., description="The user identifier used for this response.")
    trace_id: Optional[str] = Field(None, description="The trace identifier for this interaction run.")

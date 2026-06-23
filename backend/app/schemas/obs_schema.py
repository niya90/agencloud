from pydantic import BaseModel, Field
from typing import Optional, Any, Dict, List
from datetime import datetime

class ContentPart(BaseModel):
    mime_type: Optional[str] = None
    uri: Optional[str] = None
    text: Optional[str] = None
    storage_mode: Optional[str] = None

class ObservabilityRow(BaseModel):
    timestamp: datetime = Field(..., description="Timestamp of the event.")
    event_type: Optional[str] = Field(None, description="Type of event logged by the agent.")
    agent: Optional[str] = Field(None, description="Name of the agent generating the log.")
    session_id: Optional[str] = Field(None, description="Conversation session ID.")
    invocation_id: Optional[str] = Field(None, description="Invocation transaction ID.")
    user_id: Optional[str] = Field(None, description="User associated with the event.")
    trace_id: Optional[str] = Field(None, description="Trace ID linking spanning executions.")
    span_id: Optional[str] = Field(None, description="Span ID of the current execution node.")
    parent_span_id: Optional[str] = Field(None, description="Parent span ID, if nested.")
    content: Optional[Any] = Field(None, description="Payload content (raw JSON or dict).")
    content_parts: Optional[List[ContentPart]] = Field(None, description="Detailed content segments.")
    attributes: Optional[Any] = Field(None, description="Custom event metadata properties.")
    latency_ms: Optional[Any] = Field(None, description="Latency metrics for execution steps.")
    status: Optional[str] = Field(None, description="Status of the operation (e.g. SUCCESS, ERROR).")
    error_message: Optional[str] = Field(None, description="Associated error details, if any.")
    is_truncated: Optional[bool] = Field(None, description="Indicates if logging payload was truncated.")

class InvocationMetrics(BaseModel):
    invocation_id: str = Field(..., description="Unique ID for the query invocation.")
    session_id: Optional[str] = Field(None, description="Conversation session ID.")
    user_id: Optional[str] = Field(None, description="User associated with the event.")
    start_time: datetime = Field(..., description="Timestamp when the invocation started.")
    end_time: datetime = Field(..., description="Timestamp when the invocation ended.")
    total_latency_ms: Optional[int] = Field(None, description="Total latency of the invocation in milliseconds.")
    query: Optional[str] = Field(None, description="The user's query text.")
    response: Optional[str] = Field(None, description="The agent's final text response.")
    input_tokens: Optional[int] = Field(None, description="Input/prompt tokens consumed.")
    output_tokens: Optional[int] = Field(None, description="Output/completion tokens consumed.")
    total_tokens: Optional[int] = Field(None, description="Total tokens consumed.")
    status: Optional[str] = Field(None, description="Aggregated status (OK or ERROR).")
    error_message: Optional[str] = Field(None, description="Aggregated error messages.")
    stages: List[str] = Field(default_factory=list, description="List of events that occurred in this invocation.")
    tools_called: Optional[str] = Field(None, description="List of tools called during the invocation.")

class RCARequest(BaseModel):
    session_id: Optional[str] = Field(None, description="Session identifier for context.")
    invocation_id: str = Field(..., description="Invocation identifier to analyze.")

class RCAResponse(BaseModel):
    invocation_id: str = Field(..., description="The invocation identifier analyzed.")
    root_cause_explanation: str = Field(..., description="The AI-generated Root Cause Analysis explanation (markdown).")


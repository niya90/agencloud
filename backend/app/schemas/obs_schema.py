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

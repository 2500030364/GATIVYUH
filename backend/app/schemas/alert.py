from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class AlertBase(BaseModel):
    location_id: str
    category: str
    item_name: Optional[str] = None
    severity: str = Field(default="WATCH", description="WATCH, AT_RISK, CRITICAL")
    current_quantity: float
    min_threshold: float
    unit: str
    reason: str

class AlertResponse(AlertBase):
    id: int
    is_acknowledged: bool
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None
    created_at: datetime
    location_name: Optional[str] = None

    model_config = {"from_attributes": True}

class AlertAcknowledgeRequest(BaseModel):
    acknowledged_by: str = Field(default="Officer On Duty", min_length=2, max_length=64)

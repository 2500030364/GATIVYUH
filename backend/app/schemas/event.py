from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator

class LogisticsEventBase(BaseModel):
    event_type: str = Field(..., description="RECEIPT, CONSUMPTION, DISPATCH, DELIVERY, DELAY")
    location_id: str = Field(..., description="Source location ID")
    destination_id: Optional[str] = Field(default=None, description="Destination location ID (required for DISPATCH/DELIVERY)")
    category: str = Field(..., description="Supply category")
    item_name: str = Field(..., min_length=1, max_length=255)
    quantity: float = Field(..., gt=0.0)
    unit: str = Field(default="Units", min_length=1, max_length=32)
    status: str = Field(default="COMPLETED", description="COMPLETED, IN_TRANSIT, DELAYED, CANCELLED")
    reference_code: Optional[str] = None
    notes: Optional[str] = None
    is_synthetic: bool = True

    @field_validator("event_type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        valid_types = {"RECEIPT", "CONSUMPTION", "DISPATCH", "DELIVERY", "DELAY"}
        norm = v.upper().strip()
        if norm not in valid_types:
            raise ValueError(f"Event type must be one of {valid_types}")
        return norm

class LogisticsEventCreate(LogisticsEventBase):
    id: Optional[str] = None

class LogisticsEventResponse(LogisticsEventBase):
    id: str
    timestamp: datetime
    source_location_name: Optional[str] = None
    destination_location_name: Optional[str] = None

    model_config = {"from_attributes": True}

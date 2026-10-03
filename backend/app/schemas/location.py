from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator

class LocationBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255, description="Location identifier or name")
    location_type: str = Field(..., description="HUB, FORWARD_DEPOT, FIELD_HOSPITAL, FUEL_DEPOT, TRANSIT_NODE")
    status: str = Field(default="STABLE", description="STABLE, WATCH, AT_RISK, CRITICAL, INACTIVE")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="WGS84 Latitude")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="WGS84 Longitude")
    elevation_m: Optional[float] = Field(default=None, description="Elevation in meters")
    description: Optional[str] = None
    is_synthetic: bool = True
    is_active: bool = True

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        valid_statuses = {"STABLE", "WATCH", "AT_RISK", "CRITICAL", "INACTIVE"}
        norm = v.upper().strip()
        if norm not in valid_statuses:
            raise ValueError(f"Status must be one of {valid_statuses}")
        return norm

    @field_validator("location_type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        valid_types = {"HUB", "FORWARD_DEPOT", "FIELD_HOSPITAL", "FUEL_DEPOT", "TRANSIT_NODE", "DISTRIBUTION_CENTER"}
        norm = v.upper().strip()
        if norm not in valid_types:
            raise ValueError(f"Location type must be one of {valid_types}")
        return norm

class LocationCreate(LocationBase):
    id: str = Field(..., min_length=2, max_length=64, description="Unique alphanumeric identifier (e.g. LOC-PUN-01)")

    @field_validator("id")
    @classmethod
    def validate_id(cls, v: str) -> str:
        clean = v.strip().upper()
        if not clean:
            raise ValueError("ID cannot be empty")
        return clean

class LocationUpdate(BaseModel):
    name: Optional[str] = None
    location_type: Optional[str] = None
    status: Optional[str] = None
    latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(default=None, ge=-180.0, le=180.0)
    elevation_m: Optional[float] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class LocationResponse(LocationBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class LocationDetailResponse(LocationResponse):
    total_inventory_items: int = 0
    active_alerts_count: int = 0
    recent_events_count: int = 0

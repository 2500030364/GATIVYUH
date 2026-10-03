from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.schemas.event import LogisticsEventResponse
from app.schemas.alert import AlertResponse

class CategoryInventorySummary(BaseModel):
    category: str
    total_available: float
    total_reserved: float
    unit: str
    items_count: int

class LocationStatusBreakdown(BaseModel):
    stable: int = 0
    watch: int = 0
    at_risk: int = 0
    critical: int = 0
    inactive: int = 0
    total: int = 0

class LogisticsFlowSummary(BaseModel):
    in_transit_count: int = 0
    delayed_count: int = 0
    completed_today: int = 0
    inbound_deliveries_pending: int = 0
    outbound_dispatches_active: int = 0

class DataFreshness(BaseModel):
    database_status: str = "HEALTHY"
    roads_status: str = "UNKNOWN"
    roads_source: str = "None"
    roads_feature_count: int = 0
    terrain_status: str = "UNKNOWN"
    terrain_elevation_range: Optional[str] = None
    system_mode: str = "SYNTHETIC_DEMO"  # or "HYBRID_GIS_REAL"
    last_event_time: Optional[datetime] = None
    server_time: datetime

class DashboardSummary(BaseModel):
    total_locations: int
    total_inventory_items: int
    active_alerts_count: int
    critical_alerts_count: int
    location_status: LocationStatusBreakdown
    categories: List[CategoryInventorySummary]
    flows: LogisticsFlowSummary
    recent_events: List[LogisticsEventResponse]
    recent_alerts: List[AlertResponse]
    freshness: DataFreshness

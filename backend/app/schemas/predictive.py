from datetime import datetime, date
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class HistoricalDemandPoint(BaseModel):
    date: str
    actual_demand: float

class ForecastPoint(BaseModel):
    date: str
    predicted_demand: float
    lower_bound: float
    upper_bound: float
    baseline_demand: float

class ForecastResponse(BaseModel):
    location_id: str
    location_name: Optional[str] = None
    category: str
    item_name: str
    horizon_days: int
    model_name: str
    model_version: str
    is_synthetic_input: bool
    generated_at: datetime
    insufficient_data: bool
    data_limitation_note: Optional[str] = None
    historical_series: List[HistoricalDemandPoint]
    forecast_series: List[ForecastPoint]

    model_config = {"from_attributes": True}

class DemandAnomalyResponse(BaseModel):
    id: int
    location_id: str
    location_name: Optional[str] = None
    category: str
    item_name: str
    anomaly_date: str
    observed_value: float
    baseline_mean: float
    expected_range_min: float
    expected_range_max: float
    z_score: float
    deviation_pct: float
    severity: str  # LOW, MEDIUM, HIGH
    explanation: str
    limitations: Optional[str] = None
    is_emergency: bool
    is_acknowledged: bool
    created_at: datetime

    model_config = {"from_attributes": True}

class RiskAssessmentResponse(BaseModel):
    id: int
    location_id: str
    location_name: Optional[str] = None
    category: str
    risk_state: str  # STABLE, WATCH, AT_RISK, CRITICAL
    current_stock: float
    min_threshold: float
    avg_daily_demand: float
    days_to_shortage: Optional[float] = None
    projected_stockout_date: Optional[str] = None
    insufficient_data: bool
    incoming_supply: float
    contributing_factors: List[str]
    recommended_action: str
    data_quality_score: float
    calculated_at: datetime

    model_config = {"from_attributes": True}

class PriorityQueueItemResponse(BaseModel):
    id: int
    priority_rank: int
    item_type: str
    location_id: str
    location_name: Optional[str] = None
    category: Optional[str] = None
    title: str
    explanation: str
    urgency: str  # CRITICAL, HIGH, MEDIUM, LOW
    status: str  # OPEN, ACKNOWLEDGED, UNDER_REVIEW, RESOLVED
    assigned_reviewer: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    audit_trail: List[Dict[str, Any]] = []
    created_at: datetime

    model_config = {"from_attributes": True}

class PriorityQueueActionRequest(BaseModel):
    action: str = Field(..., description="ACKNOWLEDGE, ASSIGN, RESOLVE")
    reviewer: Optional[str] = None
    notes: Optional[str] = None

class WeatherObservationResponse(BaseModel):
    location_id: str
    latitude: float
    longitude: float
    observation_date: str
    temp_c: Optional[float] = None
    precipitation_mm: Optional[float] = None
    wind_speed_ms: Optional[float] = None
    source: str = "NASA_POWER"
    retrieval_timestamp: datetime
    status: str  # LIVE, CACHED, UNAVAILABLE
    message: Optional[str] = None

    model_config = {"from_attributes": True}

class ModelEvaluationResponse(BaseModel):
    id: int
    model_name: str
    model_version: str
    location_id: str
    category: str
    mae: float
    rmse: float
    baseline_mae: float
    baseline_rmse: float
    mape: Optional[float] = None
    wape: Optional[float] = None
    sample_count: int
    evaluation_period: str
    evaluation_notes: Optional[str] = None
    evaluated_at: datetime

    model_config = {"from_attributes": True}

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Date, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class DailyConsumptionRecord(Base):
    __tablename__ = "daily_consumption_records"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    location_id = Column(String(64), ForeignKey("locations.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(64), nullable=False, index=True)
    item_name = Column(String(255), nullable=False)
    date = Column(Date, nullable=False, index=True)
    quantity = Column(Float, nullable=False)
    unit = Column(String(32), nullable=False)
    is_synthetic = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    location = relationship("Location")

class ForecastResult(Base):
    __tablename__ = "forecast_results"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    location_id = Column(String(64), ForeignKey("locations.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(64), nullable=False, index=True)
    item_name = Column(String(255), nullable=False)
    forecast_date = Column(String(32), nullable=False, index=True)
    predicted_demand = Column(Float, nullable=False)
    lower_bound = Column(Float, nullable=False)
    upper_bound = Column(Float, nullable=False)
    baseline_demand = Column(Float, nullable=False)
    model_name = Column(String(64), nullable=False, default="RidgeTrendSeasonality_v1")
    model_version = Column(String(32), nullable=False, default="1.0.0")
    horizon_days = Column(Integer, nullable=False, default=14)
    is_synthetic_input = Column(Boolean, default=True)
    generated_at = Column(DateTime, default=datetime.utcnow, index=True)

    location = relationship("Location")

class ModelEvaluationMetric(Base):
    __tablename__ = "model_evaluation_metrics"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    model_name = Column(String(64), nullable=False)
    model_version = Column(String(32), nullable=False)
    location_id = Column(String(64), nullable=False, index=True)
    category = Column(String(64), nullable=False, index=True)
    mae = Column(Float, nullable=False)
    rmse = Column(Float, nullable=False)
    baseline_mae = Column(Float, nullable=False)
    baseline_rmse = Column(Float, nullable=False)
    mape = Column(Float, nullable=True)  # Nullable due to division by zero on zero-demand days
    wape = Column(Float, nullable=True)  # Weighted Absolute Percentage Error: sum(|y - y_hat|) / sum(y)
    sample_count = Column(Integer, nullable=False)
    evaluation_period = Column(String(128), nullable=False)
    evaluation_notes = Column(Text, nullable=True)
    evaluated_at = Column(DateTime, default=datetime.utcnow)

class DemandAnomaly(Base):
    __tablename__ = "demand_anomalies"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    location_id = Column(String(64), ForeignKey("locations.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(64), nullable=False, index=True)
    item_name = Column(String(255), nullable=False)
    anomaly_date = Column(String(32), nullable=False, index=True)
    observed_value = Column(Float, nullable=False)
    baseline_mean = Column(Float, nullable=False)
    expected_range_min = Column(Float, nullable=False)
    expected_range_max = Column(Float, nullable=False)
    z_score = Column(Float, nullable=False)
    deviation_pct = Column(Float, nullable=False)
    severity = Column(String(32), nullable=False, default="MEDIUM")  # LOW, MEDIUM, HIGH
    explanation = Column(Text, nullable=False)
    limitations = Column(Text, nullable=True)
    is_emergency = Column(Boolean, default=False)
    is_acknowledged = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    location = relationship("Location")

class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    location_id = Column(String(64), ForeignKey("locations.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(64), nullable=False, index=True)
    risk_state = Column(String(32), nullable=False, index=True)  # STABLE, WATCH, AT_RISK, CRITICAL
    current_stock = Column(Float, nullable=False)
    min_threshold = Column(Float, nullable=False)
    avg_daily_demand = Column(Float, nullable=False)
    days_to_shortage = Column(Float, nullable=True)  # Null if insufficient data or zero demand
    projected_stockout_date = Column(String(32), nullable=True)
    insufficient_data = Column(Boolean, default=False)
    incoming_supply = Column(Float, default=0.0)
    contributing_factors_json = Column(Text, nullable=False)  # JSON array of factors
    recommended_action = Column(Text, nullable=False)
    data_quality_score = Column(Float, default=1.0)
    calculated_at = Column(DateTime, default=datetime.utcnow, index=True)

    location = relationship("Location")

class PriorityQueueItem(Base):
    __tablename__ = "priority_queue_items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    priority_rank = Column(Integer, nullable=False, index=True)  # 1 = Highest
    item_type = Column(String(64), nullable=False, index=True)  # IMMINENT_SHORTAGE, LOW_STOCK, DEMAND_ANOMALY, DELAYED_SUPPLY, DATA_QUALITY
    location_id = Column(String(64), ForeignKey("locations.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(64), nullable=True)
    title = Column(String(255), nullable=False)
    explanation = Column(Text, nullable=False)
    urgency = Column(String(32), nullable=False, default="MEDIUM")  # CRITICAL, HIGH, MEDIUM, LOW
    status = Column(String(32), nullable=False, default="OPEN", index=True)  # OPEN, ACKNOWLEDGED, UNDER_REVIEW, RESOLVED
    assigned_reviewer = Column(String(64), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    audit_trail_json = Column(Text, nullable=False, default="[]")  # JSON array of audit logs
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    location = relationship("Location")

class WeatherCache(Base):
    __tablename__ = "weather_cache"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    location_id = Column(String(64), nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    observation_date = Column(String(32), nullable=False, index=True)  # YYYY-MM-DD
    temp_c = Column(Float, nullable=True)
    precipitation_mm = Column(Float, nullable=True)
    wind_speed_ms = Column(Float, nullable=True)
    source = Column(String(64), default="NASA_POWER")
    retrieval_timestamp = Column(DateTime, default=datetime.utcnow)
    status = Column(String(32), default="LIVE")  # LIVE, CACHED, UNAVAILABLE

from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base

class TransportResource(Base):
    __tablename__ = "transport_resources"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    vehicle_type = Column(String(50), nullable=False, index=True)  # HEAVY_TRUCK, MEDIUM_TRUCK, LIGHT_UTILITY, FUEL_TANKER, REFRIGERATED_VAN
    capacity_weight_kg = Column(Float, nullable=False)
    capacity_volume_m3 = Column(Float, nullable=False)
    current_load_kg = Column(Float, default=0.0, nullable=False)
    fuel_efficiency_km_l = Column(Float, default=3.5, nullable=False)
    speed_empty_kmh = Column(Float, default=50.0, nullable=False)
    speed_loaded_kmh = Column(Float, default=40.0, nullable=False)
    cost_per_km = Column(Float, default=12.0, nullable=False)
    status = Column(String(50), default="AVAILABLE", nullable=False, index=True)  # AVAILABLE, IN_TRANSIT, MAINTENANCE, STANDBY
    current_location_id = Column(String(50), ForeignKey("locations.id"), nullable=False, index=True)
    destination_location_id = Column(String(50), ForeignKey("locations.id"), nullable=True)
    operational_restrictions = Column(JSON, nullable=True)
    maintenance_status = Column(String(50), default="OPERATIONAL", nullable=False)  # OPERATIONAL, SERVICE_DUE, REPAIR_REQUIRED
    available_from = Column(DateTime, nullable=True)
    available_to = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    current_location = relationship("Location", foreign_keys=[current_location_id])
    destination_location = relationship("Location", foreign_keys=[destination_location_id])


class LogisticsScenario(Base):
    __tablename__ = "logistics_scenarios"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    scenario_code = Column(String(50), unique=True, index=True, nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    author = Column(String(100), default="Logistics Planner", nullable=False)
    workflow_status = Column(String(50), default="DRAFT", nullable=False, index=True)  # DRAFT, SIMULATED, UNDER_REVIEW, APPROVED, REJECTED, COMMITTED
    
    # Isolated scenario simulation parameters
    scenario_inputs = Column(JSON, nullable=False)
    
    # Optimization & simulation outputs
    baseline_results = Column(JSON, nullable=True)
    simulation_results = Column(JSON, nullable=True)
    comparison_metrics = Column(JSON, nullable=True)
    allocation_plan = Column(JSON, nullable=True)
    impacted_locations = Column(JSON, nullable=True)
    candidate_routes = Column(JSON, nullable=True)
    infeasible_constraints = Column(JSON, nullable=True)
    
    # Review & Approval workflow
    reviewed_by = Column(String(100), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)
    approval_history = Column(JSON, default=list, nullable=False)
    
    # Metadata & provenance
    model_version = Column(String(50), default="GatiVyuh-Opt-v3.0", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class CorridorRouteSegment(Base):
    __tablename__ = "corridor_route_segments"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    origin_location_id = Column(String(50), ForeignKey("locations.id"), nullable=False, index=True)
    destination_location_id = Column(String(50), ForeignKey("locations.id"), nullable=False, index=True)
    distance_km = Column(Float, nullable=False)
    estimated_duration_min = Column(Float, nullable=False)
    road_class = Column(String(50), nullable=False)  # expressway, primary, secondary, mountain_pass
    avg_gradient_pct = Column(Float, default=2.0, nullable=False)
    max_gradient_pct = Column(Float, default=5.0, nullable=False)
    elevation_gain_m = Column(Float, default=50.0, nullable=False)
    is_blocked = Column(Boolean, default=False, nullable=False)
    blockage_reason = Column(String(200), nullable=True)
    geometry_geojson = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    origin_location = relationship("Location", foreign_keys=[origin_location_id])
    destination_location = relationship("Location", foreign_keys=[destination_location_id])

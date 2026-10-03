from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

# ==============================================================================
# FEATURE 1: TRANSPORTATION RESOURCES
# ==============================================================================

class TransportResourceBase(BaseModel):
    name: str = Field(..., max_length=150)
    vehicle_type: str = Field(..., description="HEAVY_TRUCK, MEDIUM_TRUCK, LIGHT_UTILITY, FUEL_TANKER, REFRIGERATED_VAN")
    capacity_weight_kg: float = Field(..., gt=0)
    capacity_volume_m3: float = Field(..., gt=0)
    fuel_efficiency_km_l: float = Field(3.5, gt=0)
    speed_empty_kmh: float = Field(50.0, gt=0)
    speed_loaded_kmh: float = Field(40.0, gt=0)
    cost_per_km: float = Field(12.0, ge=0)
    status: str = Field("AVAILABLE", description="AVAILABLE, IN_TRANSIT, MAINTENANCE, STANDBY")
    current_location_id: str
    destination_location_id: Optional[str] = None
    operational_restrictions: Optional[Dict[str, Any]] = None
    maintenance_status: str = Field("OPERATIONAL", description="OPERATIONAL, SERVICE_DUE, REPAIR_REQUIRED")
    available_from: Optional[datetime] = None
    available_to: Optional[datetime] = None

class TransportResourceCreate(TransportResourceBase):
    id: str = Field(..., max_length=50)

class TransportResourceUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    current_load_kg: Optional[float] = None
    current_location_id: Optional[str] = None
    destination_location_id: Optional[str] = None
    maintenance_status: Optional[str] = None
    operational_restrictions: Optional[Dict[str, Any]] = None

class TransportResourceResponse(TransportResourceBase):
    id: str
    current_load_kg: float
    current_location_name: Optional[str] = None
    destination_location_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==============================================================================
# FEATURE 2 & 4: ROAD NETWORK AND ROUTE ANALYSIS
# ==============================================================================

class ElevationProfilePoint(BaseModel):
    distance_km: float
    elevation_m: float
    lat: float
    lon: float

class RouteCandidate(BaseModel):
    route_id: str
    name: str
    origin_id: str
    origin_name: str
    destination_id: str
    destination_name: str
    distance_km: float
    estimated_duration_min: float
    road_classes: List[str]
    elevation_gain_m: float
    max_slope_pct: float
    is_feasible: bool
    unfeasible_reason: Optional[str] = None
    explanation: str
    elevation_profile: List[ElevationProfilePoint] = []
    geometry_geojson: Optional[Dict[str, Any]] = None

class RouteAnalysisRequest(BaseModel):
    origin_location_id: str
    destination_location_id: str
    avoid_road_classes: Optional[List[str]] = None
    max_gradient_pct: Optional[float] = None
    simulate_closures: Optional[List[str]] = None

class RouteAnalysisResponse(BaseModel):
    origin_location_id: str
    origin_name: str
    destination_location_id: str
    destination_name: str
    candidate_routes: List[RouteCandidate]
    recommended_route_id: Optional[str] = None
    data_attribution: str = "OpenStreetMap contributors (ODbL) & NASA SRTMGL1 (30m)"
    operational_notice: str = "Static topological & geometric analysis. Does not claim live traffic or dynamic incident feeds."

class CorridorRouteSegmentResponse(BaseModel):
    id: str
    name: str
    origin_location_id: str
    destination_location_id: str
    distance_km: float
    estimated_duration_min: float
    road_class: str
    avg_gradient_pct: float
    max_gradient_pct: float
    elevation_gain_m: float
    is_blocked: bool
    blockage_reason: Optional[str] = None
    geometry_geojson: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True

# ==============================================================================
# FEATURE 3: MULTI-CONSTRAINT SUPPLY ALLOCATION
# ==============================================================================

class SupplyAllocationItem(BaseModel):
    source_location_id: str
    source_location_name: str
    destination_location_id: str
    destination_location_name: str
    category: str
    quantity_allocated: float
    transport_resource_id: Optional[str] = None
    transport_resource_name: Optional[str] = None
    route_name: str
    distance_km: float
    estimated_cost: float
    rationale: str

class UnmetDemandItem(BaseModel):
    destination_location_id: str
    destination_name: str
    category: str
    forecast_demand: float
    allocated_quantity: float
    unmet_quantity: float
    shortage_reason: str

class SupplyAllocationRequest(BaseModel):
    category: Optional[str] = None
    priority_weights: Optional[Dict[str, float]] = None
    transport_cost_weight: float = Field(0.05, ge=0.0)
    enforce_safety_stock: bool = True
    blocked_route_ids: Optional[List[str]] = None
    transport_capacity_factor: float = Field(1.0, ge=0.0, le=5.0)
    demand_multiplier: float = Field(1.0, ge=0.1, le=5.0)

class SupplyAllocationResponse(BaseModel):
    solver_status: str  # OPTIMAL, INFEASIBLE, FEASIBLE_WITH_DEFICIT
    solver_name: str = "SciPy HiGHS Exact Linear/MILP Solver"
    total_demand_requested: float
    total_allocated: float
    total_unmet_demand: float
    total_transport_cost: float
    allocations: List[SupplyAllocationItem]
    unmet_demand_breakdown: List[UnmetDemandItem]
    infeasible_constraints: List[str]
    trade_off_explanation: str
    solver_time_ms: float
    calculated_at: datetime


# ==============================================================================
# FEATURE 5: SUPPLY-CHAIN DEPENDENCY & RIPPLE-EFFECT
# ==============================================================================

class DependencyNode(BaseModel):
    id: str
    name: str
    location_type: str
    latitude: float
    longitude: float
    elevation_m: Optional[float]
    status: str
    risk_state: str
    total_available_stock: float
    daily_burn_rate: float
    days_to_shortage: Optional[float]

class DependencyEdge(BaseModel):
    id: str
    source: str
    target: str
    source_name: str
    target_name: str
    distance_km: float
    road_class: str
    is_blocked: bool = False
    average_flow_rate: float

class RippleDisruptionSimulation(BaseModel):
    disrupted_node_id: Optional[str] = None
    disrupted_link_id: Optional[str] = None
    affected_nodes: List[Dict[str, Any]]
    isolated_nodes: List[str]
    total_unmet_demand_delta: float
    acceleration_summary: str

class DependencyGraphResponse(BaseModel):
    nodes: List[DependencyNode]
    edges: List[DependencyEdge]
    ripple_analysis: Optional[RippleDisruptionSimulation] = None
    source_attribution: str = "Topology grounded in registered forward locations & OSM corridor links."


# ==============================================================================
# FEATURE 6: LOGISTICS DIGITAL TWIN WORKSPACE
# ==============================================================================

class DigitalTwinResponse(BaseModel):
    timestamp: datetime
    mode: str = "RECORDED_OPERATIONAL_STATE"
    nodes_count: int
    active_fleet_count: int
    in_transit_convoys_count: int
    open_alerts_count: int
    nodes: List[Dict[str, Any]]
    fleet: List[TransportResourceResponse]
    active_routes: List[Dict[str, Any]]
    shortage_forecasts: List[Dict[str, Any]]
    network_summary: Dict[str, Any]


# ==============================================================================
# FEATURE 7, 8 & 9: WHAT-IF SCENARIOS & HUMAN APPROVAL
# ==============================================================================

class ScenarioInputs(BaseModel):
    road_closures: List[str] = []  # Route/segment IDs or location IDs
    demand_multipliers: Dict[str, float] = {}  # Category -> multiplier (e.g. {"FUEL": 1.4})
    replenishment_delays: Dict[str, int] = {}  # Location_id -> days delayed
    transport_capacity_factor: float = 1.0  # 1.0 = normal, 0.5 = 50% fleet unavailable
    inventory_adjustments: Dict[str, float] = {}  # "LOC-LON-03:FUEL" -> delta
    restricted_vehicle_ids: List[str] = []

class ScenarioCreate(BaseModel):
    scenario_code: str = Field(..., max_length=50)
    title: str = Field(..., max_length=200)
    description: Optional[str] = None
    author: str = "Logistics Planner"
    scenario_inputs: ScenarioInputs

class ScenarioReviewAction(BaseModel):
    action: str = Field(..., description="SUBMIT_REVIEW, APPROVE, REJECT")
    reviewer: str = Field(..., max_length=100)
    notes: Optional[str] = None

class ScenarioResponse(BaseModel):
    id: int
    scenario_code: str
    title: str
    description: Optional[str]
    author: str
    workflow_status: str  # DRAFT, SIMULATED, UNDER_REVIEW, APPROVED, REJECTED, COMMITTED
    scenario_inputs: ScenarioInputs
    baseline_results: Optional[Dict[str, Any]] = None
    simulation_results: Optional[Dict[str, Any]] = None
    comparison_metrics: Optional[Dict[str, Any]] = None
    allocation_plan: Optional[List[Dict[str, Any]]] = None
    impacted_locations: Optional[List[Dict[str, Any]]] = None
    candidate_routes: Optional[List[Dict[str, Any]]] = None
    infeasible_constraints: Optional[List[str]] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    approval_history: List[Dict[str, Any]] = []
    model_version: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ==============================================================================
# FEATURE 10: REPORTING & OPERATIONAL ANALYTICS
# ==============================================================================

class OperationalReportResponse(BaseModel):
    report_title: str
    generated_at: datetime
    generator: str
    platform_version: str
    system_status: str
    current_inventory_summary: Dict[str, Any]
    active_shortage_risks: List[Dict[str, Any]]
    simulated_scenarios_summary: List[Dict[str, Any]]
    optimization_performance: Dict[str, Any]
    data_provenance_and_licensing: Dict[str, str]
    human_audit_trail: List[Dict[str, Any]]

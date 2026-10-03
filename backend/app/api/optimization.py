import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import PlainTextResponse, JSONResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.optimization import (
    TransportResourceCreate, TransportResourceUpdate, TransportResourceResponse,
    CorridorRouteSegmentResponse,
    RouteAnalysisRequest, RouteAnalysisResponse,
    SupplyAllocationRequest, SupplyAllocationResponse,
    DependencyGraphResponse, RippleDisruptionSimulation,
    DigitalTwinResponse,
    ScenarioCreate, ScenarioReviewAction, ScenarioResponse,
    OperationalReportResponse
)
from app.services.transport_resource_service import transport_resource_service
from app.services.road_network_service import road_network_service
from app.services.optimization_service import optimization_service
from app.services.scenario_service import scenario_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/optimization", tags=["Logistics Optimization & Scenarios"])

# ==============================================================================
# FEATURE 1: TRANSPORTATION RESOURCE INTELLIGENCE
# ==============================================================================

@router.get("/resources", response_model=List[TransportResourceResponse])
def list_transport_resources(
    status: Optional[str] = Query(None, description="AVAILABLE, IN_TRANSIT, MAINTENANCE, STANDBY, or ALL"),
    vehicle_type: Optional[str] = Query(None, description="HEAVY_TRUCK, MEDIUM_TRUCK, LIGHT_UTILITY, FUEL_TANKER, REFRIGERATED_VAN"),
    location_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Lists fictional registered transport resources with capacity and operational status."""
    resources = transport_resource_service.list_resources(
        db, status=status, vehicle_type=vehicle_type, location_id=location_id
    )
    # Ensure initial fleet is seeded if empty
    if not resources and (status is None or status == "ALL"):
        transport_resource_service.seed_initial_fleet(db)
        resources = transport_resource_service.list_resources(db)

    # Attach location names
    from app.models.location import Location
    loc_map = {l.id: l.name for l in db.query(Location).all()}

    res_list = []
    for r in resources:
        item = TransportResourceResponse.model_validate(r)
        item.current_location_name = loc_map.get(r.current_location_id)
        item.destination_location_name = loc_map.get(r.destination_location_id) if r.destination_location_id else None
        res_list.append(item)
    return res_list


@router.get("/resources/{resource_id}", response_model=TransportResourceResponse)
def get_transport_resource(resource_id: str, db: Session = Depends(get_db)):
    """Retrieves specific transport resource details."""
    resource = transport_resource_service.get_resource(db, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail=f"Transport resource '{resource_id}' not found.")
    
    from app.models.location import Location
    loc_map = {l.id: l.name for l in db.query(Location).all()}
    item = TransportResourceResponse.model_validate(resource)
    item.current_location_name = loc_map.get(resource.current_location_id)
    item.destination_location_name = loc_map.get(resource.destination_location_id) if resource.destination_location_id else None
    return item


@router.post("/resources", response_model=TransportResourceResponse, status_code=status.HTTP_201_CREATED)
def create_transport_resource(data: TransportResourceCreate, db: Session = Depends(get_db)):
    """Registers a new fictional transport resource into the logistics fleet."""
    try:
        created = transport_resource_service.create_resource(db, data)
        return TransportResourceResponse.model_validate(created)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/resources/{resource_id}", response_model=TransportResourceResponse)
def update_transport_resource(resource_id: str, data: TransportResourceUpdate, db: Session = Depends(get_db)):
    """Updates operational state, status, or assignment for a transport resource."""
    try:
        updated = transport_resource_service.update_resource(db, resource_id, data)
        return TransportResourceResponse.model_validate(updated)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/resources/seed")
def seed_fleet(db: Session = Depends(get_db)):
    """Seeds reproducible tactical fleet inventory across corridor nodes."""
    count = transport_resource_service.seed_initial_fleet(db)
    return {"message": "Fleet inventory seeded", "resources_count": count}


# ==============================================================================
# FEATURE 2 & 4: ROAD NETWORK AND ROUTE ANALYSIS
# ==============================================================================

@router.get("/corridors", response_model=List[CorridorRouteSegmentResponse])
def list_corridor_segments(db: Session = Depends(get_db)):
    """Returns strategic corridor road segments connecting registered logistics nodes."""
    segments = road_network_service.list_corridors(db)
    return [CorridorRouteSegmentResponse.model_validate(s) for s in segments]


@router.post("/routes/analyze", response_model=RouteAnalysisResponse)
def analyze_routes(data: RouteAnalysisRequest, db: Session = Depends(get_db)):
    """
    Computes candidate routes between two forward locations.
    Evaluates real SRTMGL1 elevation profile, road class constraints, and terrain slopes.
    """
    try:
        return road_network_service.get_candidate_routes(
            db,
            origin_id=data.origin_location_id,
            dest_id=data.destination_location_id,
            avoid_road_classes=data.avoid_road_classes,
            max_gradient_pct=data.max_gradient_pct,
            simulate_closures=data.simulate_closures
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/network/connectivity")
def get_network_connectivity(db: Session = Depends(get_db)):
    """Provides operational transparency on road network coverage, connectivity, and OSM attribution."""
    return road_network_service.get_network_connectivity(db)


# ==============================================================================
# FEATURE 3: MULTI-CONSTRAINT SUPPLY ALLOCATION
# ==============================================================================

@router.post("/allocate", response_model=SupplyAllocationResponse)
def run_supply_allocation(request: SupplyAllocationRequest, db: Session = Depends(get_db)):
    """
    Executes transparent multi-constraint supply allocation solver using SciPy HiGHS.
    Respects available stock, transport capacities, road closures, and priority weights.
    """
    return optimization_service.solve_supply_allocation(db, request)


# ==============================================================================
# FEATURE 5: SUPPLY-CHAIN DEPENDENCY & RIPPLE-EFFECT
# ==============================================================================

@router.get("/dependencies", response_model=DependencyGraphResponse)
def get_supply_chain_dependencies(db: Session = Depends(get_db)):
    """Returns network graph of nodes, inventory reserves, burn rates, and corridor links."""
    return optimization_service.get_dependency_graph(db)


@router.post("/dependencies/ripple", response_model=RippleDisruptionSimulation)
def simulate_ripple_disruption(
    disrupted_node_id: Optional[str] = Query(None),
    disrupted_link_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Simulates hypothetical disruption of a supply node or corridor conduit.
    Evaluates downstream shortage acceleration and isolated vertices.
    """
    if not disrupted_node_id and not disrupted_link_id:
        raise HTTPException(status_code=400, detail="Provide either disrupted_node_id or disrupted_link_id.")
    return optimization_service.simulate_ripple_disruption(
        db, disrupted_node_id=disrupted_node_id, disrupted_link_id=disrupted_link_id
    )


# ==============================================================================
# FEATURE 6: LOGISTICS DIGITAL TWIN WORKSPACE
# ==============================================================================

@router.get("/digital-twin", response_model=DigitalTwinResponse)
def get_logistics_digital_twin(db: Session = Depends(get_db)):
    """
    Aggregates recorded operational state: inventory, fleet status, convoys,
    alerts, and corridor relationships.
    """
    return scenario_service.get_digital_twin(db)


# ==============================================================================
# FEATURE 7, 8 & 9: WHAT-IF SCENARIOS & HUMAN APPROVAL
# ==============================================================================

@router.get("/scenarios", response_model=List[ScenarioResponse])
def list_scenarios(db: Session = Depends(get_db)):
    """Lists all configured logistics scenarios."""
    scenarios = scenario_service.list_scenarios(db)
    return [ScenarioResponse.model_validate(s) for s in scenarios]


@router.post("/scenarios", response_model=ScenarioResponse, status_code=status.HTTP_201_CREATED)
def create_scenario(data: ScenarioCreate, db: Session = Depends(get_db)):
    """Configures a new isolated what-if scenario in DRAFT state."""
    try:
        scenario = scenario_service.create_scenario(db, data)
        return ScenarioResponse.model_validate(scenario)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/scenarios/{scenario_id}", response_model=ScenarioResponse)
def get_scenario(scenario_id: int, db: Session = Depends(get_db)):
    """Retrieves scenario details and simulation results."""
    scenario = scenario_service.get_scenario(db, scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found.")
    return ScenarioResponse.model_validate(scenario)


@router.post("/scenarios/{scenario_id}/simulate", response_model=ScenarioResponse)
def simulate_scenario(scenario_id: int, db: Session = Depends(get_db)):
    """
    Executes isolated what-if simulation against current state.
    Calculates unmet demand, trade-offs, and comparison metrics without updating DB.
    """
    try:
        simulated = scenario_service.simulate_scenario(db, scenario_id)
        return ScenarioResponse.model_validate(simulated)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/scenarios/{scenario_id}/review", response_model=ScenarioResponse)
def review_scenario(scenario_id: int, data: ScenarioReviewAction, db: Session = Depends(get_db)):
    """
    Transitions scenario workflow status:
    SUBMIT_REVIEW -> UNDER_REVIEW -> APPROVE or REJECT.
    """
    try:
        reviewed = scenario_service.review_scenario(db, scenario_id, data)
        return ScenarioResponse.model_validate(reviewed)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/scenarios/{scenario_id}/commit", response_model=ScenarioResponse)
def commit_approved_scenario(
    scenario_id: int,
    committed_by: str = Query("Logistics Operations Officer"),
    notes: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Explicit human authorization to commit an APPROVED scenario into active database records.
    Dispatches convoys, reserves inventory, and records audit trail.
    """
    try:
        committed = scenario_service.commit_approved_scenario(db, scenario_id, committed_by, notes)
        return ScenarioResponse.model_validate(committed)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/scenarios/compare")
def compare_scenarios(scenario_ids: List[int], db: Session = Depends(get_db)):
    """Side-by-side comparison of baseline metrics against selected scenarios."""
    try:
        return scenario_service.compare_scenarios(db, scenario_ids)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/scenarios/{scenario_id}")
def delete_scenario(scenario_id: int, db: Session = Depends(get_db)):
    """Deletes an isolated draft scenario."""
    from app.models.optimization import LogisticsScenario
    scenario = db.query(LogisticsScenario).filter(LogisticsScenario.id == scenario_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found.")
    db.delete(scenario)
    db.commit()
    return {"message": f"Scenario {scenario_id} deleted."}


# ==============================================================================
# FEATURE 10: REPORTING & OPERATIONAL ANALYTICS
# ==============================================================================

@router.get("/reports/summary", response_model=OperationalReportResponse)
def get_operational_summary_report(db: Session = Depends(get_db)):
    """Generates comprehensive operational analytics and review summary."""
    return scenario_service.generate_operational_report(db)


@router.get("/reports/export/csv")
def export_csv_report(db: Session = Depends(get_db)):
    """Downloads operational fleet and scenario allocation plan in CSV format."""
    csv_content = scenario_service.export_csv_reports(db)
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=gativyuh_logistics_report.csv"}
    )


@router.get("/reports/export/json")
def export_json_report(db: Session = Depends(get_db)):
    """Downloads full operational state and audit trail as JSON."""
    report = scenario_service.generate_operational_report(db)
    return JSONResponse(
        content=report.model_dump(mode="json"),
        headers={"Content-Disposition": "attachment; filename=gativyuh_operational_audit.json"}
    )

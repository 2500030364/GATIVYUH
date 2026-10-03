from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.location import Location
from app.models.inventory import InventoryItem
from app.models.event import LogisticsEvent
from app.models.alert import Alert
from app.schemas.dashboard import (
    DashboardSummary, LocationStatusBreakdown, CategoryInventorySummary,
    LogisticsFlowSummary, DataFreshness
)
from app.schemas.event import LogisticsEventResponse
from app.schemas.alert import AlertResponse
from app.services.gis_service import gis_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(db: Session = Depends(get_db)):
    total_locations = db.query(Location).filter(Location.is_active == True).count()
    total_inventory_items = db.query(InventoryItem).count()
    active_alerts_count = db.query(Alert).filter(Alert.is_acknowledged == False).count()
    critical_alerts_count = db.query(Alert).filter(Alert.is_acknowledged == False, Alert.severity == "CRITICAL").count()

    # Location status counts
    locations = db.query(Location).filter(Location.is_active == True).all()
    status_counts = {"STABLE": 0, "WATCH": 0, "AT_RISK": 0, "CRITICAL": 0, "INACTIVE": 0}
    for loc in locations:
        s = loc.status.upper() if loc.status else "STABLE"
        if s in status_counts:
            status_counts[s] += 1
        else:
            status_counts["STABLE"] += 1

    location_status = LocationStatusBreakdown(
        stable=status_counts["STABLE"],
        watch=status_counts["WATCH"],
        at_risk=status_counts["AT_RISK"],
        critical=status_counts["CRITICAL"],
        inactive=status_counts["INACTIVE"],
        total=total_locations
    )

    # Category inventory summary
    categories_data = []
    cat_units = {
        "FOOD_WATER": "Rations / Liters",
        "FUEL": "Liters",
        "MEDICAL_SUPPLIES": "Kits / Packs",
        "GENERAL_SUPPLIES": "Units"
    }
    for cat_name, unit_label in cat_units.items():
        items = db.query(InventoryItem).filter(InventoryItem.category == cat_name).all()
        tot_avail = sum(i.available_stock for i in items)
        tot_res = sum(i.reserved_stock for i in items)
        categories_data.append(CategoryInventorySummary(
            category=cat_name,
            total_available=round(tot_avail, 1),
            total_reserved=round(tot_res, 1),
            unit=unit_label,
            items_count=len(items)
        ))

    # Logistics flow metrics
    in_transit_count = db.query(LogisticsEvent).filter(LogisticsEvent.status == "IN_TRANSIT").count()
    delayed_count = db.query(LogisticsEvent).filter(LogisticsEvent.status == "DELAYED").count()
    completed_events = db.query(LogisticsEvent).filter(LogisticsEvent.status == "COMPLETED").count()

    flows = LogisticsFlowSummary(
        in_transit_count=in_transit_count,
        delayed_count=delayed_count,
        completed_today=completed_events,
        inbound_deliveries_pending=in_transit_count,
        outbound_dispatches_active=in_transit_count
    )

    # Recent events (5 most recent)
    recent_events_db = db.query(LogisticsEvent).order_by(LogisticsEvent.timestamp.desc()).limit(5).all()
    recent_events = []
    for ev in recent_events_db:
        resp = LogisticsEventResponse.model_validate(ev)
        if ev.source_location:
            resp.source_location_name = ev.source_location.name
        if ev.destination_location:
            resp.destination_location_name = ev.destination_location.name
        recent_events.append(resp)

    # Recent active alerts (5 most recent)
    recent_alerts_db = db.query(Alert).filter(Alert.is_acknowledged == False).order_by(Alert.created_at.desc()).limit(5).all()
    recent_alerts = []
    for al in recent_alerts_db:
        resp = AlertResponse.model_validate(al)
        if al.location:
            resp.location_name = al.location.name
        recent_alerts.append(resp)

    # System freshness and GIS status
    roads_meta = gis_service.validate_roads()
    terrain_meta = gis_service.validate_terrain()
    last_event = db.query(LogisticsEvent).order_by(LogisticsEvent.timestamp.desc()).first()

    freshness = DataFreshness(
        database_status="HEALTHY",
        roads_status="LOADED_REAL" if roads_meta.is_valid else "MISSING_DATA",
        roads_source="OpenStreetMap Export (GATIVYUH_Pune_Roads.geojson)" if roads_meta.is_valid else "None",
        roads_feature_count=roads_meta.feature_count,
        terrain_status="LOADED_REAL" if terrain_meta.is_valid else "MISSING_DATA",
        terrain_elevation_range=f"{terrain_meta.min_elevation}m to {terrain_meta.max_elevation}m" if terrain_meta.is_valid else None,
        system_mode="HYBRID_REAL_GIS" if (roads_meta.is_valid or terrain_meta.is_valid) else "SYNTHETIC_ONLY",
        last_event_time=last_event.timestamp if last_event else None,
        server_time=datetime.utcnow()
    )

    return DashboardSummary(
        total_locations=total_locations,
        total_inventory_items=total_inventory_items,
        active_alerts_count=active_alerts_count,
        critical_alerts_count=critical_alerts_count,
        location_status=location_status,
        categories=categories_data,
        flows=flows,
        recent_events=recent_events,
        recent_alerts=recent_alerts,
        freshness=freshness
    )

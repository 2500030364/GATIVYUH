import random
import logging
from datetime import datetime, timedelta
from typing import Dict, Any
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.models.location import Location
from app.models.inventory import InventoryItem
from app.models.event import LogisticsEvent
from app.models.alert import Alert
from app.models.audit import DatasetAudit
from app.models.predictive import (
    DailyConsumptionRecord, ForecastResult, ModelEvaluationMetric,
    DemandAnomaly, RiskAssessment, PriorityQueueItem
)
from app.models.optimization import (
    TransportResource, LogisticsScenario, CorridorRouteSegment
)
from app.services.gis_service import gis_service
from app.services.inventory_service import inventory_service
from app.services.transport_resource_service import transport_resource_service
from app.services.road_network_service import road_network_service

DEMO_LOCATIONS = [
    {
        "id": "LOC-PUN-01",
        "name": "Pune Central Hub (Hinjewadi)",
        "location_type": "HUB",
        "latitude": 18.5912,
        "longitude": 73.7389,
        "description": "Primary logistics consolidation hub connecting NH48 Pune-Mumbai corridor and industrial zones."
    },
    {
        "id": "LOC-TAL-02",
        "name": "Talegaon Strategic Depot",
        "location_type": "DISTRIBUTION_CENTER",
        "latitude": 18.7342,
        "longitude": 73.6761,
        "description": "High-capacity staging warehouse and fleet maintenance center along railway spur."
    },
    {
        "id": "LOC-LON-03",
        "name": "Lonavala Forward Base",
        "location_type": "FORWARD_DEPOT",
        "latitude": 18.7557,
        "longitude": 73.4091,
        "description": "High-altitude Ghats tactical depot regulating transit across Bhor Ghat corridor."
    },
    {
        "id": "LOC-KAM-04",
        "name": "Kamshet Field Medical Station",
        "location_type": "FIELD_HOSPITAL",
        "latitude": 18.7610,
        "longitude": 73.5532,
        "description": "Forward emergency triage and medical replenishment node serving the central valley."
    },
    {
        "id": "LOC-MUL-05",
        "name": "Mulshi Valley Post",
        "location_type": "FORWARD_DEPOT",
        "latitude": 18.5082,
        "longitude": 73.5124,
        "description": "Isolated reservoir valley supply post subject to monsoon and terrain transit constraints."
    },
    {
        "id": "LOC-KHO-06",
        "name": "Khopoli Transit Node",
        "location_type": "TRANSIT_NODE",
        "latitude": 18.7845,
        "longitude": 73.3421,
        "description": "Low-elevation coastal transit interchange connecting Konkan plains to the Ghats ascent."
    },
    {
        "id": "LOC-PAW-07",
        "name": "Pawna Tactical Supply Point",
        "location_type": "FORWARD_DEPOT",
        "latitude": 18.6650,
        "longitude": 73.4820,
        "description": "Waterfront resupply post providing secondary route access between Mulshi and Lonavala."
    },
    {
        "id": "LOC-CHA-08",
        "name": "Chakan Fuel Staging Depot",
        "location_type": "FUEL_DEPOT",
        "latitude": 18.7511,
        "longitude": 73.7984,
        "description": "Bulk petroleum, oils, and lubricants (POL) buffer terminal serving northern sector convoys."
    }
]

DEMO_SUPPLIES = [
    {"category": "FOOD_WATER", "item_name": "Emergency MRE Rations", "unit": "Rations", "min_base": 1200, "max_cap": 8000},
    {"category": "FOOD_WATER", "item_name": "Purified Potable Water", "unit": "Liters", "min_base": 2500, "max_cap": 15000},
    {"category": "FUEL", "item_name": "High-Speed Diesel (HSD)", "unit": "Liters", "min_base": 3000, "max_cap": 20000},
    {"category": "FUEL", "item_name": "Aviation Turbine Fuel (Jet-A1)", "unit": "Liters", "min_base": 1500, "max_cap": 10000},
    {"category": "MEDICAL_SUPPLIES", "item_name": "Trauma Surgical Field Kits", "unit": "Kits", "min_base": 150, "max_cap": 1000},
    {"category": "MEDICAL_SUPPLIES", "item_name": "Broad-Spectrum Antibiotic Packs", "unit": "Packs", "min_base": 400, "max_cap": 3000},
    {"category": "GENERAL_SUPPLIES", "item_name": "All-Terrain Heavy Duty Tires", "unit": "Units", "min_base": 80, "max_cap": 500},
    {"category": "GENERAL_SUPPLIES", "item_name": "Portable Multi-Fuel Generators", "unit": "Units", "min_base": 20, "max_cap": 120},
]

class SyntheticDataService:
    @staticmethod
    def generate_demo_dataset(db: Session, seed: int = 42, reset_existing: bool = True) -> Dict[str, Any]:
        random.seed(seed)
        now = datetime.utcnow()

        if reset_existing:
            # Clean existing synthetic data
            db.query(LogisticsScenario).delete()
            db.query(CorridorRouteSegment).delete()
            db.query(TransportResource).delete()
            db.query(PriorityQueueItem).delete()
            db.query(RiskAssessment).delete()
            db.query(DemandAnomaly).delete()
            db.query(ModelEvaluationMetric).delete()
            db.query(ForecastResult).delete()
            db.query(DailyConsumptionRecord).delete()
            db.query(Alert).delete()
            db.query(LogisticsEvent).delete()
            db.query(InventoryItem).delete()
            db.query(Location).filter(Location.is_synthetic == True).delete()
            db.commit()

        created_locations = []
        for loc_data in DEMO_LOCATIONS:
            # Query actual elevation from SRTM raster
            elev_res = gis_service.get_elevation_at_point(loc_data["latitude"], loc_data["longitude"])
            elev_val = elev_res.elevation_m if elev_res.elevation_m is not None else 600.0

            loc = Location(
                id=loc_data["id"],
                name=loc_data["name"],
                location_type=loc_data["location_type"],
                status="STABLE",
                latitude=loc_data["latitude"],
                longitude=loc_data["longitude"],
                elevation_m=elev_val,
                description=loc_data["description"],
                is_synthetic=True,
                is_active=True,
                created_at=now - timedelta(days=30),
                updated_at=now
            )
            db.add(loc)
            created_locations.append(loc)

        db.commit()

        # Seed inventory items with carefully tailored balances for each location
        created_items = []
        for loc in created_locations:
            # Different locations have different stock stresses
            is_critical_loc = (loc.id == "LOC-MUL-05")  # Mulshi valley low on fuel & medical
            is_at_risk_loc = (loc.id == "LOC-LON-03")   # Lonavala Ghats post under heavy diesel drain
            is_watch_loc = (loc.id == "LOC-KAM-04")     # Medical buffer tight

            for sup in DEMO_SUPPLIES:
                min_stock = float(sup["min_base"])
                max_cap = float(sup["max_cap"])
                
                # Calibrate available stock
                if is_critical_loc and sup["category"] in ("FUEL", "MEDICAL_SUPPLIES"):
                    avail = round(min_stock * random.uniform(0.10, 0.22), 1)  # CRITICAL: < 25% of min
                elif is_at_risk_loc and sup["category"] == "FUEL":
                    avail = round(min_stock * random.uniform(0.40, 0.85), 1)  # AT_RISK: < min
                elif is_watch_loc and sup["category"] == "MEDICAL_SUPPLIES":
                    avail = round(min_stock * random.uniform(1.05, 1.20), 1)  # WATCH: near min
                elif loc.location_type in ("HUB", "DISTRIBUTION_CENTER"):
                    avail = round(min_stock * random.uniform(2.5, 4.0), 1)    # STABLE & healthy
                else:
                    avail = round(min_stock * random.uniform(1.4, 2.5), 1)    # STABLE

                reserved = round(avail * random.uniform(0.05, 0.15), 1) if avail > 50 else 0.0
                replenish = round(min_stock * 1.5, 1)

                item = InventoryItem(
                    location_id=loc.id,
                    category=sup["category"],
                    item_name=sup["item_name"],
                    unit=sup["unit"],
                    available_stock=avail,
                    reserved_stock=reserved,
                    min_stock=min_stock,
                    max_capacity=max_cap,
                    replenishment_qty=replenish,
                    last_replenished_at=now - timedelta(days=random.randint(1, 10)),
                    updated_at=now
                )
                db.add(item)
                created_items.append(item)

        db.commit()

        # Update alerts and location statuses for all items
        for item in created_items:
            inventory_service.sync_alerts_for_item(db, item)
        db.commit()

        for loc in created_locations:
            inventory_service.update_location_status(db, loc.id)
        db.commit()

        # Generate realistic historical logistics events
        events = [
            # Event 1: Recent Bulk Receipt at Central Hub
            LogisticsEvent(
                id="EVT-2026-001",
                event_type="RECEIPT",
                location_id="LOC-PUN-01",
                destination_id=None,
                category="FUEL",
                item_name="High-Speed Diesel (HSD)",
                quantity=12000.0,
                unit="Liters",
                status="COMPLETED",
                reference_code="PO-IOCL-9841",
                notes="Rail-to-tanker bulk petroleum transfer received from Manmad Refinery pipeline terminal.",
                is_synthetic=True,
                timestamp=now - timedelta(hours=14)
            ),
            # Event 2: In-Transit Convoy from Pune to Lonavala
            LogisticsEvent(
                id="EVT-2026-002",
                event_type="DISPATCH",
                location_id="LOC-PUN-01",
                destination_id="LOC-LON-03",
                category="FOOD_WATER",
                item_name="Emergency MRE Rations",
                quantity=1500.0,
                unit="Rations",
                status="IN_TRANSIT",
                reference_code="CONVOY-LONA-04",
                notes="Priority resupply convoy transiting via NH48 expressway under mountain transit escort.",
                is_synthetic=True,
                timestamp=now - timedelta(hours=3, minutes=20)
            ),
            # Event 3: Delayed Convoy to Mulshi Valley
            LogisticsEvent(
                id="EVT-2026-003",
                event_type="DELAY",
                location_id="LOC-TAL-02",
                destination_id="LOC-MUL-05",
                category="FUEL",
                item_name="High-Speed Diesel (HSD)",
                quantity=2000.0,
                unit="Liters",
                status="DELAYED",
                reference_code="CONVOY-MUL-02",
                notes="Mudslide and rockfall reported near Tamhini Ghat junction. Convoy held at staging checkpoint.",
                is_synthetic=True,
                timestamp=now - timedelta(hours=5, minutes=45)
            ),
            # Event 4: Medical Consumption at Kamshet
            LogisticsEvent(
                id="EVT-2026-004",
                event_type="CONSUMPTION",
                location_id="LOC-KAM-04",
                destination_id=None,
                category="MEDICAL_SUPPLIES",
                item_name="Trauma Surgical Field Kits",
                quantity=35.0,
                unit="Kits",
                status="COMPLETED",
                reference_code="REQ-MED-2201",
                notes="Deployed for trauma stabilization following multi-vehicle pileup on expressway.",
                is_synthetic=True,
                timestamp=now - timedelta(hours=8)
            ),
            # Event 5: Successful Delivery to Pawna
            LogisticsEvent(
                id="EVT-2026-005",
                event_type="DELIVERY",
                location_id="LOC-PUN-01",
                destination_id="LOC-PAW-07",
                category="FOOD_WATER",
                item_name="Purified Potable Water",
                quantity=3000.0,
                unit="Liters",
                status="COMPLETED",
                reference_code="CONVOY-PAW-01",
                notes="Water tanker completed offload to permanent cistern storage tanks.",
                is_synthetic=True,
                timestamp=now - timedelta(hours=18)
            )
        ]

        for ev in events:
            db.add(ev)
        db.commit()

        # Generate 45 days of daily historical consumption records
        from app.services.forecasting_service import forecasting_service
        from app.services.anomaly_service import anomaly_service
        from app.services.risk_engine import risk_engine
        from app.services.priority_queue_service import priority_queue_service

        base_rates = {
            "FOOD_WATER": {"base": 220.0, "unit": "Rations", "item": "Emergency MRE Rations"},
            "FUEL": {"base": 280.0, "unit": "Liters", "item": "High-Speed Diesel (HSD)"},
            "MEDICAL_SUPPLIES": {"base": 22.0, "unit": "Kits", "item": "Trauma Surgical Field Kits"},
            "GENERAL_SUPPLIES": {"base": 8.0, "unit": "Units", "item": "All-Terrain Heavy Duty Tires"},
        }

        type_multipliers = {
            "HUB": 2.2,
            "DISTRIBUTION_CENTER": 1.6,
            "FORWARD_DEPOT": 1.0,
            "FIELD_HOSPITAL": 1.1,
            "FUEL_DEPOT": 1.4,
            "TRANSIT_NODE": 0.8
        }

        consumption_records = []
        for day_offset in range(45, 0, -1):
            curr_date = (now - timedelta(days=day_offset)).date()
            dow = curr_date.weekday()  # 0=Monday, 6=Sunday
            # Cyclical weekend effect
            dow_mult = 0.85 if dow in (5, 6) else 1.05

            for loc in created_locations:
                loc_mult = type_multipliers.get(loc.location_type, 1.0)
                for cat, cfg in base_rates.items():
                    # Category-specific specialization
                    cat_mult = 1.0
                    if loc.id == "LOC-KAM-04" and cat == "MEDICAL_SUPPLIES":
                        cat_mult = 2.4
                    elif loc.id == "LOC-CHA-08" and cat == "FUEL":
                        cat_mult = 2.2
                    elif loc.id == "LOC-MUL-05" and cat == "FUEL":
                        cat_mult = 1.3

                    base_qty = cfg["base"] * loc_mult * cat_mult * dow_mult
                    # Add random noise
                    noise = random.uniform(0.85, 1.15)
                    qty = round(base_qty * noise, 1)

                    # Intentional historical anomaly spikes for realistic detection
                    # 1. Kamshet medical spike 8 days ago (highway collision)
                    if loc.id == "LOC-KAM-04" and cat == "MEDICAL_SUPPLIES" and day_offset == 8:
                        qty = 62.0  # Significant statistical surge
                    # 2. Mulshi monsoon storm generator surge 12 days ago
                    if loc.id == "LOC-MUL-05" and cat == "FUEL" and day_offset in (11, 12, 13):
                        qty = round(base_qty * 2.3, 1)

                    rec = DailyConsumptionRecord(
                        location_id=loc.id,
                        category=cat,
                        item_name=cfg["item"],
                        date=curr_date,
                        quantity=qty,
                        unit=cfg["unit"],
                        is_synthetic=True
                    )
                    consumption_records.append(rec)

        db.bulk_save_objects(consumption_records)
        db.commit()

        # Run Stage 2 Predictive Pipeline:
        # 1. Generate forecasts for all location/category pairs
        for loc in created_locations:
            for cat in base_rates.keys():
                try:
                    forecasting_service.generate_forecast(session=db, location_id=loc.id, category=cat, horizon_days=14)
                except Exception as e:
                    logger.warning(f"Initial forecast generation skipped for {loc.id}-{cat}: {e}")

        # 2. Scan and flag demand anomalies
        anomaly_service.scan_all_anomalies(db)

        # 3. Evaluate risk assessments across corridor nodes
        risk_engine.evaluate_all_risks(db)

        # 4. Build prioritised attention queue
        priority_queue_service.rebuild_queue(db)

        # 5. Seed tactical transport fleet and corridor network
        fleet_count = transport_resource_service.seed_initial_fleet(db)
        corridors_count = road_network_service.seed_initial_corridors(db)

        # Update dataset audit records
        SyntheticDataService.update_audits(db)

        return {
            "success": True,
            "message": "Synthetic demo dataset, predictive intelligence, and logistics optimization pipelines successfully calibrated.",
            "seed": seed,
            "locations_created": len(created_locations),
            "inventory_items_created": len(created_items),
            "consumption_records_created": len(consumption_records),
            "events_created": len(events),
            "fleet_resources_created": fleet_count,
            "corridor_segments_created": corridors_count,
            "active_alerts_count": db.query(Alert).filter(Alert.is_acknowledged == False).count()
        }

    @staticmethod
    def update_audits(db: Session):
        now = datetime.utcnow()
        roads_meta = gis_service.validate_roads()
        terrain_meta = gis_service.validate_terrain()

        # Geographic: Roads
        r_audit = db.query(DatasetAudit).filter(DatasetAudit.dataset_name == "ROADS_GEOJSON").first()
        if not r_audit:
            r_audit = DatasetAudit(dataset_name="ROADS_GEOJSON", source_type="DOWNLOADED_REAL")
            db.add(r_audit)
        r_audit.record_count = roads_meta.feature_count
        r_audit.file_path = roads_meta.file_path
        r_audit.file_size_bytes = roads_meta.file_size_bytes
        r_audit.status = "VALID" if roads_meta.is_valid else "ERROR"
        r_audit.metadata_json = roads_meta.model_dump_json() if hasattr(roads_meta, "model_dump_json") else str(roads_meta)
        r_audit.last_validated_at = now

        # Geographic: Terrain GeoTIFF
        t_audit = db.query(DatasetAudit).filter(DatasetAudit.dataset_name == "TERRAIN_TIFF").first()
        if not t_audit:
            t_audit = DatasetAudit(dataset_name="TERRAIN_TIFF", source_type="DOWNLOADED_REAL")
            db.add(t_audit)
        t_audit.record_count = (terrain_meta.width * terrain_meta.height) if terrain_meta.width else 0
        t_audit.file_path = terrain_meta.file_path
        t_audit.file_size_bytes = terrain_meta.file_size_bytes
        t_audit.status = "VALID" if terrain_meta.is_valid else "ERROR"
        t_audit.metadata_json = terrain_meta.model_dump_json() if hasattr(terrain_meta, "model_dump_json") else str(terrain_meta)
        t_audit.last_validated_at = now

        # Logistics: Locations
        loc_count = db.query(Location).count()
        l_audit = db.query(DatasetAudit).filter(DatasetAudit.dataset_name == "LOCATIONS_LEDGER").first()
        if not l_audit:
            l_audit = DatasetAudit(dataset_name="LOCATIONS_LEDGER", source_type="SYNTHETIC_SIMULATION")
            db.add(l_audit)
        l_audit.record_count = loc_count
        l_audit.status = "VALID" if loc_count > 0 else "EMPTY"
        l_audit.last_validated_at = now

        # Logistics: Inventory
        inv_count = db.query(InventoryItem).count()
        i_audit = db.query(DatasetAudit).filter(DatasetAudit.dataset_name == "INVENTORY_LEDGER").first()
        if not i_audit:
            i_audit = DatasetAudit(dataset_name="INVENTORY_LEDGER", source_type="SYNTHETIC_SIMULATION")
            db.add(i_audit)
        i_audit.record_count = inv_count
        i_audit.status = "VALID" if inv_count > 0 else "EMPTY"
        i_audit.last_validated_at = now

        # Logistics: Events
        evt_count = db.query(LogisticsEvent).count()
        e_audit = db.query(DatasetAudit).filter(DatasetAudit.dataset_name == "EVENTS_LEDGER").first()
        if not e_audit:
            e_audit = DatasetAudit(dataset_name="EVENTS_LEDGER", source_type="SYNTHETIC_SIMULATION")
            db.add(e_audit)
        e_audit.record_count = evt_count
        e_audit.status = "VALID" if evt_count > 0 else "EMPTY"
        e_audit.last_validated_at = now

        db.commit()

synthetic_service = SyntheticDataService()

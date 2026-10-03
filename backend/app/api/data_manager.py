from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.location import Location
from app.models.inventory import InventoryItem
from app.models.event import LogisticsEvent
from app.models.audit import DatasetAudit
from app.schemas.data_manager import DatasetManagementOverview, DatasetStatusItem, CSVImportResult
from app.services.import_service import import_service
from app.services.gis_service import gis_service

router = APIRouter(prefix="/data", tags=["Data Management"])

@router.get("/status", response_model=DatasetManagementOverview)
def get_dataset_status(db: Session = Depends(get_db)):
    roads_meta = gis_service.validate_roads()
    terrain_meta = gis_service.validate_terrain()

    locations_count = db.query(Location).count()
    real_locations_count = db.query(Location).filter(Location.is_synthetic == False).count()
    inventory_count = db.query(InventoryItem).count()
    events_count = db.query(LogisticsEvent).count()

    items = [
        DatasetStatusItem(
            name="OpenStreetMap Road Network",
            category="GEOGRAPHIC",
            source_type="DOWNLOADED_REAL",
            status="VALID" if roads_meta.is_valid else "ERROR",
            record_count=roads_meta.feature_count,
            last_update=datetime.utcnow(),
            file_info=f"Size: {roads_meta.file_size_bytes or 0} bytes | File: GATIVYUH_Pune_Roads.geojson",
            description="Vector network extracted from OpenStreetMap covering Pune, Mulshi, and Lonavala corridors."
        ),
        DatasetStatusItem(
            name="NASA SRTMGL1 Elevation GeoTIFF",
            category="TERRAIN",
            source_type="DOWNLOADED_REAL",
            status="VALID" if terrain_meta.is_valid else "ERROR",
            record_count=(terrain_meta.width * terrain_meta.height) if terrain_meta.width else 0,
            last_update=datetime.utcnow(),
            file_info=f"CRS: {terrain_meta.crs} | Min: {terrain_meta.min_elevation}m, Max: {terrain_meta.max_elevation}m",
            description="1 arc-second (~30m) digital elevation model raster covering the Western Ghats demonstration area."
        ),
        DatasetStatusItem(
            name="Tracked Demonstration Locations",
            category="LOGISTICS_LEDGER",
            source_type="HYBRID" if real_locations_count > 0 else "SYNTHETIC_DEMO",
            status="VALID" if locations_count > 0 else "EMPTY",
            record_count=locations_count,
            last_update=datetime.utcnow(),
            file_info=f"{real_locations_count} imported / {locations_count - real_locations_count} simulated",
            description="Strategic depots, field medical facilities, forward posts, and fuel depots."
        ),
        DatasetStatusItem(
            name="Forward Supply Inventory Ledger",
            category="LOGISTICS_LEDGER",
            source_type="SYNTHETIC_DEMO",
            status="VALID" if inventory_count > 0 else "EMPTY",
            record_count=inventory_count,
            last_update=datetime.utcnow(),
            file_info="Full transactional integrity with min-threshold alerts",
            description="Itemized stock balances covering Food/Water, Fuel, Medical Supplies, and General Logistics."
        ),
        DatasetStatusItem(
            name="Operational Logistics Events Log",
            category="LOGISTICS_LEDGER",
            source_type="SYNTHETIC_DEMO",
            status="VALID" if events_count > 0 else "EMPTY",
            record_count=events_count,
            last_update=datetime.utcnow(),
            file_info="Includes receipts, consumption, in-transit convoys, delays, and deliveries",
            description="Chronological event journal driving supply movement and location state updates."
        )
    ]

    return DatasetManagementOverview(
        datasets=items,
        geographic_mode="REAL_DOWNLOADED_DATA",
        logistics_mode="SYNTHETIC_SIMULATION" if real_locations_count == 0 else "HYBRID_USER_AND_DEMO"
    )

@router.post("/import/locations", response_model=CSVImportResult)
async def import_locations_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files (.csv) are accepted.")
    
    contents = await file.read()
    try:
        content_str = contents.decode("utf-8")
    except UnicodeDecodeError:
        content_str = contents.decode("latin-1")

    result = import_service.import_locations(db, content_str)
    return result

@router.post("/import/inventory", response_model=CSVImportResult)
async def import_inventory_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files (.csv) are accepted.")
    
    contents = await file.read()
    try:
        content_str = contents.decode("utf-8")
    except UnicodeDecodeError:
        content_str = contents.decode("latin-1")

    result = import_service.import_inventory(db, content_str)
    return result

@router.get("/template/{dataset_type}")
def download_csv_template(dataset_type: str):
    try:
        csv_text = import_service.get_sample_template(dataset_type)
        return Response(
            content=csv_text,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={dataset_type.lower()}_template.csv"}
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

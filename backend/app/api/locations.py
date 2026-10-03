from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.location import Location
from app.models.inventory import InventoryItem
from app.models.alert import Alert
from app.schemas.location import LocationCreate, LocationUpdate, LocationResponse, LocationDetailResponse
from app.services.gis_service import gis_service

router = APIRouter(prefix="/locations", tags=["Locations"])

@router.get("", response_model=List[LocationResponse])
def list_locations(
    location_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Location)
    if location_type:
        query = query.filter(Location.location_type == location_type.upper())
    if status:
        query = query.filter(Location.status == status.upper())
    if is_active is not None:
        query = query.filter(Location.is_active == is_active)
    return query.order_by(Location.name.asc()).all()

@router.get("/{location_id}", response_model=LocationDetailResponse)
def get_location(location_id: str, db: Session = Depends(get_db)):
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail=f"Location '{location_id}' not found.")
    
    total_items = db.query(InventoryItem).filter(InventoryItem.location_id == location_id).count()
    active_alerts = db.query(Alert).filter(Alert.location_id == location_id, Alert.is_acknowledged == False).count()
    
    resp = LocationDetailResponse.model_validate(loc)
    resp.total_inventory_items = total_items
    resp.active_alerts_count = active_alerts
    return resp

@router.post("", response_model=LocationResponse, status_code=201)
def create_location(payload: LocationCreate, db: Session = Depends(get_db)):
    # Check duplicate ID
    if db.query(Location).filter(Location.id == payload.id).first():
        raise HTTPException(status_code=400, detail=f"Location with ID '{payload.id}' already exists.")
    
    # Check duplicate name
    if db.query(Location).filter(Location.name == payload.name).first():
        raise HTTPException(status_code=400, detail=f"Location with name '{payload.name}' already exists.")

    # Automatically query SRTM elevation if not provided
    elevation = payload.elevation_m
    if elevation is None:
        elev_res = gis_service.get_elevation_at_point(payload.latitude, payload.longitude)
        if elev_res.elevation_m is not None:
            elevation = elev_res.elevation_m

    loc = Location(
        id=payload.id,
        name=payload.name,
        location_type=payload.location_type,
        status=payload.status,
        latitude=payload.latitude,
        longitude=payload.longitude,
        elevation_m=elevation,
        description=payload.description,
        is_synthetic=payload.is_synthetic,
        is_active=payload.is_active,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(loc)
    db.commit()
    db.refresh(loc)
    return loc

@router.put("/{location_id}", response_model=LocationResponse)
def update_location(location_id: str, payload: LocationUpdate, db: Session = Depends(get_db)):
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail=f"Location '{location_id}' not found.")

    if payload.name is not None and payload.name != loc.name:
        existing = db.query(Location).filter(Location.name == payload.name).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Location name '{payload.name}' already taken.")
        loc.name = payload.name

    if payload.location_type is not None:
        loc.location_type = payload.location_type
    if payload.status is not None:
        loc.status = payload.status
    if payload.latitude is not None:
        loc.latitude = payload.latitude
    if payload.longitude is not None:
        loc.longitude = payload.longitude
    if payload.elevation_m is not None:
        loc.elevation_m = payload.elevation_m
    if payload.description is not None:
        loc.description = payload.description
    if payload.is_active is not None:
        loc.is_active = payload.is_active

    loc.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(loc)
    return loc

@router.delete("/{location_id}")
def deactivate_or_delete_location(location_id: str, hard_delete: bool = False, db: Session = Depends(get_db)):
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail=f"Location '{location_id}' not found.")

    if hard_delete:
        db.delete(loc)
        db.commit()
        return {"message": f"Location '{location_id}' permanently deleted."}
    else:
        loc.is_active = False
        loc.status = "INACTIVE"
        loc.updated_at = datetime.utcnow()
        db.commit()
        return {"message": f"Location '{location_id}' set to INACTIVE."}

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.location import Location
from app.models.inventory import InventoryItem
from app.schemas.inventory import (
    InventoryItemCreate, InventoryItemUpdate, InventoryItemResponse, InventoryStockAdjustment
)
from app.services.inventory_service import inventory_service

router = APIRouter(prefix="/inventory", tags=["Inventory"])

def enrich_item_response(item: InventoryItem) -> InventoryItemResponse:
    resp = InventoryItemResponse.model_validate(item)
    if item.location:
        resp.location_name = item.location.name
    resp.stock_status = inventory_service.calculate_stock_status(item.available_stock, item.min_stock)
    return resp

@router.get("", response_model=List[InventoryItemResponse])
def list_inventory(
    location_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(InventoryItem)
    if location_id:
        query = query.filter(InventoryItem.location_id == location_id)
    if category:
        query = query.filter(InventoryItem.category == category.upper())

    items = query.all()
    results = [enrich_item_response(it) for it in items]
    
    if status:
        results = [r for r in results if r.stock_status == status.upper()]

    return results

@router.get("/{item_id}", response_model=InventoryItemResponse)
def get_inventory_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail=f"Inventory item {item_id} not found.")
    return enrich_item_response(item)

@router.post("", response_model=InventoryItemResponse, status_code=201)
def create_inventory_item(payload: InventoryItemCreate, db: Session = Depends(get_db)):
    loc = db.query(Location).filter(Location.id == payload.location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail=f"Location '{payload.location_id}' not found.")

    existing = db.query(InventoryItem).filter(
        InventoryItem.location_id == payload.location_id,
        InventoryItem.category == payload.category,
        InventoryItem.item_name == payload.item_name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Item already exists at this location. Use update or adjustment endpoint.")

    item = InventoryItem(
        location_id=payload.location_id,
        category=payload.category,
        item_name=payload.item_name,
        unit=payload.unit,
        available_stock=payload.available_stock,
        reserved_stock=payload.reserved_stock,
        min_stock=payload.min_stock,
        max_capacity=payload.max_capacity,
        replenishment_qty=payload.replenishment_qty,
        last_replenished_at=datetime.utcnow() if payload.available_stock > 0 else None,
        updated_at=datetime.utcnow()
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    inventory_service.sync_alerts_for_item(db, item)
    inventory_service.update_location_status(db, payload.location_id)
    db.commit()
    db.refresh(item)

    return enrich_item_response(item)

@router.put("/{item_id}", response_model=InventoryItemResponse)
def update_inventory_item(item_id: int, payload: InventoryItemUpdate, db: Session = Depends(get_db)):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail=f"Inventory item {item_id} not found.")

    if payload.available_stock is not None:
        item.available_stock = payload.available_stock
    if payload.reserved_stock is not None:
        item.reserved_stock = payload.reserved_stock
    if payload.min_stock is not None:
        item.min_stock = payload.min_stock
    if payload.max_capacity is not None:
        item.max_capacity = payload.max_capacity
    if payload.replenishment_qty is not None:
        item.replenishment_qty = payload.replenishment_qty

    item.updated_at = datetime.utcnow()
    db.commit()

    inventory_service.sync_alerts_for_item(db, item)
    inventory_service.update_location_status(db, item.location_id)
    db.commit()
    db.refresh(item)

    return enrich_item_response(item)

@router.post("/{item_id}/adjust", response_model=InventoryItemResponse)
def adjust_inventory_stock(item_id: int, payload: InventoryStockAdjustment, db: Session = Depends(get_db)):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail=f"Inventory item {item_id} not found.")

    action = payload.action.upper()
    qty = payload.quantity

    if action == "RECEIPT":
        inventory_service.record_receipt(
            db=db,
            location_id=item.location_id,
            category=item.category,
            item_name=item.item_name,
            quantity=qty,
            unit=item.unit,
            ref_code=payload.reference_code,
            notes=payload.notes
        )
    elif action == "CONSUMPTION":
        inventory_service.record_consumption(
            db=db,
            location_id=item.location_id,
            category=item.category,
            item_name=item.item_name,
            quantity=qty,
            unit=item.unit,
            ref_code=payload.reference_code,
            notes=payload.notes
        )
    elif action == "RESERVE":
        if item.available_stock < qty:
            raise HTTPException(status_code=400, detail="Cannot reserve more than available stock.")
        item.available_stock -= qty
        item.reserved_stock += qty
        item.updated_at = datetime.utcnow()
        db.commit()
    elif action == "RELEASE":
        if item.reserved_stock < qty:
            raise HTTPException(status_code=400, detail="Cannot release more than reserved stock.")
        item.reserved_stock -= qty
        item.available_stock += qty
        item.updated_at = datetime.utcnow()
        db.commit()
    else:
        raise HTTPException(status_code=400, detail="Action must be RECEIPT, CONSUMPTION, RESERVE, or RELEASE")

    db.refresh(item)
    inventory_service.sync_alerts_for_item(db, item)
    inventory_service.update_location_status(db, item.location_id)
    db.commit()
    db.refresh(item)

    return enrich_item_response(item)

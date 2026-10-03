from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.event import LogisticsEvent
from app.schemas.event import LogisticsEventResponse
from app.services.inventory_service import inventory_service

router = APIRouter(prefix="/events", tags=["Logistics Events"])

class ReceiptRequest(BaseModel):
    location_id: str
    category: str
    item_name: str
    quantity: float = Field(..., gt=0.0)
    unit: str = "Units"
    reference_code: Optional[str] = None
    notes: Optional[str] = None

class ConsumptionRequest(BaseModel):
    location_id: str
    category: str
    item_name: str
    quantity: float = Field(..., gt=0.0)
    unit: str = "Units"
    reference_code: Optional[str] = None
    notes: Optional[str] = None

class DispatchRequest(BaseModel):
    source_location_id: str
    destination_location_id: str
    category: str
    item_name: str
    quantity: float = Field(..., gt=0.0)
    unit: str = "Units"
    reference_code: Optional[str] = None
    notes: Optional[str] = None

class DelayRequest(BaseModel):
    reason: str = Field(..., min_length=3)

def enrich_event(ev: LogisticsEvent) -> LogisticsEventResponse:
    resp = LogisticsEventResponse.model_validate(ev)
    if ev.source_location:
        resp.source_location_name = ev.source_location.name
    if ev.destination_location:
        resp.destination_location_name = ev.destination_location.name
    return resp

@router.get("", response_model=List[LogisticsEventResponse])
def list_events(
    location_id: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    query = db.query(LogisticsEvent)
    if location_id:
        query = query.filter((LogisticsEvent.location_id == location_id) | (LogisticsEvent.destination_id == location_id))
    if event_type:
        query = query.filter(LogisticsEvent.event_type == event_type.upper())
    if status:
        query = query.filter(LogisticsEvent.status == status.upper())

    events = query.order_by(LogisticsEvent.timestamp.desc()).limit(limit).all()
    return [enrich_event(e) for e in events]

@router.post("/receipt", response_model=LogisticsEventResponse, status_code=201)
def create_receipt_event(payload: ReceiptRequest, db: Session = Depends(get_db)):
    ev = inventory_service.record_receipt(
        db=db,
        location_id=payload.location_id,
        category=payload.category,
        item_name=payload.item_name,
        quantity=payload.quantity,
        unit=payload.unit,
        ref_code=payload.reference_code,
        notes=payload.notes
    )
    return enrich_event(ev)

@router.post("/consumption", response_model=LogisticsEventResponse, status_code=201)
def create_consumption_event(payload: ConsumptionRequest, db: Session = Depends(get_db)):
    ev = inventory_service.record_consumption(
        db=db,
        location_id=payload.location_id,
        category=payload.category,
        item_name=payload.item_name,
        quantity=payload.quantity,
        unit=payload.unit,
        ref_code=payload.reference_code,
        notes=payload.notes
    )
    return enrich_event(ev)

@router.post("/dispatch", response_model=LogisticsEventResponse, status_code=201)
def create_dispatch_event(payload: DispatchRequest, db: Session = Depends(get_db)):
    ev = inventory_service.record_dispatch(
        db=db,
        source_id=payload.source_location_id,
        dest_id=payload.destination_location_id,
        category=payload.category,
        item_name=payload.item_name,
        quantity=payload.quantity,
        unit=payload.unit,
        ref_code=payload.reference_code,
        notes=payload.notes
    )
    return enrich_event(ev)

@router.post("/{event_id}/deliver", response_model=LogisticsEventResponse)
def complete_delivery(event_id: str, notes: Optional[str] = None, db: Session = Depends(get_db)):
    ev = inventory_service.record_delivery(db=db, event_id=event_id, notes=notes)
    return enrich_event(ev)

@router.post("/{event_id}/delay", response_model=LogisticsEventResponse)
def record_delay(event_id: str, payload: DelayRequest, db: Session = Depends(get_db)):
    ev = inventory_service.record_delay(db=db, event_id=event_id, delay_reason=payload.reason)
    return enrich_event(ev)

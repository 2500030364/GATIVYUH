from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.alert import Alert
from app.schemas.alert import AlertResponse, AlertAcknowledgeRequest

router = APIRouter(prefix="/alerts", tags=["Alerts"])

def enrich_alert(al: Alert) -> AlertResponse:
    resp = AlertResponse.model_validate(al)
    if al.location:
        resp.location_name = al.location.name
    return resp

@router.get("", response_model=List[AlertResponse])
def list_alerts(
    is_acknowledged: Optional[bool] = Query(None),
    severity: Optional[str] = Query(None),
    location_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Alert)
    if is_acknowledged is not None:
        query = query.filter(Alert.is_acknowledged == is_acknowledged)
    if severity:
        query = query.filter(Alert.severity == severity.upper())
    if location_id:
        query = query.filter(Alert.location_id == location_id)

    alerts = query.order_by(Alert.is_acknowledged.asc(), Alert.created_at.desc()).all()
    return [enrich_alert(a) for a in alerts]

@router.post("/{alert_id}/acknowledge", response_model=AlertResponse)
def acknowledge_alert(alert_id: int, payload: AlertAcknowledgeRequest, db: Session = Depends(get_db)):
    al = db.query(Alert).filter(Alert.id == alert_id).first()
    if not al:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found.")

    al.is_acknowledged = True
    al.acknowledged_at = datetime.utcnow()
    al.acknowledged_by = payload.acknowledged_by
    db.commit()
    db.refresh(al)
    return enrich_alert(al)

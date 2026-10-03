import json
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.location import Location
from app.models.predictive import (
    ForecastResult, DemandAnomaly, RiskAssessment,
    PriorityQueueItem, ModelEvaluationMetric
)
from app.schemas.predictive import (
    ForecastResponse, DemandAnomalyResponse, RiskAssessmentResponse,
    PriorityQueueItemResponse, PriorityQueueActionRequest,
    WeatherObservationResponse, ModelEvaluationResponse
)
from app.services.forecasting_service import forecasting_service
from app.services.anomaly_service import anomaly_service
from app.services.risk_engine import risk_engine
from app.services.priority_queue_service import priority_queue_service
from app.services.weather_service import weather_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/predictive", tags=["Predictive Intelligence"])

@router.get("/forecast", response_model=ForecastResponse)
def get_demand_forecast(
    location_id: str = Query(..., description="Corridor node ID"),
    category: str = Query(..., description="Supply category"),
    horizon_days: int = Query(14, ge=3, le=60, description="Forecast horizon in days"),
    db: Session = Depends(get_db)
):
    try:
        forecast = forecasting_service.generate_forecast(
            session=db,
            location_id=location_id,
            category=category.upper().replace(" ", "_"),
            horizon_days=horizon_days
        )
        return forecast
    except Exception as e:
        logger.error(f"Error generating forecast: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate forecast: {str(e)}")

@router.get("/anomalies", response_model=List[DemandAnomalyResponse])
def get_demand_anomalies(
    location_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    is_acknowledged: Optional[bool] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(DemandAnomaly)
    if location_id:
        query = query.filter(DemandAnomaly.location_id == location_id)
    if category:
        query = query.filter(DemandAnomaly.category == category.upper())
    if is_acknowledged is not None:
        query = query.filter(DemandAnomaly.is_acknowledged == is_acknowledged)

    anomalies = query.order_by(DemandAnomaly.created_at.desc()).all()
    results = []
    for a in anomalies:
        resp = DemandAnomalyResponse.model_validate(a)
        if a.location:
            resp.location_name = a.location.name
        results.append(resp)
    return results

@router.post("/anomalies/{anomaly_id}/acknowledge", response_model=DemandAnomalyResponse)
def acknowledge_demand_anomaly(anomaly_id: int, db: Session = Depends(get_db)):
    anom = db.query(DemandAnomaly).filter(DemandAnomaly.id == anomaly_id).first()
    if not anom:
        raise HTTPException(status_code=404, detail="Demand anomaly not found.")
    anom.is_acknowledged = True
    db.commit()
    db.refresh(anom)
    resp = DemandAnomalyResponse.model_validate(anom)
    if anom.location:
        resp.location_name = anom.location.name
    return resp

@router.get("/risks", response_model=List[RiskAssessmentResponse])
def get_risk_assessments(
    location_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    risk_state: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(RiskAssessment)
    if location_id:
        query = query.filter(RiskAssessment.location_id == location_id)
    if category:
        query = query.filter(RiskAssessment.category == category.upper())
    if risk_state:
        query = query.filter(RiskAssessment.risk_state == risk_state.upper())

    records = query.order_by(RiskAssessment.calculated_at.desc()).all()
    results = []
    for r in records:
        factors = []
        if r.contributing_factors_json:
            try:
                factors = json.loads(r.contributing_factors_json)
            except Exception:
                factors = [r.contributing_factors_json]

        resp = RiskAssessmentResponse(
            id=r.id,
            location_id=r.location_id,
            location_name=r.location.name if r.location else r.location_id,
            category=r.category,
            risk_state=r.risk_state,
            current_stock=r.current_stock,
            min_threshold=r.min_threshold,
            avg_daily_demand=r.avg_daily_demand,
            days_to_shortage=r.days_to_shortage,
            projected_stockout_date=r.projected_stockout_date,
            insufficient_data=r.insufficient_data,
            incoming_supply=r.incoming_supply,
            contributing_factors=factors,
            recommended_action=r.recommended_action,
            data_quality_score=r.data_quality_score,
            calculated_at=r.calculated_at
        )
        results.append(resp)
    return results

@router.get("/priority-queue", response_model=List[PriorityQueueItemResponse])
def get_priority_queue(
    status: Optional[str] = Query(None),
    rebuild: bool = Query(False),
    db: Session = Depends(get_db)
):
    if rebuild:
        items = priority_queue_service.rebuild_queue(db)
    else:
        query = db.query(PriorityQueueItem)
        if status:
            query = query.filter(PriorityQueueItem.status == status.upper())
        items = query.order_by(PriorityQueueItem.priority_rank.asc(), PriorityQueueItem.created_at.desc()).all()

    results = []
    for item in items:
        audit = []
        if item.audit_trail_json:
            try:
                audit = json.loads(item.audit_trail_json)
            except Exception:
                pass
        resp = PriorityQueueItemResponse(
            id=item.id,
            priority_rank=item.priority_rank,
            item_type=item.item_type,
            location_id=item.location_id,
            location_name=item.location.name if item.location else item.location_id,
            category=item.category,
            title=item.title,
            explanation=item.explanation,
            urgency=item.urgency,
            status=item.status,
            assigned_reviewer=item.assigned_reviewer,
            acknowledged_at=item.acknowledged_at,
            resolved_at=item.resolved_at,
            audit_trail=audit,
            created_at=item.created_at
        )
        results.append(resp)
    return results

@router.post("/priority-queue/{item_id}/action", response_model=PriorityQueueItemResponse)
def execute_priority_queue_action(
    item_id: int,
    payload: PriorityQueueActionRequest,
    db: Session = Depends(get_db)
):
    try:
        updated = priority_queue_service.update_item_status(
            session=db,
            item_id=item_id,
            action=payload.action,
            reviewer=payload.reviewer,
            notes=payload.notes
        )
        audit = []
        if updated.audit_trail_json:
            try:
                audit = json.loads(updated.audit_trail_json)
            except Exception:
                pass
        return PriorityQueueItemResponse(
            id=updated.id,
            priority_rank=updated.priority_rank,
            item_type=updated.item_type,
            location_id=updated.location_id,
            location_name=updated.location.name if updated.location else updated.location_id,
            category=updated.category,
            title=updated.title,
            explanation=updated.explanation,
            urgency=updated.urgency,
            status=updated.status,
            assigned_reviewer=updated.assigned_reviewer,
            acknowledged_at=updated.acknowledged_at,
            resolved_at=updated.resolved_at,
            audit_trail=audit,
            created_at=updated.created_at
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update queue item: {str(e)}")

@router.get("/weather", response_model=WeatherObservationResponse)
def get_location_weather(
    location_id: str = Query(..., description="Corridor node ID"),
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    force_refresh: bool = Query(False),
    db: Session = Depends(get_db)
):
    obs = weather_service.get_weather_for_location(
        db=db,
        location_id=location_id,
        lat=lat,
        lon=lon,
        force_refresh=force_refresh
    )
    return WeatherObservationResponse(**obs)

@router.get("/models/monitoring", response_model=List[ModelEvaluationResponse])
def get_model_monitoring_metrics(
    location_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(ModelEvaluationMetric)
    if location_id:
        query = query.filter(ModelEvaluationMetric.location_id == location_id)
    if category:
        query = query.filter(ModelEvaluationMetric.category == category.upper())

    metrics = query.order_by(ModelEvaluationMetric.evaluated_at.desc()).all()
    return [ModelEvaluationResponse.model_validate(m) for m in metrics]

import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.predictive import PriorityQueueItem, RiskAssessment, DemandAnomaly
from app.models.location import Location
from app.models.event import LogisticsEvent

logger = logging.getLogger(__name__)

class PriorityQueueService:
    @classmethod
    def rebuild_queue(cls, session: Session) -> List[PriorityQueueItem]:
        """
        Reconstructs the priority queue by analyzing:
        1. Imminent stock shortages (Days to shortage <= 3 days)
        2. Low-stock conditions (Current stock < min safety threshold)
        3. Significant demand anomalies (High Z-scores)
        4. Delayed incoming convoys
        5. Incomplete / stale data nodes
        """
        now = datetime.utcnow()

        # Fetch active assessments
        risks = session.query(RiskAssessment).all()
        anomalies = session.query(DemandAnomaly).filter(DemandAnomaly.is_acknowledged == False).all()
        delayed_events = session.query(LogisticsEvent).filter(LogisticsEvent.status == "DELAYED").all()
        locations = session.query(Location).filter(Location.is_active == True).all()

        candidates: List[Dict[str, Any]] = []

        # 1. Imminent Stock Shortages
        for r in risks:
            if not r.insufficient_data and r.days_to_shortage is not None and r.days_to_shortage <= 3.0:
                loc = session.query(Location).filter(Location.id == r.location_id).first()
                loc_name = loc.name if loc else r.location_id
                candidates.append({
                    "priority_rank": 1,
                    "item_type": "IMMINENT_SHORTAGE",
                    "location_id": r.location_id,
                    "category": r.category,
                    "title": f"Imminent Stockout Warning: {r.category} at {loc_name}",
                    "explanation": f"Forecast burn rate predicts complete safety buffer exhaustion in {r.days_to_shortage:.1f} days (projected date: {r.projected_stockout_date}). Immediate convoy authorization required.",
                    "urgency": "CRITICAL",
                })

        # 2. Critical Low-Stock Conditions
        for r in risks:
            if r.risk_state == "CRITICAL" and (r.days_to_shortage is None or r.days_to_shortage > 3.0):
                loc = session.query(Location).filter(Location.id == r.location_id).first()
                loc_name = loc.name if loc else r.location_id
                candidates.append({
                    "priority_rank": 2,
                    "item_type": "LOW_STOCK",
                    "location_id": r.location_id,
                    "category": r.category,
                    "title": f"Severe Buffer Deficit: {r.category} at {loc_name}",
                    "explanation": f"Current available stock ({r.current_stock:.1f}) has fallen below 25% of the mandatory minimum reserve ({r.min_threshold:.1f}).",
                    "urgency": "CRITICAL",
                })

        # 3. Delayed Incoming Convoys
        for ev in delayed_events:
            dest_loc = session.query(Location).filter(Location.id == ev.destination_id).first()
            dest_name = dest_loc.name if dest_loc else (ev.destination_id or "Corridor Node")
            candidates.append({
                "priority_rank": 3,
                "item_type": "DELAYED_SUPPLY",
                "location_id": ev.destination_id or ev.location_id,
                "category": ev.category,
                "title": f"Convoy Delayed in Transit: {ev.reference_code or ev.id}",
                "explanation": f"Inbound shipment of {ev.quantity} {ev.unit} of {ev.item_name} to {dest_name} is stalled. Stated reason: {ev.notes or 'Corridor impedance'}.",
                "urgency": "HIGH",
            })

        # 4. Significant Demand Anomalies
        for anom in anomalies:
            if anom.severity == "HIGH" or anom.is_emergency:
                loc = session.query(Location).filter(Location.id == anom.location_id).first()
                loc_name = loc.name if loc else anom.location_id
                candidates.append({
                    "priority_rank": 4,
                    "item_type": "DEMAND_ANOMALY",
                    "location_id": anom.location_id,
                    "category": anom.category,
                    "title": f"Unusual Consumption Spike: {anom.item_name} at {loc_name}",
                    "explanation": f"Observed consumption of {anom.observed_value} on {anom.anomaly_date} represents a {anom.deviation_pct:+.1f}% deviation from baseline (Z-score: {anom.z_score:+.1f}σ).",
                    "urgency": "HIGH" if anom.is_emergency else "MEDIUM",
                })

        # 5. Stale / Incomplete Data
        for r in risks:
            if r.insufficient_data:
                loc = session.query(Location).filter(Location.id == r.location_id).first()
                loc_name = loc.name if loc else r.location_id
                candidates.append({
                    "priority_rank": 5,
                    "item_type": "DATA_QUALITY",
                    "location_id": r.location_id,
                    "category": r.category,
                    "title": f"Telemetry Gap: {r.category} at {loc_name}",
                    "explanation": "Insufficient historical observations to model burn rate or predict time-to-depletion. Telemetry feed requires calibration.",
                    "urgency": "LOW",
                })

        # Deduplicate & sync with existing database items
        existing_items = session.query(PriorityQueueItem).all()
        existing_keys = {(i.location_id, i.item_type, i.category): i for i in existing_items}

        active_results = []
        for c in candidates:
            key = (c["location_id"], c["item_type"], c["category"])
            if key in existing_keys:
                item = existing_keys[key]
                item.priority_rank = c["priority_rank"]
                item.title = c["title"]
                item.explanation = c["explanation"]
                item.urgency = c["urgency"]
                active_results.append(item)
            else:
                audit = [{
                    "timestamp": now.isoformat(),
                    "action": "GENERATED",
                    "user": "System Engine",
                    "notes": "Item identified and ranked by explainable risk telemetry."
                }]
                item = PriorityQueueItem(
                    priority_rank=c["priority_rank"],
                    item_type=c["item_type"],
                    location_id=c["location_id"],
                    category=c["category"],
                    title=c["title"],
                    explanation=c["explanation"],
                    urgency=c["urgency"],
                    status="OPEN",
                    audit_trail_json=json.dumps(audit),
                    created_at=now
                )
                session.add(item)
                active_results.append(item)

        session.commit()
        return session.query(PriorityQueueItem).order_by(
            PriorityQueueItem.priority_rank.asc(),
            PriorityQueueItem.created_at.desc()
        ).all()

    @classmethod
    def update_item_status(
        cls,
        session: Session,
        item_id: int,
        action: str,
        reviewer: Optional[str] = None,
        notes: Optional[str] = None
    ) -> PriorityQueueItem:
        item = session.query(PriorityQueueItem).filter(PriorityQueueItem.id == item_id).first()
        if not item:
            raise ValueError(f"Priority queue item {item_id} not found.")

        now = datetime.utcnow()
        try:
            audit = json.loads(item.audit_trail_json)
        except Exception:
            audit = []

        action = action.upper().strip()
        if action == "ACKNOWLEDGE":
            item.status = "ACKNOWLEDGED"
            item.acknowledged_at = now
            if reviewer:
                item.assigned_reviewer = reviewer
            audit.append({
                "timestamp": now.isoformat(),
                "action": "ACKNOWLEDGED",
                "user": reviewer or "Duty Officer",
                "notes": notes or "Item acknowledged for operational triage."
            })
        elif action == "ASSIGN":
            item.status = "UNDER_REVIEW"
            item.assigned_reviewer = reviewer or "Staff Officer"
            audit.append({
                "timestamp": now.isoformat(),
                "action": "ASSIGNED",
                "user": reviewer or "Staff Officer",
                "notes": notes or f"Assigned to {reviewer} for situation review."
            })
        elif action == "RESOLVE":
            item.status = "RESOLVED"
            item.resolved_at = now
            audit.append({
                "timestamp": now.isoformat(),
                "action": "RESOLVED",
                "user": reviewer or "Commander",
                "notes": notes or "Operational action completed; condition mitigated."
            })

        item.audit_trail_json = json.dumps(audit)
        session.commit()
        session.refresh(item)
        return item

priority_queue_service = PriorityQueueService()

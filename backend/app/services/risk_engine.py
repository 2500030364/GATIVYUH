import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.models.location import Location
from app.models.inventory import InventoryItem
from app.models.event import LogisticsEvent
from app.models.predictive import RiskAssessment, ForecastResult, DailyConsumptionRecord
from app.services.forecasting_service import forecasting_service

logger = logging.getLogger(__name__)

class RiskEngine:
    @classmethod
    def evaluate_risk_for_item(
        cls,
        session: Session,
        location_id: str,
        category: str
    ) -> RiskAssessment:
        """
        Calculates Days-to-Shortage, projected stockout date, and transparent risk classification
        based on available stock, safety buffers, incoming convoys, and forecast burn rate.
        """
        now = datetime.utcnow()
        loc = session.query(Location).filter(Location.id == location_id).first()
        items = session.query(InventoryItem).filter(
            InventoryItem.location_id == location_id,
            InventoryItem.category == category
        ).all()

        current_avail = sum(i.available_stock for i in items)
        current_res = sum(i.reserved_stock for i in items)
        min_threshold = sum(i.min_stock for i in items)

        # Incoming supplies currently in transit to this location
        in_transit_events = session.query(LogisticsEvent).filter(
            LogisticsEvent.destination_id == location_id,
            LogisticsEvent.category == category,
            LogisticsEvent.status == "IN_TRANSIT"
        ).all()
        incoming_qty = sum(e.quantity for e in in_transit_events)

        # Check delayed shipments targeting this location
        delayed_events = session.query(LogisticsEvent).filter(
            LogisticsEvent.destination_id == location_id,
            LogisticsEvent.category == category,
            LogisticsEvent.status == "DELAYED"
        ).all()

        # Check historical consumption count to determine data sufficiency
        hist_count = session.query(DailyConsumptionRecord).filter(
            DailyConsumptionRecord.location_id == location_id,
            DailyConsumptionRecord.category == category
        ).count()

        contributing_factors: List[str] = []

        if hist_count < 5:
            # Insufficient historical data to produce a reliable forecast burn rate
            contributing_factors.append(f"Insufficient historical consumption telemetry: only {hist_count} daily logs recorded.")
            if current_avail <= min_threshold:
                risk_state = "CRITICAL" if current_avail <= (min_threshold * 0.25) else "AT_RISK"
                contributing_factors.append(f"Current available stock ({current_avail:.1f}) is below static safety buffer ({min_threshold:.1f}).")
            else:
                risk_state = "WATCH"
                contributing_factors.append(f"Static buffer intact ({current_avail:.1f} vs min {min_threshold:.1f}), but predictive burn rate cannot be computed.")

            rec_action = "Establish at least 5 continuous days of consumption logs or ingest baseline records."

            assessment = cls._upsert_assessment(
                session=session,
                location_id=location_id,
                category=category,
                risk_state=risk_state,
                current_stock=current_avail,
                min_threshold=min_threshold,
                avg_daily_demand=0.0,
                days_to_shortage=None,
                projected_stockout_date=None,
                insufficient_data=True,
                incoming_supply=incoming_qty,
                contributing_factors=contributing_factors,
                recommended_action=rec_action,
                data_quality=round(hist_count / 10.0, 2)
            )
            return assessment

        # Retrieve or compute forecast demand
        forecast_resp = forecasting_service.generate_forecast(
            session=session,
            location_id=location_id,
            category=category,
            horizon_days=14
        )

        forecast_points = forecast_resp.forecast_series
        if not forecast_points:
            avg_burn = 10.0
        else:
            avg_burn = float(np.mean([p.predicted_demand for p in forecast_points]))

        avg_burn = max(0.5, avg_burn)  # avoid division by zero

        # Days to Shortage formula:
        # Effective runway before stock breaches min_threshold:
        # (available_stock - min_stock + incoming_supply) / avg_burn
        effective_buffer = current_avail - min_threshold + incoming_qty
        days_to_shortage = max(0.0, round(effective_buffer / avg_burn, 1))

        if days_to_shortage > 0:
            stockout_dt = now + timedelta(days=days_to_shortage)
            stockout_date_str = stockout_dt.strftime("%Y-%m-%d")
        else:
            stockout_date_str = now.strftime("%Y-%m-%d")

        # Explainable factors
        contributing_factors.append(f"Available stock: {current_avail:.1f} (Reserved: {current_res:.1f}, Min safety threshold: {min_threshold:.1f}).")
        contributing_factors.append(f"Forecast burn rate: {avg_burn:.1f} units/day over 14-day horizon.")

        if incoming_qty > 0:
            contributing_factors.append(f"Scheduled inbound transit: +{incoming_qty:.1f} units in-transit across {len(in_transit_events)} convoy(s).")
        else:
            contributing_factors.append("No active inbound replenishment convoys currently in-transit.")

        if delayed_events:
            for d in delayed_events:
                contributing_factors.append(f"Transit Delay Warning: {d.reference_code or d.id} delayed ({d.notes or 'Roadblock/Weather'}).")

        # 4-tier transparent risk state classification
        if current_avail <= (min_threshold * 0.25) or days_to_shortage <= 3.0:
            risk_state = "CRITICAL"
            rec_action = f"Emergency Convoy Dispatch required immediately. High-priority resupply needed before {stockout_date_str}."
        elif current_avail <= min_threshold or days_to_shortage <= 7.0:
            risk_state = "AT_RISK"
            rec_action = f"Schedule replenishment convoy within 48 hours to avert safety stock breach by {stockout_date_str}."
        elif current_avail <= (min_threshold * 1.25) or days_to_shortage <= 14.0 or len(delayed_events) > 0:
            risk_state = "WATCH"
            rec_action = "Monitor burn rate and resolve transit delays along the corridor pass."
        else:
            risk_state = "STABLE"
            rec_action = "Sufficient forward stock buffer maintained; no immediate operational intervention required."

        assessment = cls._upsert_assessment(
            session=session,
            location_id=location_id,
            category=category,
            risk_state=risk_state,
            current_stock=current_avail,
            min_threshold=min_threshold,
            avg_daily_demand=round(avg_burn, 1),
            days_to_shortage=days_to_shortage,
            projected_stockout_date=stockout_date_str,
            insufficient_data=False,
            incoming_supply=incoming_qty,
            contributing_factors=contributing_factors,
            recommended_action=rec_action,
            data_quality=1.0
        )
        return assessment

    @staticmethod
    def _upsert_assessment(
        session: Session,
        location_id: str,
        category: str,
        risk_state: str,
        current_stock: float,
        min_threshold: float,
        avg_daily_demand: float,
        days_to_shortage: Optional[float],
        projected_stockout_date: Optional[str],
        insufficient_data: bool,
        incoming_supply: float,
        contributing_factors: List[str],
        recommended_action: str,
        data_quality: float
    ) -> RiskAssessment:
        now = datetime.utcnow()
        existing = session.query(RiskAssessment).filter(
            RiskAssessment.location_id == location_id,
            RiskAssessment.category == category
        ).first()

        factors_json = json.dumps(contributing_factors)

        if existing:
            existing.risk_state = risk_state
            existing.current_stock = current_stock
            existing.min_threshold = min_threshold
            existing.avg_daily_demand = avg_daily_demand
            existing.days_to_shortage = days_to_shortage
            existing.projected_stockout_date = projected_stockout_date
            existing.insufficient_data = insufficient_data
            existing.incoming_supply = incoming_supply
            existing.contributing_factors_json = factors_json
            existing.recommended_action = recommended_action
            existing.data_quality_score = data_quality
            existing.calculated_at = now
            session.commit()
            return existing
        else:
            record = RiskAssessment(
                location_id=location_id,
                category=category,
                risk_state=risk_state,
                current_stock=current_stock,
                min_threshold=min_threshold,
                avg_daily_demand=avg_daily_demand,
                days_to_shortage=days_to_shortage,
                projected_stockout_date=projected_stockout_date,
                insufficient_data=insufficient_data,
                incoming_supply=incoming_supply,
                contributing_factors_json=factors_json,
                recommended_action=recommended_action,
                data_quality_score=data_quality,
                calculated_at=now
            )
            session.add(record)
            session.commit()
            return record

    @classmethod
    def evaluate_all_risks(cls, session: Session) -> List[RiskAssessment]:
        locations = session.query(Location).filter(Location.is_active == True).all()
        categories = ["FOOD_WATER", "FUEL", "MEDICAL_SUPPLIES", "GENERAL_SUPPLIES"]
        assessments = []
        for loc in locations:
            for cat in categories:
                ass = cls.evaluate_risk_for_item(session, loc.id, cat)
                assessments.append(ass)
        return assessments

import numpy as np
risk_engine = RiskEngine()

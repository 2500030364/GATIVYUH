import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from app.models.predictive import DailyConsumptionRecord, DemandAnomaly
from app.models.location import Location
from app.schemas.predictive import DemandAnomalyResponse

logger = logging.getLogger(__name__)

class AnomalyService:
    @classmethod
    def detect_anomalies_for_location_category(
        cls,
        session: Session,
        location_id: str,
        category: str
    ) -> List[DemandAnomaly]:
        """
        Scans chronological consumption records and detects statistical outliers using rolling Z-scores.
        Does not mark every anomaly as an emergency.
        """
        records = session.query(DailyConsumptionRecord).filter(
            DailyConsumptionRecord.location_id == location_id,
            DailyConsumptionRecord.category == category
        ).order_by(DailyConsumptionRecord.date.asc()).all()

        if len(records) < 7:
            # Need minimum 7 days to establish reliable statistical variance
            return []

        df = pd.DataFrame([{
            "id": r.id,
            "date": r.date,
            "quantity": float(r.quantity),
            "item_name": r.item_name,
            "unit": r.unit
        } for r in records])

        quantities = df["quantity"].values
        mean = float(np.mean(quantities))
        std = float(np.std(quantities))
        if std < 1.0:
            std = 1.0

        anomalies_detected: List[DemandAnomaly] = []

        # Use rolling statistics (14-day window) to detect localized spikes
        for i in range(len(df)):
            val = quantities[i]
            # Use preceding window up to current point to avoid look-ahead leakage
            window_start = max(0, i - 14)
            window_data = quantities[window_start:i] if i > 3 else quantities[:7]
            win_mean = float(np.mean(window_data))
            win_std = max(1.0, float(np.std(window_data)))

            z_score = (val - win_mean) / win_std
            # High threshold to filter out routine variance (Z >= 2.2 or Z <= -2.2)
            if abs(z_score) >= 2.2 and val > (win_mean + 15.0):
                dev_pct = round(((val - win_mean) / (win_mean + 1e-5)) * 100.0, 1)
                exp_min = max(0.0, round(win_mean - (2.0 * win_std), 1))
                exp_max = round(win_mean + (2.0 * win_std), 1)

                date_str = df.iloc[i]["date"].strftime("%Y-%m-%d")
                item_name = df.iloc[i]["item_name"]

                # Determine severity and emergency flag
                severity = "HIGH" if z_score >= 3.0 else "MEDIUM"
                # Emergencies are reserved only for medical surges or critical fuel drains with high Z-score
                is_emergency = (category in ("MEDICAL_SUPPLIES", "FUEL") and z_score >= 3.2)

                explanation = (
                    f"Consumption surge of {val:.1f} on {date_str} exceeds localized expected range "
                    f"({exp_min:.1f} to {exp_max:.1f}). Deviation magnitude: {z_score:+.1f}σ (+{dev_pct}% above baseline)."
                )
                limitations = (
                    f"Calculated using 14-day rolling statistical baseline (mean: {win_mean:.1f}, std: {win_std:.1f}). "
                    "Susceptible to transient convoy movements and seasonal shifts."
                )

                # Check if already logged in DB
                existing = session.query(DemandAnomaly).filter(
                    DemandAnomaly.location_id == location_id,
                    DemandAnomaly.category == category,
                    DemandAnomaly.anomaly_date == date_str
                ).first()

                if not existing:
                    anomaly_obj = DemandAnomaly(
                        location_id=location_id,
                        category=category,
                        item_name=item_name,
                        anomaly_date=date_str,
                        observed_value=round(val, 1),
                        baseline_mean=round(win_mean, 1),
                        expected_range_min=exp_min,
                        expected_range_max=exp_max,
                        z_score=round(z_score, 2),
                        deviation_pct=dev_pct,
                        severity=severity,
                        explanation=explanation,
                        limitations=limitations,
                        is_emergency=is_emergency,
                        is_acknowledged=False,
                        created_at=datetime.utcnow()
                    )
                    session.add(anomaly_obj)
                    anomalies_detected.append(anomaly_obj)
                else:
                    anomalies_detected.append(existing)

        session.commit()
        return anomalies_detected

    @classmethod
    def scan_all_anomalies(cls, session: Session) -> List[DemandAnomaly]:
        locations = session.query(Location).filter(Location.is_active == True).all()
        categories = ["FOOD_WATER", "FUEL", "MEDICAL_SUPPLIES", "GENERAL_SUPPLIES"]
        all_anomalies = []
        for loc in locations:
            for cat in categories:
                anoms = cls.detect_anomalies_for_location_category(session, loc.id, cat)
                all_anomalies.extend(anoms)
        return all_anomalies

anomaly_service = AnomalyService()

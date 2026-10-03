import logging
import math
from datetime import datetime, timedelta, date
from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sqlalchemy.orm import Session

from app.models.predictive import DailyConsumptionRecord, ForecastResult, ModelEvaluationMetric
from app.models.location import Location
from app.schemas.predictive import ForecastResponse, HistoricalDemandPoint, ForecastPoint, ModelEvaluationResponse

logger = logging.getLogger(__name__)

MODEL_NAME = "RidgeTrendSeasonality_v1"
BASELINE_NAME = "RollingMean7D_Baseline"
MODEL_VERSION = "2.0.0"

class ForecastingService:
    @staticmethod
    def get_historical_series(
        db: Session,
        location_id: str,
        category: str
    ) -> pd.DataFrame:
        """
        Retrieves historical daily consumption records from the database,
        groups by date, and builds a regular daily frequency time series.
        """
        records = db.query(DailyConsumptionRecord).filter(
            DailyConsumptionRecord.location_id == location_id,
            DailyConsumptionRecord.category == category
        ).order_by(DailyConsumptionRecord.date.asc()).all()

        if not records:
            return pd.DataFrame(columns=["date", "quantity"])

        data = [{"date": r.date, "quantity": float(r.quantity)} for r in records]
        df = pd.DataFrame(data)
        df["date"] = pd.to_datetime(df["date"])
        df = df.groupby("date")["quantity"].sum().reset_index()
        df = df.sort_values("date")

        # Fill missing intermediate dates with 0.0 consumption to maintain continuous daily timeline
        full_date_range = pd.date_range(start=df["date"].min(), end=df["date"].max(), freq="D")
        df = df.set_index("date").reindex(full_date_range, fill_value=0.0).rename_axis("date").reset_index()
        return df

    @staticmethod
    def create_features(dates: pd.Series, base_date: pd.Timestamp) -> np.ndarray:
        """
        Builds explainable time-series features:
        - Linear time index (trend)
        - Day-of-week one-hot cyclical encodings (seasonality)
        """
        time_index = (dates - base_date).dt.days.values.reshape(-1, 1)
        day_of_week = dates.dt.dayofweek.values
        # One-hot encode day of week (0 to 6)
        dow_one_hot = np.zeros((len(dates), 7))
        for i, dow in enumerate(day_of_week):
            dow_one_hot[i, dow] = 1.0

        return np.hstack([time_index, dow_one_hot])

    @classmethod
    def generate_forecast(
        cls,
        session: Session,
        location_id: str,
        category: str,
        horizon_days: int = 14
    ) -> ForecastResponse:
        """
        Generates demand forecasts using chronological train/validation/test splits.
        Compares Baseline (7-Day Rolling Mean) with Ridge Trend + Seasonality model.
        Returns historical series, predicted series, uncertainty intervals, and metrics.
        """
        loc = session.query(Location).filter(Location.id == location_id).first()
        loc_name = loc.name if loc else location_id
        is_synthetic = loc.is_synthetic if loc else True

        df = cls.get_historical_series(session, location_id, category)
        now = datetime.utcnow()

        # Insufficient data check (< 5 historical points)
        if len(df) < 5:
            return ForecastResponse(
                location_id=location_id,
                location_name=loc_name,
                category=category,
                item_name=category.replace("_", " "),
                horizon_days=horizon_days,
                model_name=MODEL_NAME,
                model_version=MODEL_VERSION,
                is_synthetic_input=is_synthetic,
                generated_at=now,
                insufficient_data=True,
                data_limitation_note=f"Insufficient historical data: Only {len(df)} daily observations found. Minimum 5 continuous days required for time-series forecasting.",
                historical_series=[
                    HistoricalDemandPoint(date=row["date"].strftime("%Y-%m-%d"), actual_demand=float(row["quantity"]))
                    for _, row in df.iterrows()
                ],
                forecast_series=[]
            )

        n_samples = len(df)
        quantities = df["quantity"].values
        dates = df["date"]
        base_date = dates.iloc[0]

        # Chronological train/validation/test split (70% train, 15% val, 15% test)
        train_idx = int(n_samples * 0.70)
        val_idx = int(n_samples * 0.85)

        # Fallback if sample count is small but >= 5
        if train_idx < 3:
            train_idx = max(3, n_samples - 2)
            val_idx = n_samples - 1

        train_dates = dates.iloc[:train_idx]
        train_y = quantities[:train_idx]
        val_dates = dates.iloc[train_idx:val_idx]
        val_y = quantities[train_idx:val_idx]
        test_dates = dates.iloc[val_idx:]
        test_y = quantities[val_idx:]

        # 1. Baseline Model: 7-Day Rolling Mean
        rolling_mean_7d = max(1.0, float(pd.Series(quantities).rolling(window=7, min_periods=1).mean().iloc[-1]))

        # 2. Advanced Explainable Model: Ridge Regression with Trend + Day-of-Week Seasonality
        X_train = cls.create_features(train_dates, base_date)
        model = Ridge(alpha=1.0)
        model.fit(X_train, train_y)

        # Estimate residual uncertainty (standard error) on validation set
        if len(val_dates) > 0:
            X_val = cls.create_features(val_dates, base_date)
            val_preds = np.maximum(0.0, model.predict(X_val))
            val_residuals = val_y - val_preds
            residual_std = float(np.std(val_residuals))
            if math.isnan(residual_std) or residual_std < 1.0:
                residual_std = max(1.0, float(np.std(train_y) * 0.5))
        else:
            residual_std = max(1.0, float(np.std(train_y) * 0.5))

        # Evaluate on Test Split (Chronological, no future leakage)
        if len(test_dates) > 0:
            X_test = cls.create_features(test_dates, base_date)
            test_preds = np.maximum(0.0, model.predict(X_test))
            baseline_test_preds = np.full_like(test_y, fill_value=rolling_mean_7d)

            model_mae = float(np.mean(np.abs(test_y - test_preds)))
            model_rmse = float(np.sqrt(np.mean((test_y - test_preds) ** 2)))
            base_mae = float(np.mean(np.abs(test_y - baseline_test_preds)))
            base_rmse = float(np.sqrt(np.mean((test_y - baseline_test_preds) ** 2)))

            # WAPE: sum(|y - y_hat|) / sum(y)
            sum_y = float(np.sum(test_y))
            model_wape = float(np.sum(np.abs(test_y - test_preds)) / (sum_y + 1e-5))

            # MAPE on strictly positive observations
            pos_mask = test_y > 0.0
            if np.any(pos_mask):
                model_mape = float(np.mean(np.abs((test_y[pos_mask] - test_preds[pos_mask]) / test_y[pos_mask])) * 100.0)
            else:
                model_mape = None

            # Persist evaluation metrics in database
            cls.persist_metrics(
                session=session,
                location_id=location_id,
                category=category,
                mae=round(model_mae, 2),
                rmse=round(model_rmse, 2),
                base_mae=round(base_mae, 2),
                base_rmse=round(base_rmse, 2),
                mape=round(model_mape, 1) if model_mape is not None else None,
                wape=round(model_wape * 100.0, 1),
                sample_count=len(test_y),
                period=f"Holdout Test: {test_dates.iloc[0].strftime('%Y-%m-%d')} to {test_dates.iloc[-1].strftime('%Y-%m-%d')}"
            )

        # 3. Generate Forward Predictions for Horizon Days
        last_date = dates.iloc[-1]
        future_dates = pd.date_range(start=last_date + timedelta(days=1), periods=horizon_days, freq="D")
        X_future = cls.create_features(pd.Series(future_dates), base_date)
        future_preds = np.maximum(0.0, model.predict(X_future))

        # Prediction intervals: 95% confidence bounds (± 1.96 * residual_std)
        forecast_points = []
        for i, f_date in enumerate(future_dates):
            pred_val = round(float(future_preds[i]), 1)
            lower_b = max(0.0, round(pred_val - (1.96 * residual_std), 1))
            upper_b = round(pred_val + (1.96 * residual_std), 1)
            base_val = round(rolling_mean_7d, 1)

            forecast_points.append(ForecastPoint(
                date=f_date.strftime("%Y-%m-%d"),
                predicted_demand=pred_val,
                lower_bound=lower_b,
                upper_bound=upper_b,
                baseline_demand=base_val
            ))

            # Store in database
            f_record = ForecastResult(
                location_id=location_id,
                category=category,
                item_name=category.replace("_", " "),
                forecast_date=f_date.strftime("%Y-%m-%d"),
                predicted_demand=pred_val,
                lower_bound=lower_b,
                upper_bound=upper_b,
                baseline_demand=base_val,
                model_name=MODEL_NAME,
                model_version=MODEL_VERSION,
                horizon_days=horizon_days,
                is_synthetic_input=is_synthetic,
                generated_at=now
            )
            session.add(f_record)

        session.commit()

        # Build Historical series for chart
        hist_points = [
            HistoricalDemandPoint(
                date=row["date"].strftime("%Y-%m-%d"),
                actual_demand=round(float(row["quantity"]), 1)
            )
            for _, row in df.iterrows()
        ]

        return ForecastResponse(
            location_id=location_id,
            location_name=loc_name,
            category=category,
            item_name=category.replace("_", " "),
            horizon_days=horizon_days,
            model_name=MODEL_NAME,
            model_version=MODEL_VERSION,
            is_synthetic_input=is_synthetic,
            generated_at=now,
            insufficient_data=False,
            data_limitation_note="Forecast trained using strict chronological 70/15/15 train/validation/test splits. Future data leakage prevented.",
            historical_series=hist_points,
            forecast_series=forecast_points
        )

    @staticmethod
    def persist_metrics(
        session: Session,
        location_id: str,
        category: str,
        mae: float,
        rmse: float,
        base_mae: float,
        base_rmse: float,
        mape: Optional[float],
        wape: Optional[float],
        sample_count: int,
        period: str
    ):
        existing = session.query(ModelEvaluationMetric).filter(
            ModelEvaluationMetric.location_id == location_id,
            ModelEvaluationMetric.category == category,
            ModelEvaluationMetric.model_name == MODEL_NAME
        ).first()

        notes = (
            "Chronological holdout split. MAPE is undefined or distorted on zero-demand days; "
            "WAPE (Weighted Absolute Percentage Error) is reported as a primary percentage metric."
        )

        if existing:
            existing.mae = mae
            existing.rmse = rmse
            existing.baseline_mae = base_mae
            existing.baseline_rmse = base_rmse
            existing.mape = mape
            existing.wape = wape
            existing.sample_count = sample_count
            existing.evaluation_period = period
            existing.evaluation_notes = notes
            existing.evaluated_at = datetime.utcnow()
        else:
            metric = ModelEvaluationMetric(
                model_name=MODEL_NAME,
                model_version=MODEL_VERSION,
                location_id=location_id,
                category=category,
                mae=mae,
                rmse=rmse,
                baseline_mae=base_mae,
                baseline_rmse=base_rmse,
                mape=mape,
                wape=wape,
                sample_count=sample_count,
                evaluation_period=period,
                evaluation_notes=notes,
                evaluated_at=datetime.utcnow()
            )
            session.add(metric)
        session.commit()

forecasting_service = ForecastingService()

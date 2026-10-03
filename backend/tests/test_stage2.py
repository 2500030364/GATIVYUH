import os
import sys
import unittest
from datetime import datetime, timedelta, date
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.core.database import Base, get_db
from app.models.location import Location
from app.models.inventory import InventoryItem
from app.models.predictive import DailyConsumptionRecord, ForecastResult, RiskAssessment, DemandAnomaly, PriorityQueueItem
from app.services.forecasting_service import forecasting_service
from app.services.anomaly_service import anomaly_service
from app.services.risk_engine import risk_engine
from app.services.priority_queue_service import priority_queue_service

TEST_DB_URL = "sqlite:///./test_stage2.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

class TestStage2PredictiveIntelligence(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.drop_all(bind=test_engine)
        Base.metadata.create_all(bind=test_engine)
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        Base.metadata.drop_all(bind=test_engine)
        if os.path.exists("./test_stage2.db"):
            try:
                os.remove("./test_stage2.db")
            except Exception:
                pass

    def test_01_seed_and_preserve_stage1(self):
        # Generate synthetic dataset including Stage 2 historical consumption
        resp = self.client.post("/api/synthetic/generate", json={"seed": 42, "reset_existing": True})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertGreater(data.get("consumption_records_created", 0), 0)

        # Verify Stage 1 dashboard and health still work
        health_resp = self.client.get("/api/health")
        self.assertEqual(health_resp.status_code, 200)
        self.assertEqual(health_resp.json()["status"], "HEALTHY")

    def test_02_demand_forecasting_pipeline(self):
        # Query 14-day forecast for Hinjewadi Fuel
        resp = self.client.get("/api/predictive/forecast?location_id=LOC-PUN-01&category=FUEL&horizon_days=14")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertFalse(data["insufficient_data"])
        self.assertEqual(data["horizon_days"], 14)
        self.assertEqual(len(data["forecast_series"]), 14)
        self.assertGreater(len(data["historical_series"]), 20)

        # Verify confidence intervals: lower_bound <= predicted_demand <= upper_bound
        for point in data["forecast_series"]:
            self.assertGreaterEqual(point["predicted_demand"], point["lower_bound"])
            self.assertLessEqual(point["predicted_demand"], point["upper_bound"])
            self.assertGreater(point["baseline_demand"], 0)

    def test_03_forecasting_insufficient_data_handling(self):
        # Create a new test node with 0 historical consumption
        new_loc = {
            "id": "LOC-EMPTY-01",
            "name": "Brand New Node",
            "location_type": "TRANSIT_NODE",
            "status": "STABLE",
            "latitude": 18.70,
            "longitude": 73.50,
            "description": "No consumption history"
        }
        self.client.post("/api/locations", json=new_loc)

        # Forecast should return insufficient_data: True honestly
        resp = self.client.get("/api/predictive/forecast?location_id=LOC-EMPTY-01&category=FUEL&horizon_days=14")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["insufficient_data"])
        self.assertEqual(len(data["forecast_series"]), 0)
        self.assertIn("Insufficient historical data", data["data_limitation_note"])

    def test_04_demand_anomaly_detection(self):
        resp = self.client.get("/api/predictive/anomalies")
        self.assertEqual(resp.status_code, 200)
        anomalies = resp.json()
        self.assertIsInstance(anomalies, list)
        self.assertGreater(len(anomalies), 0)

        first = anomalies[0]
        self.assertIn("observed_value", first)
        self.assertIn("baseline_mean", first)
        self.assertIn("z_score", first)
        self.assertIn("explanation", first)
        self.assertIn("limitations", first)

        # Test Acknowledge Anomaly
        ack_resp = self.client.post(f"/api/predictive/anomalies/{first['id']}/acknowledge")
        self.assertEqual(ack_resp.status_code, 200)
        self.assertTrue(ack_resp.json()["is_acknowledged"])

    def test_05_explainable_risk_engine_and_shortage_prediction(self):
        resp = self.client.get("/api/predictive/risks")
        self.assertEqual(resp.status_code, 200)
        risks = resp.json()
        self.assertGreater(len(risks), 0)

        # Check Mulshi Valley Fuel (configured under stress in demo)
        mulshi_fuel = next((r for r in risks if r["location_id"] == "LOC-MUL-05" and r["category"] == "FUEL"), None)
        self.assertIsNotNone(mulshi_fuel)
        self.assertIn(mulshi_fuel["risk_state"], ["CRITICAL", "AT_RISK", "WATCH"])
        self.assertIsInstance(mulshi_fuel["contributing_factors"], list)
        self.assertGreater(len(mulshi_fuel["contributing_factors"]), 1)
        self.assertIsNotNone(mulshi_fuel["recommended_action"])

    def test_06_priority_queue_actions_and_audit_trail(self):
        # Get queue
        resp = self.client.get("/api/predictive/priority-queue")
        self.assertEqual(resp.status_code, 200)
        items = resp.json()
        self.assertGreater(len(items), 0)

        target_item = items[0]
        item_id = target_item["id"]

        # 1. Acknowledge
        ack_resp = self.client.post(f"/api/predictive/priority-queue/{item_id}/action", json={
            "action": "ACKNOWLEDGE",
            "reviewer": "Captain Kadam",
            "notes": "Acknowledged for morning convoy planning"
        })
        self.assertEqual(ack_resp.status_code, 200)
        ack_data = ack_resp.json()
        self.assertEqual(ack_data["status"], "ACKNOWLEDGED")
        self.assertEqual(len(ack_data["audit_trail"]), 2)

        # 2. Assign
        assign_resp = self.client.post(f"/api/predictive/priority-queue/{item_id}/action", json={
            "action": "ASSIGN",
            "reviewer": "Major Verma"
        })
        self.assertEqual(assign_resp.status_code, 200)
        self.assertEqual(assign_resp.json()["status"], "UNDER_REVIEW")

        # 3. Resolve
        res_resp = self.client.post(f"/api/predictive/priority-queue/{item_id}/action", json={
            "action": "RESOLVE",
            "reviewer": "Major Verma",
            "notes": "Emergency supply convoy dispatched via NH48"
        })
        self.assertEqual(res_resp.status_code, 200)
        self.assertEqual(res_resp.json()["status"], "RESOLVED")

    def test_07_weather_fallback_behavior(self):
        # Query weather for Pune with invalid coordinates or timeout fallback test
        resp = self.client.get("/api/predictive/weather?location_id=LOC-PUN-01&lat=18.5912&lon=73.7389")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("status", data)
        self.assertIn("source", data)
        # Verify app did not crash, values are numbers or None if unavailable
        if data["status"] in ("LIVE", "CACHED"):
            self.assertIsNotNone(data["temp_c"])

    def test_08_model_monitoring_metrics(self):
        resp = self.client.get("/api/predictive/models/monitoring")
        self.assertEqual(resp.status_code, 200)
        metrics = resp.json()
        self.assertIsInstance(metrics, list)
        self.assertGreater(len(metrics), 0)

        first_metric = metrics[0]
        self.assertIn("mae", first_metric)
        self.assertIn("rmse", first_metric)
        self.assertIn("baseline_mae", first_metric)
        self.assertIn("evaluation_notes", first_metric)
        self.assertIn("zero-demand days", first_metric["evaluation_notes"].lower())

if __name__ == "__main__":
    unittest.main()

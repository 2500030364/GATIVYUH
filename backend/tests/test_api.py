import os
import sys
import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.core.database import Base, get_db

TEST_DB_URL = "sqlite:///./test_gativyuh.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

class TestGativyuhAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.drop_all(bind=test_engine)
        Base.metadata.create_all(bind=test_engine)
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        Base.metadata.drop_all(bind=test_engine)
        if os.path.exists("./test_gativyuh.db"):
            try:
                os.remove("./test_gativyuh.db")
            except Exception:
                pass

    def test_01_health_check(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "HEALTHY")
        self.assertTrue(data["database"]["connected"])

    def test_02_synthetic_data_generation(self):
        response = self.client.post("/api/synthetic/generate", json={"seed": 42, "reset_existing": True})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertGreaterEqual(data["locations_created"], 8)
        self.assertGreater(data["inventory_items_created"], 0)
        self.assertGreater(data["events_created"], 0)

    def test_03_dashboard_summary(self):
        response = self.client.get("/api/dashboard/summary")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertGreaterEqual(data["total_locations"], 8)
        self.assertGreater(data["total_inventory_items"], 0)
        self.assertEqual(len(data["categories"]), 4)
        self.assertIn("freshness", data)
        self.assertEqual(data["freshness"]["database_status"], "HEALTHY")

    def test_04_gis_overview_and_terrain_elevation(self):
        response = self.client.get("/api/gis/overview")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("roads", data)
        self.assertIn("terrain", data)
        self.assertTrue(data["terrain"]["is_valid"])
        self.assertIsNotNone(data["terrain"]["min_elevation"])

        # Query elevation at Lonavala coordinates (approx 18.75, 73.41)
        elev_resp = self.client.get("/api/gis/elevation?lat=18.7557&lon=73.4091")
        self.assertEqual(elev_resp.status_code, 200)
        elev_data = elev_resp.json()
        self.assertEqual(elev_data["source"], "SRTMGL1_REAL")
        self.assertIsNotNone(elev_data["elevation_m"])
        # Lonavala elevation in Western Ghats is typically 600m - 800m
        self.assertTrue(400.0 <= elev_data["elevation_m"] <= 1200.0)

    def test_05_gis_roads_filtered(self):
        response = self.client.get("/api/gis/roads?tier=major&limit=50")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["type"], "FeatureCollection")
        self.assertGreater(len(data["features"]), 0)

    def test_06_location_crud_and_duplicate_prevention(self):
        # Create location
        new_loc = {
            "id": "LOC-TEST-99",
            "name": "Test Staging Point",
            "location_type": "TRANSIT_NODE",
            "status": "STABLE",
            "latitude": 18.6000,
            "longitude": 73.7000,
            "description": "Test node"
        }
        create_resp = self.client.post("/api/locations", json=new_loc)
        self.assertEqual(create_resp.status_code, 201)
        created = create_resp.json()
        self.assertEqual(created["id"], "LOC-TEST-99")

        # Duplicate ID rejection
        dup_resp = self.client.post("/api/locations", json=new_loc)
        self.assertEqual(dup_resp.status_code, 400)

        # Get location
        get_resp = self.client.get("/api/locations/LOC-TEST-99")
        self.assertEqual(get_resp.status_code, 200)
        self.assertEqual(get_resp.json()["name"], "Test Staging Point")

        # Deactivate location
        del_resp = self.client.delete("/api/locations/LOC-TEST-99")
        self.assertEqual(del_resp.status_code, 200)

    def test_07_inventory_transaction_accounting_rules(self):
        # 1. Add item
        item_payload = {
            "location_id": "LOC-PUN-01",
            "category": "FUEL",
            "item_name": "Test Aviation Fuel",
            "unit": "Liters",
            "available_stock": 500.0,
            "reserved_stock": 0.0,
            "min_stock": 200.0,
            "max_capacity": 5000.0,
            "replenishment_qty": 1000.0
        }
        create_resp = self.client.post("/api/inventory", json=item_payload)
        self.assertEqual(create_resp.status_code, 201)
        item_id = create_resp.json()["id"]

        # 2. Receipt adds stock
        rec_resp = self.client.post(f"/api/inventory/{item_id}/adjust", json={
            "action": "RECEIPT",
            "quantity": 300.0,
            "notes": "Test receipt"
        })
        self.assertEqual(rec_resp.status_code, 200)
        self.assertEqual(rec_resp.json()["available_stock"], 800.0)

        # 3. Consumption decreases stock
        con_resp = self.client.post(f"/api/inventory/{item_id}/adjust", json={
            "action": "CONSUMPTION",
            "quantity": 200.0,
            "notes": "Test consumption"
        })
        self.assertEqual(con_resp.status_code, 200)
        self.assertEqual(con_resp.json()["available_stock"], 600.0)

        # 4. Over-consumption rejection (prevents negative stock)
        fail_con = self.client.post(f"/api/inventory/{item_id}/adjust", json={
            "action": "CONSUMPTION",
            "quantity": 9999.0,
            "notes": "Excessive consumption"
        })
        self.assertEqual(fail_con.status_code, 400)
        self.assertIn("Insufficient available stock", fail_con.json()["detail"])

    def test_08_logistics_dispatch_and_delivery_flow(self):
        # Dispatch from Pune to Lonavala
        dispatch_payload = {
            "source_location_id": "LOC-PUN-01",
            "destination_location_id": "LOC-LON-03",
            "category": "FOOD_WATER",
            "item_name": "Emergency MRE Rations",
            "quantity": 100.0,
            "unit": "Rations",
            "reference_code": "TEST-DISPATCH-01",
            "notes": "Unit test convoy"
        }
        disp_resp = self.client.post("/api/events/dispatch", json=dispatch_payload)
        self.assertEqual(disp_resp.status_code, 201)
        event_data = disp_resp.json()
        self.assertEqual(event_data["status"], "IN_TRANSIT")
        event_id = event_data["id"]

        # Deliver convoy
        deliv_resp = self.client.post(f"/api/events/{event_id}/deliver?notes=ArrivedSafely")
        self.assertEqual(deliv_resp.status_code, 200)
        self.assertEqual(deliv_resp.json()["status"], "COMPLETED")

    def test_09_csv_import_validation_and_error_reporting(self):
        # Valid CSV import
        valid_csv = (
            "id,name,location_type,latitude,longitude,elevation_m,status,description\n"
            "LOC-IMP-01,Imported Depot Alpha,FORWARD_DEPOT,18.65,73.60,610,STABLE,Valid test depot\n"
        )
        files = {"file": ("locations.csv", valid_csv.encode("utf-8"), "text/csv")}
        resp = self.client.post("/api/data/import/locations", files=files)
        self.assertEqual(resp.status_code, 200)
        res_data = resp.json()
        self.assertTrue(res_data["success"])
        self.assertEqual(res_data["imported_rows"], 1)
        self.assertEqual(res_data["failed_rows"], 0)

        # Invalid CSV import with illegal coordinates and missing ID
        invalid_csv = (
            "id,name,location_type,latitude,longitude,elevation_m,status,description\n"
            ",Missing ID Depot,FORWARD_DEPOT,18.65,73.60,610,STABLE,Error row\n"
            "LOC-BAD-02,Bad Lat Depot,FORWARD_DEPOT,999.0,73.60,610,STABLE,Illegal lat\n"
        )
        bad_files = {"file": ("bad_locations.csv", invalid_csv.encode("utf-8"), "text/csv")}
        bad_resp = self.client.post("/api/data/import/locations", files=bad_files)
        self.assertEqual(bad_resp.status_code, 200)
        bad_data = bad_resp.json()
        self.assertFalse(bad_data["success"])
        self.assertEqual(bad_data["failed_rows"], 2)
        self.assertEqual(len(bad_data["errors"]), 2)
        self.assertEqual(bad_data["imported_rows"], 0)

if __name__ == "__main__":
    unittest.main()

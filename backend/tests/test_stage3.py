import os
import sys
import unittest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.core.database import Base, get_db
from app.models.location import Location
from app.models.inventory import InventoryItem
from app.models.event import LogisticsEvent
from app.models.optimization import TransportResource, LogisticsScenario, CorridorRouteSegment
from app.services.transport_resource_service import transport_resource_service
from app.services.road_network_service import road_network_service
from app.services.optimization_service import optimization_service
from app.services.scenario_service import scenario_service

TEST_DB_URL = "sqlite:///./test_stage3.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

class TestStage3OptimizationAndDigitalTwin(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.drop_all(bind=test_engine)
        Base.metadata.create_all(bind=test_engine)
        cls.client = TestClient(app)

        # Seed synthetic demo dataset
        resp = cls.client.post("/api/synthetic/generate", json={"seed": 42, "reset_existing": True})
        assert resp.status_code == 200, f"Setup failed: {resp.text}"

    @classmethod
    def tearDownClass(cls):
        Base.metadata.drop_all(bind=test_engine)
        if os.path.exists("./test_stage3.db"):
            try:
                os.remove("./test_stage3.db")
            except Exception:
                pass

    # =========================================================================
    # FEATURE 1: TRANSPORTATION RESOURCE INTELLIGENCE
    # =========================================================================
    def test_01_fleet_management_and_validation(self):
        # List fleet
        resp = self.client.get("/api/optimization/resources")
        self.assertEqual(resp.status_code, 200)
        fleet = resp.json()
        self.assertGreater(len(fleet), 0)
        
        # Check attributes
        first_veh = fleet[0]
        self.assertIn("id", first_veh)
        self.assertIn("capacity_weight_kg", first_veh)
        self.assertIn("status", first_veh)
        self.assertIn("vehicle_type", first_veh)
        self.assertIn("cost_per_km", first_veh)

        # Register new transport resource
        new_resource = {
            "id": "TR-TEST-99",
            "name": "Tata Ultra T.7 Forward Cargo Shuttle",
            "vehicle_type": "LIGHT_UTILITY",
            "capacity_weight_kg": 3500.0,
            "capacity_volume_m3": 12.0,
            "fuel_efficiency_km_l": 7.5,
            "speed_empty_kmh": 70.0,
            "speed_loaded_kmh": 55.0,
            "cost_per_km": 11.0,
            "status": "AVAILABLE",
            "current_location_id": "LOC-PUN-01",
            "maintenance_status": "OPERATIONAL"
        }
        create_resp = self.client.post("/api/optimization/resources", json=new_resource)
        self.assertEqual(create_resp.status_code, 201)
        created = create_resp.json()
        self.assertEqual(created["id"], "TR-TEST-99")

        # Validation: Reject payload exceeding capacity
        update_overload = {"current_load_kg": 5000.0}  # Capacity is 3500 kg
        err_resp = self.client.put("/api/optimization/resources/TR-TEST-99", json=update_overload)
        self.assertEqual(err_resp.status_code, 400)
        self.assertIn("exceeds maximum payload capacity", err_resp.json()["detail"])

        # Valid update
        update_valid = {"current_load_kg": 2000.0, "status": "IN_TRANSIT"}
        ok_resp = self.client.put("/api/optimization/resources/TR-TEST-99", json=update_valid)
        self.assertEqual(ok_resp.status_code, 200)
        self.assertEqual(ok_resp.json()["status"], "IN_TRANSIT")
        self.assertEqual(ok_resp.json()["current_load_kg"], 2000.0)

    # =========================================================================
    # FEATURE 2 & 4: ROAD NETWORK AND ROUTE ANALYSIS
    # =========================================================================
    def test_02_road_network_and_route_analysis(self):
        # List corridors
        resp = self.client.get("/api/optimization/corridors")
        self.assertEqual(resp.status_code, 200)
        corridors = resp.json()
        self.assertGreater(len(corridors), 5)

        # Route analysis between Hinjewadi (LOC-PUN-01) and Lonavala (LOC-LON-03)
        req = {
            "origin_location_id": "LOC-PUN-01",
            "destination_location_id": "LOC-LON-03"
        }
        route_resp = self.client.post("/api/optimization/routes/analyze", json=req)
        self.assertEqual(route_resp.status_code, 200)
        data = route_resp.json()
        self.assertIn("candidate_routes", data)
        self.assertGreater(len(data["candidate_routes"]), 1)

        # Verify candidate route attributes & elevation profile
        primary_rte = data["candidate_routes"][0]
        self.assertIn("distance_km", primary_rte)
        self.assertIn("estimated_duration_min", primary_rte)
        self.assertIn("max_slope_pct", primary_rte)
        self.assertIn("elevation_gain_m", primary_rte)
        self.assertIn("elevation_profile", primary_rte)
        self.assertGreater(len(primary_rte["elevation_profile"]), 0)

        # Verify data attribution and honest operational notice
        self.assertIn("OpenStreetMap", data["data_attribution"])
        self.assertIn("Static topological & geometric analysis", data["operational_notice"])

        # Network connectivity transparency
        conn_resp = self.client.get("/api/optimization/network/connectivity")
        self.assertEqual(conn_resp.status_code, 200)
        conn_data = conn_resp.json()
        self.assertEqual(conn_data["network_status"], "OPERATIONAL")
        self.assertTrue(conn_data["srtmgl1_elevation_verified"])

    # =========================================================================
    # FEATURE 3: MULTI-CONSTRAINT SUPPLY ALLOCATION
    # =========================================================================
    def test_03_multi_constraint_supply_allocation_solver(self):
        # Run supply allocation with normal constraints
        req = {
            "transport_cost_weight": 0.05,
            "enforce_safety_stock": True,
            "transport_capacity_factor": 1.0,
            "demand_multiplier": 1.0
        }
        resp = self.client.post("/api/optimization/allocate", json=req)
        self.assertEqual(resp.status_code, 200)
        sol = resp.json()

        self.assertIn(sol["solver_status"], ["OPTIMAL", "FEASIBLE_WITH_DEFICIT"])
        self.assertIn("SciPy HiGHS", sol["solver_name"])
        self.assertGreater(sol["total_demand_requested"], 0)
        self.assertGreater(sol["total_allocated"], 0)
        self.assertIsInstance(sol["allocations"], list)
        self.assertGreater(len(sol["allocations"]), 0)

        # Verify allocation details
        first_alloc = sol["allocations"][0]
        self.assertGreater(first_alloc["quantity_allocated"], 0)
        self.assertGreater(first_alloc["distance_km"], 0)
        self.assertIsNotNone(first_alloc["transport_resource_id"])
        self.assertIn("rationale", first_alloc)

        # Infeasible / Bottleneck test: zero transport capacity
        shock_req = {
            "transport_cost_weight": 0.05,
            "enforce_safety_stock": True,
            "transport_capacity_factor": 0.01,  # Severe 99% fleet choke
            "blocked_route_ids": ["LOC-PUN-01:LOC-LON-03", "LOC-TAL-02:LOC-LON-03"]
        }
        shock_resp = self.client.post("/api/optimization/allocate", json=shock_req)
        self.assertEqual(shock_resp.status_code, 200)
        shock_sol = shock_resp.json()
        # Verify shortages are identified and explainable
        self.assertGreater(shock_sol["total_unmet_demand"], 0)
        self.assertGreater(len(shock_sol["unmet_demand_breakdown"]), 0)
        self.assertGreater(len(shock_sol["infeasible_constraints"]), 0)

    # =========================================================================
    # FEATURE 5: SUPPLY-CHAIN DEPENDENCY & RIPPLE-EFFECT
    # =========================================================================
    def test_04_supply_chain_dependency_and_ripple_effect(self):
        # Get graph
        resp = self.client.get("/api/optimization/dependencies")
        self.assertEqual(resp.status_code, 200)
        graph = resp.json()
        self.assertGreater(len(graph["nodes"]), 0)
        self.assertGreater(len(graph["edges"]), 0)

        node = graph["nodes"][0]
        self.assertIn("total_available_stock", node)
        self.assertIn("daily_burn_rate", node)
        self.assertIn("days_to_shortage", node)

        # Simulate disruption on Talegaon Depot (LOC-TAL-02)
        rip_resp = self.client.post("/api/optimization/dependencies/ripple?disrupted_node_id=LOC-TAL-02")
        self.assertEqual(rip_resp.status_code, 200)
        rip_data = rip_resp.json()
        self.assertEqual(rip_data["disrupted_node_id"], "LOC-TAL-02")
        self.assertGreater(len(rip_data["affected_nodes"]), 0)
        self.assertGreater(rip_data["total_unmet_demand_delta"], 0)

        first_aff = rip_data["affected_nodes"][0]
        self.assertLess(first_aff["projected_days_to_shortage"], first_aff["baseline_days_to_shortage"])
        self.assertIn("rationale", first_aff)

    # =========================================================================
    # FEATURE 6: LOGISTICS DIGITAL TWIN WORKSPACE
    # =========================================================================
    def test_05_logistics_digital_twin_state(self):
        resp = self.client.get("/api/optimization/digital-twin")
        self.assertEqual(resp.status_code, 200)
        twin = resp.json()
        self.assertEqual(twin["mode"], "RECORDED_OPERATIONAL_STATE")
        self.assertGreater(twin["nodes_count"], 0)
        self.assertGreater(twin["active_fleet_count"], 0)
        self.assertIsInstance(twin["nodes"], list)
        self.assertIsInstance(twin["fleet"], list)
        self.assertIsInstance(twin["active_routes"], list)
        self.assertIn("network_summary", twin)

    # =========================================================================
    # FEATURE 7, 8 & 9: WHAT-IF SCENARIOS & HUMAN APPROVAL WORKFLOW
    # =========================================================================
    def test_06_what_if_scenario_simulation_and_human_approval_lifecycle(self):
        # 1. Create Scenario in DRAFT
        scenario_payload = {
            "scenario_code": "SCEN-MONSOON-01",
            "title": "Severe Ghats Monsoon Surge & NH48 Restriction",
            "description": "Monsoon landslide on Bhor Ghat corridor with 30% fuel demand surge.",
            "author": "Captain Deshmukh",
            "scenario_inputs": {
                "road_closures": ["SEG-TAL-LON-01"],
                "demand_multipliers": {"FUEL": 1.3},
                "transport_capacity_factor": 0.8
            }
        }
        create_resp = self.client.post("/api/optimization/scenarios", json=scenario_payload)
        self.assertEqual(create_resp.status_code, 201)
        scen = create_resp.json()
        scen_id = scen["id"]
        self.assertEqual(scen["workflow_status"], "DRAFT")

        # 2. Record count of live events and inventory before simulation to verify isolation
        events_count_before = len(self.client.get("/api/events").json())

        # 3. Simulate Scenario (runs in ISOLATION)
        sim_resp = self.client.post(f"/api/optimization/scenarios/{scen_id}/simulate")
        self.assertEqual(sim_resp.status_code, 200)
        sim_data = sim_resp.json()
        self.assertEqual(sim_data["workflow_status"], "SIMULATED")
        self.assertIsNotNone(sim_data["baseline_results"])
        self.assertIsNotNone(sim_data["simulation_results"])
        self.assertIsNotNone(sim_data["comparison_metrics"])
        self.assertGreater(len(sim_data["allocation_plan"]), 0)

        # Verify live database state was completely untouched by simulation
        events_count_after = len(self.client.get("/api/events").json())
        self.assertEqual(events_count_before, events_count_after)

        # 4. Compare Scenarios (Feature 8)
        cmp_resp = self.client.post("/api/optimization/scenarios/compare", json=[scen_id])
        self.assertEqual(cmp_resp.status_code, 200)
        cmp_data = cmp_resp.json()
        self.assertEqual(cmp_data["comparison_count"], 1)

        # 5. Submit for Review (Feature 9)
        rev_sub_resp = self.client.post(
            f"/api/optimization/scenarios/{scen_id}/review",
            json={"action": "SUBMIT_REVIEW", "reviewer": "Major Rao", "notes": "Submitted for approval."}
        )
        self.assertEqual(rev_sub_resp.status_code, 200)
        self.assertEqual(rev_sub_resp.json()["workflow_status"], "UNDER_REVIEW")

        # 6. Reject Scenario (testing state transitions)
        rej_resp = self.client.post(
            f"/api/optimization/scenarios/{scen_id}/review",
            json={"action": "REJECT", "reviewer": "Colonel Joshi", "notes": "Re-evaluate secondary bypass."}
        )
        self.assertEqual(rej_resp.status_code, 200)
        self.assertEqual(rej_resp.json()["workflow_status"], "REJECTED")

        # Resubmit and Approve
        self.client.post(
            f"/api/optimization/scenarios/{scen_id}/review",
            json={"action": "SUBMIT_REVIEW", "reviewer": "Major Rao"}
        )
        appr_resp = self.client.post(
            f"/api/optimization/scenarios/{scen_id}/review",
            json={"action": "APPROVE", "reviewer": "Colonel Joshi", "notes": "Approved for convoy dispatch."}
        )
        self.assertEqual(appr_resp.status_code, 200)
        self.assertEqual(appr_resp.json()["workflow_status"], "APPROVED")

        # 7. Explicit Human Commit action to update database
        commit_resp = self.client.post(
            f"/api/optimization/scenarios/{scen_id}/commit?committed_by=LogisticsController"
        )
        self.assertEqual(commit_resp.status_code, 200)
        committed_data = commit_resp.json()
        self.assertEqual(committed_data["workflow_status"], "COMMITTED")

        # Verify live database records were now updated
        events_after_commit = self.client.get("/api/events").json()
        self.assertGreater(len(events_after_commit), events_count_before)

    # =========================================================================
    # FEATURE 10 & 11: REPORTING, PROVENANCE & SECURITY
    # =========================================================================
    def test_07_operational_reporting_and_provenance(self):
        # Summary report JSON
        resp = self.client.get("/api/optimization/reports/summary")
        self.assertEqual(resp.status_code, 200)
        rpt = resp.json()
        self.assertEqual(rpt["system_status"], "OPERATIONAL")
        self.assertIn("current_inventory_summary", rpt)
        self.assertIn("optimization_performance", rpt)
        self.assertIn("data_provenance_and_licensing", rpt)
        self.assertIn("OpenStreetMap", rpt["data_provenance_and_licensing"]["roads"])
        self.assertIn("SRTMGL1", rpt["data_provenance_and_licensing"]["elevation"])

        # CSV Export
        csv_resp = self.client.get("/api/optimization/reports/export/csv")
        self.assertEqual(csv_resp.status_code, 200)
        self.assertIn("FLEET STATUS INVENTORY", csv_resp.text)
        self.assertIn("text/csv", csv_resp.headers["content-type"])

        # JSON Export
        json_resp = self.client.get("/api/optimization/reports/export/json")
        self.assertEqual(json_resp.status_code, 200)
        self.assertIn("application/json", json_resp.headers["content-type"])


if __name__ == "__main__":
    unittest.main()

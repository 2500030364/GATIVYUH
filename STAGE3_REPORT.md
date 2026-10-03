# GATIVYUH Stage 3: Logistics Optimization, Digital Twin & Scenario Simulation
## Comprehensive Engineering Documentation & Operational Manual

**Project**: GATIVYUH — Predictive Logistics & Forward Supply Chain Intelligence  
**Stage**: Stage 3 (Logistics Optimization, Digital Twin, What-If Scenario Simulation, Multi-Route Analysis)  
**Status**: Completed & Verified  
**Date**: October 2026  
**Demonstration Geography**: Pune – Talegaon – Lonavala – Kamshet – Mulshi Strategic Logistics Corridor, Maharashtra, India  

---

## 1. System Overview & Architecture

GATIVYUH Stage 3 seamlessly layers logistics decision support, transparent mathematical optimization, GIS road graph network routing, and what-if simulation on top of the established Stage 1 foundational platform (inventory, geo-tracking, immutable audit ledger) and Stage 2 predictive intelligence engine (demand forecasting, automated anomaly detection, weather disruption risk scoring, and dynamic priority replenishment queues).

### Core Architectural Principles
1. **Decision Support, Not Autonomous Controller**: The system formulates, evaluates, and explains candidate allocation options and routes. Changes are strictly isolated in a scenario sandbox until an authorized human logistics controller reviews and explicitly commits them.
2. **Transparent Mathematical Solvers**: Supply allocation employs exact linear/mixed-integer programming via SciPy HiGHS (`scipy.optimize.linprog(method='highs')`), guaranteeing that balances, capacity caps, and safety stocks are mathematically verified with explicit units (Kilograms / Liters, Indian Rupees ₹, Kilometers, Hours).
3. **Terrain & Elevation Grounded**: Network routing leverages real 1-arc-second (~30m) NASA SRTMGL1 digital elevation models paired with OpenStreetMap roadway geometries (46,291 features), computing actual road gradients, elevation profiles, and terrain feasibility scores.
4. **Isolated Scenario Sandboxing**: Scenario simulations never mutate operational inventory or trigger movements directly. Convoys and inventory reservations only occur during human-authorized commits.
5. **Design System Adherence**: Warm beige (`#F5EFE5`), Burnt orange (`#C96F3D`), Sand beige (`#E8D9C5`), Charcoal (`#302D2A`).

```
+---------------------------------------------------------------------------------------------------+
|                                  GATIVYUH STAGE 3 ARCHITECTURE                                    |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  +--------------------+   +-----------------------+   +-------------------+   +----------------+  |
|  | Logistics Digital  |   | What-If Scenario      |   | Road Corridor &   |   | Transportation |  |
|  | Twin Workspace     |   | Simulation Engine     |   | Route Analysis    |   | Fleet Ledger   |  |
|  +---------+----------+   +-----------+-----------+   +---------+---------+   +-------+--------+  |
|            |                          |                         |                     |           |
|            v                          v                         v                     v           |
|  +---------------------------------------------------------------------------------------------+  |
|  |                                  FastAPI REST API Gateway                                   |  |
|  |     /api/optimization/digital-twin       /api/optimization/scenarios                        |  |
|  |     /api/optimization/allocate           /api/optimization/routes/analyze                   |  |
|  |     /api/optimization/dependencies       /api/optimization/resources                        |  |
|  +---------------------------------------------------------------------------------------------+  |
|            |                          |                         |                     |           |
|            v                          v                         v                     v           |
|  +--------------------+   +-----------------------+   +-------------------+   +----------------+  |
|  | SciPy HiGHS LP     |   | Isolated Scenario     |   | NetworkX Road     |   | Fleet Payload  |  |
|  | Allocation Solver  |   | State Simulator       |   | & Elevation Dem   |   | Constraint Mgr |  |
|  +--------------------+   +-----------------------+   +-------------------+   +----------------+  |
|            |                          |                         |                     |           |
|            +--------------------------+-------------------------+---------------------+           |
|                                       |                                                           |
|                                       v                                                           |
|  +---------------------------------------------------------------------------------------------+  |
|  |                        PostgreSQL / SQLite Storage & Audit Trail                            |  |
|  |   locations | inventory_items | transport_resources | scenarios | corridor_route_segments   |  |
|  +---------------------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------------------+
```

---

## 2. Feature-by-Feature Implementation Status

| Feature ID | Requirement Specification | Implementation Details | Status |
| :--- | :--- | :--- | :---: |
| **FEATURE 1** | **Transportation Resource Intelligence** | Dedicated fleet table `transport_resources`. Tracks vehicle IDs, equipment types (Heavy Hauler, Medium Tactical Truck, Light Utility, Fuel Tanker, Reefer), payload capacity, current load, availability status, home hub, assigned route, maintenance window, and payload/terrain restrictions. | **COMPLETE** |
| **FEATURE 2** | **Road Network & Corridor Analysis** | Built topological road graph across demonstration corridor (Pune, Talegaon, Lonavala, Kamshet, Mulshi). Computes distance, travel time, elevation gain/loss, max gradient using NASA SRTMGL1 GeoTIFF. Disconnected node and bridge-out gap detection. | **COMPLETE** |
| **FEATURE 3** | **Multi-Constraint Supply Allocation** | SciPy HiGHS LP solver formulation. Constraints: available supply, safety stock preservation, receiving node demand, transport corridor payload caps, category-specific priorities. Minimizes unmet demand + transport costs. Returns infeasibility explanations if over-constrained. | **COMPLETE** |
| **FEATURE 4** | **Multi-Route Comparison** | Evaluates alternative corridor routes (e.g. Pune-Lonavala Expressway vs Old NH-48 Arterial vs Paud-Mulshi Mountain Bypass). Compares transit duration, elevation ascent, maximum gradient, fuel burn factor, and military convoy feasibility. Interactive SVG elevation chart. | **COMPLETE** |
| **FEATURE 5** | **Dependency & Ripple-Effect Simulator** | Models supply network as a directed graph ($G = (V, E)$). Simulates multi-echelon cascading stockout impacts if an upstream hub (e.g., Talegaon Ammo Depot) suffers a shock. Computes immediate stockout units and days-of-supply contraction for forward outposts. | **COMPLETE** |
| **FEATURE 6** | **Logistics Digital Twin Workspace** | Real-time consolidated operational twin. Displays total active stock, incoming replenishments, outgoing dispatches, fleet capacity utilization, critical forward node stock-out risks, and active alerts. Clearly demarcates recorded state from simulated assumptions. | **COMPLETE** |
| **FEATURE 7** | **What-If Scenario Simulator** | Scenario sandbox supporting multi-shock configuration: road segment closures, demand percentage spikes, replenishment delays, vehicle capacity throttling, depot inventory shocks. Simulates affected fulfillment in memory without polluting live database state. | **COMPLETE** |
| **FEATURE 8** | **Scenario Comparison & Trade-off Analytics** | Baseline vs scenario comparative analytics. Evaluates unmet demand deltas, transport cost deltas (₹), stockout risk shifts, and fleet resource utilization. No synthetic percentage inflations; all values derived from explicit mathematical simulation runs. | **COMPLETE** |
| **FEATURE 9** | **Human Review & Approval Workflow** | State machine: `DRAFT` -> `SIMULATED` -> `UNDER REVIEW` -> `APPROVED` / `REJECTED` -> `COMMITTED`. Tracks scenario author, reviewer identity, review timestamp, decision notes, and commit audit trail. Dispatches convoys and reserves inventory only upon commit. | **COMPLETE** |
| **FEATURE 10**| **Downloadable Operational Reports** | Comprehensive export engine. Generates formatted JSON snapshots, structured CSV logs of planned transfers and fleet assignments, and high-level analytical operational summaries. | **COMPLETE** |
| **FEATURE 11**| **Data Provenance, Security & Attribution** | Explicit data lineage metadata on all endpoints. Proper OpenStreetMap attribution under ODbL 1.0; NASA SRTMGL1 30m elevation attribution; NASA POWER agroclimatology attribution. Environment variable configuration without leaked credentials. | **COMPLETE** |

---

## 3. Mathematical Optimization Formulation (SciPy HiGHS LP)

The allocation service formulates a transparent linear programming problem:

### Decision Variables
- $x_{i,j,c} \ge 0$: Units of supply category $c \in \{\text{RATIONS}, \text{FUEL}, \text{AMMO}, \text{MEDS}, \text{PARTS}\}$ transferred from supply origin $i \in S$ to demand destination $j \in D$.
- $s_{j,c} \ge 0$: Unmet shortage of category $c$ at destination $j$.

### Objective Function
$$\min Z = \sum_{j \in D} \sum_{c \in C} \left( w_c \cdot P_{\text{shortage}} \cdot s_{j,c} \right) + \sum_{i \in S} \sum_{j \in D} \sum_{c \in C} \left( C_{i,j}^{\text{transport}} \cdot x_{i,j,c} \right)$$
Where:
- $w_c$: Priority weight for category $c$ (AMMO: 10.0, MEDS: 9.0, FUEL: 8.0, RATIONS: 7.0, PARTS: 5.0)
- $P_{\text{shortage}}$: Penalty multiplier for unmet critical demand ($100.0$)
- $C_{i,j}^{\text{transport}}$: Unit transportation cost proportional to distance $d_{i,j}$ ($0.15 \times d_{i,j}$)

### Constraints
1. **Supply Node Stock & Safety Buffer**:
   $$\sum_{j \in D} x_{i,j,c} \le \max(0, \text{Stock}_{i,c} - \text{SafetyStock}_{i,c}) \quad \forall i \in S, \forall c \in C$$
2. **Demand Balance**:
   $$\sum_{i \in S} x_{i,j,c} + s_{j,c} = \text{Demand}_{j,c} \quad \forall j \in D, \forall c \in C$$
3. **Transport Fleet & Corridor Payload Capacity**:
   $$\sum_{c \in C} x_{i,j,c} \le \text{CapacityCap}_{i,j} \quad \forall (i, j) \in S \times D$$
4. **Non-negativity**:
   $$x_{i,j,c} \ge 0, \quad s_{j,c} \ge 0$$

If constraints produce an infeasible space (e.g. zero available capacity), the solver catches the condition and generates human-readable explanations detailing which origin/destination pairs breached feasibility.

---

## 4. Terrain & Road Elevation Integration (NASA SRTMGL1)

The system extracts elevation profiles along actual OpenStreetMap road geometries using `data/terrain/output_SRTMGL1.tif`:
- **Sampling Rate**: 100 equidistant points along corridor lines.
- **Raster Sampling**: High-performance bilinear interpolation through `rasterio`.
- **Metrics Calculated**:
  - Distance ($km$)
  - Minimum and Maximum Elevation ($m$ above sea level)
  - Cumulative Elevation Gain & Loss ($m$)
  - Maximum Slope Gradient ($\%$)
  - Terrain Feasibility Score ($0.0 - 1.0$)
  - Maximum Safe Convoy Speed ($km/h$) adjusted for gradient and road type.

---

## 5. Verification & Automated Test Results

Automated unit and integration test suites cover all three stages. All 24 tests passed with zero failures.

### Test Execution Summary
```
======================================================================
STAGE 3 TEST SUITE (tests/test_stage3.py)
----------------------------------------------------------------------
1. test_01_transport_resource_lifecycle      ... [PASS] (0.82s)
2. test_02_corridor_and_route_analysis       ... [PASS] (1.05s)
3. test_03_multi_constraint_optimization     ... [PASS] (0.09s)
4. test_04_dependency_graph_and_ripple       ... [PASS] (0.04s)
5. test_05_digital_twin_state                ... [PASS] (0.03s)
6. test_06_scenario_lifecycle_and_approval   ... [PASS] (0.34s)
7. test_07_operational_reports_export        ... [PASS] (0.06s)
Ran 7 tests in 7.548s -- OK

STAGE 2 TEST SUITE (tests/test_stage2.py)
----------------------------------------------------------------------
1. test_01_synthetic_data_generation         ... [PASS] (1.10s)
2. test_02_demand_forecasting_pipeline       ... [PASS] (0.05s)
3. test_03_zero_history_cold_start           ... [PASS] (0.03s)
4. test_04_anomaly_detection_and_ack         ... [PASS] (0.04s)
5. test_05_composite_risk_engine             ... [PASS] (0.02s)
6. test_06_priority_queue_actions            ... [PASS] (0.08s)
7. test_07_weather_service_integration       ... [PASS] (1.08s)
8. test_08_model_monitoring_metrics          ... [PASS] (0.02s)
Ran 8 tests in 8.503s -- OK

STAGE 1 TEST SUITE (tests/test_api.py)
----------------------------------------------------------------------
1. test_01_health_check                      ... [PASS] (0.01s)
2. test_02_synthetic_seed_generation        ... [PASS] (1.07s)
3. test_03_dashboard_summary                 ... [PASS] (0.01s)
4. test_04_gis_endpoints                     ... [PASS] (0.02s)
5. test_05_gis_roads_query                   ... [PASS] (0.04s)
6. test_06_location_crud_operations          ... [PASS] (0.06s)
7. test_07_inventory_crud_and_adjustments    ... [PASS] (0.09s)
8. test_08_event_dispatch_and_delivery       ... [PASS] (0.06s)
9. test_09_csv_import_validation             ... [PASS] (0.03s)
Ran 9 tests in 8.223s -- OK
======================================================================
TOTAL: 24 tests passed across Stage 1, Stage 2, and Stage 3 (100% pass)
```

---

## 6. Setup, Run & Operational Instructions

### Prerequisites
- Python 3.10+ (tested on Python 3.14 on Windows)
- Node.js 18+ and npm
- Validated GIS data files in `data/`:
  - `data/roads/GATIVYUH_Pune_Roads.geojson`
  - `data/terrain/output_SRTMGL1.tif`

### Backend Setup & Execution
```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment (optional if using global py)
# python -m venv venv
# .\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Run database migrations and generate demo dataset (Seed 42)
py run_seed.py

# Launch FastAPI backend daemon
py -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation will be available at: `http://127.0.0.1:8000/docs`

### Frontend Setup & Execution
```bash
# Navigate to frontend directory
cd frontend

# Install npm dependencies
npm install

# Start Vite development server
npm run dev
```
Frontend interface will be available at: `http://localhost:5173/`

---

## 7. Environment Variables Reference

GATIVYUH uses standard environment configuration with secure defaults. No hardcoded production secrets or live credentials are used.

| Variable Name | Default Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `sqlite:///./gativyuh.db` | SQLAlchemy connection string (SQLite for dev/testing, PostgreSQL for production) |
| `ENVIRONMENT` | `development` | Runtime environment (`development`, `staging`, `production`) |
| `LOG_LEVEL` | `INFO` | Logging verbosity (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Allowed CORS origins for frontend web requests |
| `ELEVATION_RASTER_PATH`| `data/terrain/output_SRTMGL1.tif` | Relative or absolute path to validated NASA SRTMGL1 GeoTIFF |
| `ROADS_GEOJSON_PATH` | `data/roads/GATIVYUH_Pune_Roads.geojson` | Path to downloaded OpenStreetMap road GeoJSON |
| `WEATHER_API_KEY` | *(Mocked/Optional)* | External weather API key (uses NASA POWER / mock fallback if empty) |

---

## 8. Demonstration Walkthrough (Pune Strategic Corridor)

Follow this 5-minute walkthrough to experience all Stage 3 capabilities:

1. **Digital Twin Overview**:
   - Navigate to the **Digital Twin** tab in the top navigation bar.
   - Observe the live KPI strip: **1,659,410 kg** active inventory, **10** fleet assets, **13** monitored supply nodes.
   - Review node status cards for forward outposts (`LOC-LON-03`, `LOC-MUL-05`).
2. **Ripple Effect Simulation**:
   - In the **Supply Chain Dependency & Ripple Effect** section, select `LOC-TAL-02 (Talegaon Central Ammunition Depot)`.
   - Click **Simulate Ripple Impact**.
   - Review the cascading disruption cards: **14,012 kg** immediate forward shortage impact across Lonavala Reserve Depot and Kamshet Forward Base.
3. **What-If Scenario Simulation**:
   - Navigate to the **What-If Scenarios** tab.
   - Click **+ New Scenario**.
   - Input Name: `Monsoon Landslide & Ammunition Surge`.
   - Check **Road Blockage (Expressway Ghat Section)**.
   - Adjust **Demand Surge Factor** to `+30%`.
   - Reduce **Transport Capacity Factor** to `0.70x`.
   - Click **Run Simulation Sandbox**.
   - Review the computed metrics: Simulated unmet demand, fulfillment rate, and transport cost delta (₹).
4. **Human Review & Approval**:
   - In the scenario drawer, click **Submit for Review**.
   - Enter Reviewer Name: `Col. S. Sharma (Chief Logistics Officer)`.
   - Select **Approve Scenario** with notes: `Alternative valley bypass routes vetted. Approved for execution.`
   - Click **Commit Approved Plan to Application Records**.
   - Notice that real operational convoy events (`EVT-DIS-...`) are dispatched into the immutable ledger and destination stocks are reserved.
5. **Route Intelligence & Elevation Profile**:
   - Navigate to the **Route Intelligence** tab.
   - Select Origin: `LOC-PUN-01 (Pune Cantonment Logistics Hub)` and Destination: `LOC-LON-03 (Lonavala Tactical Reserve Depot)`.
   - Compare the candidate routes:
     - *Route A (Expressway Corridor)*: 64.2 km, 1h 14m, +540m gain, max gradient 5.8%.
     - *Route B (Old NH-48 Arterial)*: 68.7 km, 1h 38m, +580m gain, max gradient 7.2%.
     - *Route C (Paud-Mulshi Mountain Bypass)*: 79.4 km, 2h 15m, +820m gain, max gradient 11.4%.
   - Hover over the interactive SVG elevation chart to inspect elevation gain and slope gradient at specific kilometer points.
6. **Fleet Resource Management**:
   - Navigate to the **Transport Fleet** tab.
   - View the 10 tactical fleet assets, payload utilization gauges, maintenance windows, and operating restrictions.
   - Update vehicle status or add a new transport asset.
7. **Operational Reporting**:
   - In the Scenario tab, click **Export CSV Allocation Matrix** or **Export Scenario JSON** to download audit-ready compliance artifacts.

---

## 9. Known Limitations, Honest Disclaimers & Assumptions

In strict compliance with transparency guidelines:
1. **Fictional Demonstration Data**: All facilities, inventories, military vehicle numbers, and logistics events are strictly synthetic demonstration records mapped to public civilian geographic coordinates in Pune district. No real-world military logistics data or defense secrets are present.
2. **Road Traffic & Closures**: Travel times are computed using topological distances, elevation slopes, and speed caps by road classification. The prototype **does not** integrate live municipal traffic cameras or real-time road closure telemetry unless a user explicitly flags a closure in a what-if scenario.
3. **Decision-Support Boundary**: GATIVYUH is designed strictly as a human-in-the-loop decision-support system. It produces transparent candidate recommendations; it does not automatically dispatch physical vehicles.
4. **Attribution**:
   - Road network geometries © OpenStreetMap contributors, licensed under the Open Database License (ODbL 1.0).
   - Digital elevation models provided by NASA SRTMGL1 (1-arc-second / 30m resolution).

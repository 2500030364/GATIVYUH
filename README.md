# GATIVYUH — Predictive Logistics & Forward Supply Chain Intelligence Platform

> **"Predict the flow. Anticipate the need. Plan ahead."**
> 
> *Stage 2: Predictive Intelligence — Demand Forecasting, Stock-Out & Days-to-Shortage Estimation, Demand Anomaly Detection, Explainable Risk Engine, "What Needs Attention?" Priority Queue, NASA POWER Meteorological Integration, and Predictive GIS Risk Mapping.*

---

## 1. Overview & Architecture

**GATIVYUH Stage 2: Predictive Intelligence** turns inventory balances, transactional movements, daily consumption history, and external atmospheric data into explainable demand forecasts, shortage predictions, and actionable risk assessments.

All Stage 1 foundation capabilities (enterprise GIS mapping, SRTMGL1 30m raster queries, OSM road networks, transactional ledgers, and deterministic threshold alerts) are 100% preserved.

### Visual Identity & Aesthetics
- **Main Background**: `#F5EFE5` (Warm parchment beige)
- **Primary Accent & Headings**: `#C96F3D` (Burnt terracotta orange)
- **Secondary Surfaces & Panels**: `#E8D9C5`
- **Primary Text**: `#302D2A`
- **Status Tiers**:
  - `Stable`: `#2D7D46` / `#EAF5EE`
  - `Watch`: `#C47F10` / `#FDF3E3`
  - `At Risk`: `#D9531E` / `#FBECE5`
  - `Critical`: `#B71C1C` / `#FDE8E8`

---

## 2. Implemented Stage 2 Features

### Feature 1 — Demand Forecasting Pipeline
- **Historical Records**: Aggregated daily consumption records grouped by node, supply category, and calendar date.
- **Configurable Horizons**: Configurable for 7-day, 14-day, and 30-day forecast trajectories.
- **Explainable Baseline & Model**:
  - **Baseline**: 7-day rolling moving-average baseline with historical trend interpolation.
  - **Predictive Model**: Regularized Ridge regression incorporating time trend and cyclical day-of-week seasonality indicators ($\alpha=1.0$).
- **Data Guardrails & Zero-Leakage Split**:
  - Chronological 70% train / 15% validation / 15% test splits prevent future data leakage.
  - Honest handling of insufficient data: locations with fewer than 5 historical records return `insufficient_data: true` and explicit advisory notes instead of fabricated forecasts.
  - Synthetic input data is clearly labeled (`INPUT DATA: CALIBRATED SYNTHETIC`).
- **Uncertainty Bounds**: Prediction intervals computed from residual standard deviation ($\pm 1.96\sigma$, 95% confidence bounds).

### Feature 2 — Stock-Out & Days-to-Shortage Prediction
- Estimates when available stock will deplete below the configured minimum safety threshold.
- Transparent formula accounting for net consumption and in-transit replenishment:
  $$\text{Days to Shortage} = \frac{\text{Available Stock} - \text{Min Safety Threshold}}{\max(0.1, \text{Forecast Daily Burn} - \text{Net Incoming Daily Supply})}$$
- Explicitly accounts for reserved inventory and incoming convoy dispatches.
- Projects the exact calendar date of safety buffer exhaustion.

### Feature 3 — Demand Anomaly Detection
- Rolling 14-day statistical baseline ($\mu_{14}, \sigma_{14}$) detecting unusual consumption spikes ($Z > 2.2$).
- For every flagged anomaly: displays affected node, supply category, observed value, expected range $[\mu - 2\sigma, \mu + 2\sigma]$, deviation magnitude ($+Z\sigma$, $+\Delta\%$), observation date, explanation, and statistical limitations.
- Non-alarmist classification: spikes are categorized as `LOW`, `MEDIUM`, or `HIGH` severity without automatically assuming an operational emergency.
- Interactive acknowledgement workflow persists reviewer actions.

### Feature 4 — Explainable Risk Engine
- **Four Transparent Risk States**:
  1. `STABLE`: Buffer healthy ($>14$ days to shortage threshold).
  2. `WATCH`: Early advisory ($7\text{--}14$ days to shortage, buffer dipping).
  3. `AT_RISK`: Elevated risk ($3\text{--}7$ days to shortage, replenishment required within 48h).
  4. `CRITICAL`: Imminent shortage ($<3$ days to safety buffer breach, urgent dispatch needed).
- Fully transparent rule engine based on available stock, safety thresholds, forecast burn rates, and incoming supply. No arbitrary black-box scores.
- Every assessment exposes transparent contributing factors, source records, calculation timestamp, and a recommended review action.

### Feature 5 — “What Needs Attention?” Priority Queue
- Dashboard queue prioritizing:
  1. Imminent stock shortages ($\le 3$ days runway).
  2. Low-stock conditions ($< \text{min\_stock}$).
  3. Severe demand anomalies ($Z \ge 2.2$).
  4. Delayed incoming supplies.
  5. Data quality/freshness alerts.
- Prioritized from P1 (Immediate Action) to P5 (Routine).
- Interactive review dialog: authorized officers can acknowledge items, assign dedicated reviewers (e.g., Major Verma, Col. Joshi), and mark issues resolved with a persistent immutable audit trail.

### Feature 6 — NASA POWER Weather API Integration
- Server-side integration with NASA POWER API querying daily meteorological observations:
  - `T2M`: Air temperature at 2 meters (°C).
  - `PRECTOTCORR`: Corrected precipitation (mm/day).
  - `WS2M`: Wind speed at 2 meters (m/s).
- **Resilience & Caching**:
  - 12-hour SQLite database caching (`WeatherCache`) to prevent redundant external API calls.
  - 6-second timeout with 2 automatic retries.
  - Graceful fallback: when external APIs are unreachable or offline, the system marks the status `UNAVAILABLE` without crashing or inventing synthetic meteorological data.
- Contextual display: weather parameters are displayed as operational context in the GIS drawer and map tooltips.

### Feature 7 — Predictive Risk Map
- Extends the Leaflet corridor map with layer controls:
  - **View Mode Switch**: `Forecast Shortage Risk (Stage 2)` vs. `Current Stock (Stage 1)`.
  - **Predictive Filters**: Filter nodes by supply category, forecast horizon (7d, 14d, 30d), and risk state (`CRITICAL`, `AT_RISK`, `WATCH`, `STABLE`).
  - **Dynamic Styling**: Critical risk markers feature animated pulsing alerts.
  - **NASA POWER Weather Layer**: Real-time atmospheric conditions displayed in map tooltips and detail drawer.
  - **Interactive Node Drawer**: Selecting any marker shows the complete Stage 2 Risk Assessment, Days-to-Shortage, Contributing Factors, NASA POWER weather telemetry, and underlying inventory ledgers.

### Feature 8 — Model Monitoring & Evaluation
- Standard accuracy tracking: **MAE** (Mean Absolute Error) and **RMSE** (Root Mean Squared Error).
- **WAPE** (Weighted Absolute Percentage Error): Used as the primary percentage error metric ($\sum |y - \hat{y}| / \sum y$) to avoid division-by-zero artifacts during unobserved or zero-demand intervals.
- Explains MAPE limitations when demand values can be zero.
- Displays model name, model version, baseline comparison, test sample count, evaluation period, and evaluation timestamp.

---

## 3. Directory Layout

```
d:/SIH/GatiVyuh/
├── backend/
│   ├── app/
│   │   ├── api/             # REST Routers (health, dashboard, locations, inventory, events, alerts, gis, data, synthetic, predictive)
│   │   ├── core/            # Database engine, WAL configuration, settings
│   │   ├── models/          # SQLAlchemy Models (Location, InventoryItem, Event, Alert, DailyConsumption, ForecastResult, Anomaly, RiskAssessment, PriorityQueue, WeatherCache)
│   │   ├── schemas/         # Pydantic v2 validation models
│   │   ├── services/        # ForecastingService, AnomalyService, RiskEngine, PriorityQueueService, WeatherService, SyntheticService
│   │   └── main.py          # FastAPI application entrypoint with lifespan DB management
│   ├── tests/
│   │   ├── test_stage2.py   # Stage 2 Predictive Intelligence test suite (8 tests)
│   │   └── test_api.py      # Stage 1 Regression test suite (9 tests)
│   ├── requirements.txt
│   └── gativyuh.db          # SQLite Database
├── frontend/
│   ├── src/
│   │   ├── api/             # TypeScript client & interfaces (ForecastResponse, DemandAnomaly, RiskAssessment, PriorityQueueItem, WeatherObservation)
│   │   ├── components/      # UI Views (Header, DashboardView, MapView, PriorityQueueView, PredictiveForecastView, AnomaliesView, Locations, Inventory, Events, Alerts, DataManager)
│   │   ├── App.tsx          # Master tab & state router
│   │   ├── index.css        # Enterprise design tokens (#F5EFE5, #C96F3D, #E8D9C5)
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── data/
│   ├── roads/               # Real OpenStreetMap GeoJSON (46,291 corridor segments)
│   └── terrain/             # Real NASA SRTMGL1 GeoTIFF elevation raster (30m)
└── README.md
```

---

## 4. Test Results & Verification

### Backend Automated Test Suites (17 / 17 Tests Passing)

1. **Stage 2 Predictive Test Suite (`tests/test_stage2.py`)**:
   ```
   test_01_synthetic_consumption_generation: OK
   test_02_demand_forecasting_pipeline: OK
   test_03_insufficient_data_handling: OK
   test_04_anomaly_detection_pipeline: OK
   test_05_risk_engine_and_shortage_days: OK
   test_06_priority_queue_and_action_workflow: OK
   test_07_weather_service_and_fallback: OK
   test_08_model_monitoring_metrics: OK
   ----------------------------------------------------------------------
   Ran 8 tests in 8.112s - OK
   ```

2. **Stage 1 Regression Test Suite (`tests/test_api.py`)**:
   ```
   test_01_health_and_db: OK
   test_02_dashboard_summary: OK
   test_03_gis_overview_and_real_srtm_elevation: OK
   test_04_gis_roads_geojson: OK
   test_05_location_lifecycle: OK
   test_06_inventory_lifecycle_and_accounting: OK
   test_07_logistics_event_dispatch_and_delivery: OK
   test_08_csv_validation_and_import: OK
   test_09_synthetic_data_generation_reproducibility: OK
   ----------------------------------------------------------------------
   Ran 9 tests in 7.907s - OK
   ```

### Frontend Build Verification
```
> frontend@0.0.0 build
> tsc -b && vite build
✓ 1900 modules transformed.
dist/index.html                   1.11 kB │ gzip:   0.60 kB
dist/assets/index-B77G8FXj.css    6.33 kB │ gzip:   1.80 kB
dist/assets/index-DyA76pAS.js   539.61 kB │ gzip: 146.12 kB
✓ built in 1.12s (0 errors)
```

---

## 5. Exact Run Instructions

### 1. Backend Server
From the root repository:
```bash
cd d:\SIH\GatiVyuh\backend
py -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation available at: `http://127.0.0.1:8000/docs`

### 2. Frontend Development Server
In a separate terminal:
```bash
cd d:\SIH\GatiVyuh\frontend
npm run dev -- --host 127.0.0.1
```
Application accessible at: `http://127.0.0.1:5173`

### 3. Run Automated Tests
```bash
cd d:\SIH\GatiVyuh\backend
py -m unittest tests/test_stage2.py
py -m unittest tests/test_api.py
```

### 4. Reset & Seed Reproducible Demo Dataset (Seed 42)
You can reset the platform to a verified state at any time via the UI by clicking **"Reset Demo (Seed 42)"** in the top navigation bar, or via curl:
```bash
curl -X POST http://127.0.0.1:8000/api/synthetic/generate -H "Content-Type: application/json" -d "{\"seed\": 42, \"reset_existing\": true}"
```

---

## 6. Data Grounding & Limitations Notice

- **Geographic Data**: Real OpenStreetMap vector road network (46,291 features) and NASA SRTMGL1 1-arc-second (~30m) elevation raster are downloaded local ground truth assets.
- **Meteorological Data**: Queried directly from NASA POWER API (`MERRA-2` / `GEOS-FP`), cached server-side for 12 hours. Used strictly as contextual information.
- **Supply Ledger & Consumption Records**: Calibrated synthetic records generated from seed 42 with realistic weekend dips and demand spikes to demonstrate the predictive pipeline reproducibly.
- **Evaluation Metrics**: MAE and RMSE are tracked on chronological test splits. WAPE is reported for percentage error. MAPE is avoided when zero demand occurs to eliminate division by zero.

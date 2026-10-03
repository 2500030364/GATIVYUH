const configuredApiBase = import.meta.env.VITE_API_URL?.trim();
export const API_BASE = (configuredApiBase || "http://127.0.0.1:8000/api").replace(/\/+$/, "");

export interface Location {
  id: string;
  name: string;
  location_type: string;
  status: "STABLE" | "WATCH" | "AT_RISK" | "CRITICAL" | "INACTIVE";
  latitude: number;
  longitude: number;
  elevation_m?: number;
  description?: string;
  is_synthetic: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocationDetail extends Location {
  total_inventory_items: number;
  active_alerts_count: number;
  recent_events_count: number;
}

export interface InventoryItem {
  id: number;
  location_id: string;
  category: "FOOD_WATER" | "FUEL" | "MEDICAL_SUPPLIES" | "GENERAL_SUPPLIES";
  item_name: string;
  unit: string;
  available_stock: number;
  reserved_stock: number;
  min_stock: number;
  max_capacity: number;
  replenishment_qty: number;
  last_replenished_at?: string;
  updated_at: string;
  location_name?: string;
  stock_status?: "STABLE" | "WATCH" | "AT_RISK" | "CRITICAL";
}

export interface LogisticsEvent {
  id: string;
  event_type: "RECEIPT" | "CONSUMPTION" | "DISPATCH" | "DELIVERY" | "DELAY";
  location_id: string;
  destination_id?: string;
  category: string;
  item_name: string;
  quantity: number;
  unit: string;
  status: "COMPLETED" | "IN_TRANSIT" | "DELAYED" | "CANCELLED";
  reference_code?: string;
  notes?: string;
  is_synthetic: boolean;
  timestamp: string;
  source_location_name?: string;
  destination_location_name?: string;
}

export interface Alert {
  id: number;
  location_id: string;
  category: string;
  item_name?: string;
  severity: "WATCH" | "AT_RISK" | "CRITICAL";
  current_quantity: number;
  min_threshold: number;
  unit: string;
  reason: string;
  is_acknowledged: boolean;
  acknowledged_at?: string;
  acknowledged_by?: string;
  created_at: string;
  location_name?: string;
}

export interface CategorySummary {
  category: string;
  total_available: number;
  total_reserved: number;
  unit: string;
  items_count: number;
}

export interface LocationStatusBreakdown {
  stable: number;
  watch: number;
  at_risk: number;
  critical: number;
  inactive: number;
  total: number;
}

export interface LogisticsFlows {
  in_transit_count: number;
  delayed_count: number;
  completed_today: number;
  inbound_deliveries_pending: number;
  outbound_dispatches_active: number;
}

export interface DataFreshness {
  database_status: string;
  roads_status: string;
  roads_source: string;
  roads_feature_count: number;
  terrain_status: string;
  terrain_elevation_range?: string;
  system_mode: string;
  last_event_time?: string;
  server_time: string;
}

export interface DashboardSummary {
  total_locations: number;
  total_inventory_items: number;
  active_alerts_count: number;
  critical_alerts_count: number;
  location_status: LocationStatusBreakdown;
  categories: CategorySummary[];
  flows: LogisticsFlows;
  recent_events: LogisticsEvent[];
  recent_alerts: Alert[];
  freshness: DataFreshness;
}

export interface BoundingBox {
  min_lat: number;
  min_lon: number;
  max_lat: number;
  max_lon: number;
}

export interface GISOverview {
  region_name: string;
  roads: {
    is_valid: boolean;
    status_message: string;
    feature_count: number;
    geometry_types: Record<string, number>;
    highway_types: Record<string, number>;
    bounds?: BoundingBox;
    file_path?: string;
    file_size_bytes?: number;
  };
  terrain: {
    is_valid: boolean;
    status_message: string;
    crs?: string;
    width?: number;
    height?: number;
    min_elevation?: number;
    max_elevation?: number;
    mean_elevation?: number;
    bounds?: BoundingBox;
    file_path?: string;
    file_size_bytes?: number;
  };
  clipping_boundary_present: boolean;
  demo_synthetic_available: boolean;
}

export interface ElevationResponse {
  latitude: number;
  longitude: number;
  elevation_m?: number;
  source: string;
  message: string;
}

export interface CSVImportResult {
  dataset_type: string;
  total_rows: number;
  imported_rows: number;
  failed_rows: number;
  success: boolean;
  errors: Array<{
    row_number: number;
    field?: string;
    message: string;
    raw_data?: Record<string, any>;
  }>;
  message: string;
}

export interface DatasetStatusItem {
  name: string;
  category: string;
  source_type: string;
  status: string;
  record_count: number;
  last_update?: string;
  file_info?: string;
  description: string;
}

export interface DatasetManagementOverview {
  datasets: DatasetStatusItem[];
  geographic_mode: string;
  logistics_mode: string;
}

export interface HistoricalDemandPoint {
  date: string;
  actual_demand: number;
}

export interface ForecastPoint {
  date: string;
  predicted_demand: number;
  lower_bound: number;
  upper_bound: number;
  baseline_demand: number;
}

export interface ForecastResponse {
  location_id: string;
  location_name?: string;
  category: string;
  item_name: string;
  horizon_days: number;
  model_name: string;
  model_version: string;
  is_synthetic_input: boolean;
  generated_at: string;
  insufficient_data: boolean;
  data_limitation_note?: string;
  historical_series: HistoricalDemandPoint[];
  forecast_series: ForecastPoint[];
}

export interface DemandAnomaly {
  id: number;
  location_id: string;
  location_name?: string;
  category: string;
  item_name: string;
  anomaly_date: string;
  observed_value: number;
  baseline_mean: number;
  expected_range_min: number;
  expected_range_max: number;
  z_score: number;
  deviation_pct: number;
  severity: "LOW" | "MEDIUM" | "HIGH";
  explanation: string;
  limitations?: string;
  is_emergency: boolean;
  is_acknowledged: boolean;
  created_at: string;
}

export interface RiskAssessment {
  id: number;
  location_id: string;
  location_name?: string;
  category: string;
  risk_state: "STABLE" | "WATCH" | "AT_RISK" | "CRITICAL";
  current_stock: number;
  min_threshold: number;
  avg_daily_demand: number;
  days_to_shortage?: number | null;
  projected_stockout_date?: string | null;
  insufficient_data: boolean;
  incoming_supply: number;
  contributing_factors: string[];
  recommended_action: string;
  data_quality_score: number;
  calculated_at: string;
}

export interface PriorityQueueItem {
  id: number;
  priority_rank: number;
  item_type: "IMMINENT_SHORTAGE" | "LOW_STOCK" | "DEMAND_ANOMALY" | "DELAYED_SUPPLY" | "DATA_QUALITY";
  location_id: string;
  location_name?: string;
  category?: string;
  title: string;
  explanation: string;
  urgency: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status: "OPEN" | "ACKNOWLEDGED" | "UNDER_REVIEW" | "RESOLVED";
  assigned_reviewer?: string | null;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  audit_trail: Array<{
    timestamp: string;
    action: string;
    user: string;
    notes?: string;
  }>;
  created_at: string;
}

export interface WeatherObservation {
  location_id: string;
  latitude: number;
  longitude: number;
  observation_date: string;
  temp_c?: number | null;
  precipitation_mm?: number | null;
  wind_speed_ms?: number | null;
  source: string;
  retrieval_timestamp: string;
  status: "LIVE" | "CACHED" | "UNAVAILABLE";
  message?: string;
}

export interface ModelEvaluation {
  id: number;
  model_name: string;
  model_version: string;
  location_id: string;
  category: string;
  mae: number;
  rmse: number;
  baseline_mae: number;
  baseline_rmse: number;
  mape?: number | null;
  wape?: number | null;
  sample_count: number;
  evaluation_period: string;
  evaluation_notes?: string;
  evaluated_at: string;
}

// Stage 3: Optimization, Digital Twin & Scenarios Types
export interface TransportResource {
  id: string;
  name: string;
  vehicle_type: "HEAVY_TRUCK" | "MEDIUM_TRUCK" | "LIGHT_UTILITY" | "FUEL_TANKER" | "REFRIGERATED_VAN";
  capacity_weight_kg: number;
  capacity_volume_m3: number;
  current_load_kg: number;
  fuel_efficiency_km_l: number;
  speed_empty_kmh: number;
  speed_loaded_kmh: number;
  cost_per_km: number;
  status: "AVAILABLE" | "IN_TRANSIT" | "MAINTENANCE" | "STANDBY";
  current_location_id: string;
  destination_location_id?: string | null;
  current_location_name?: string | null;
  destination_location_name?: string | null;
  operational_restrictions?: Record<string, any> | null;
  maintenance_status: "OPERATIONAL" | "SERVICE_DUE" | "REPAIR_REQUIRED";
  available_from?: string | null;
  available_to?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ElevationProfilePoint {
  distance_km: number;
  elevation_m: number;
  lat: number;
  lon: number;
}

export interface RouteCandidate {
  route_id: string;
  name: string;
  origin_id: string;
  origin_name: string;
  destination_id: string;
  destination_name: string;
  distance_km: number;
  estimated_duration_min: number;
  road_classes: string[];
  elevation_gain_m: number;
  max_slope_pct: number;
  is_feasible: boolean;
  unfeasible_reason?: string | null;
  explanation: string;
  elevation_profile: ElevationProfilePoint[];
  geometry_geojson?: any;
}

export interface RouteAnalysisResponse {
  origin_location_id: string;
  origin_name: string;
  destination_location_id: string;
  destination_name: string;
  candidate_routes: RouteCandidate[];
  recommended_route_id?: string | null;
  data_attribution: string;
  operational_notice: string;
}

export interface CorridorRouteSegment {
  id: string;
  name: string;
  origin_location_id: string;
  destination_location_id: string;
  distance_km: number;
  estimated_duration_min: number;
  road_class: string;
  avg_gradient_pct: number;
  max_gradient_pct: number;
  elevation_gain_m: number;
  is_blocked: boolean;
  blockage_reason?: string | null;
  geometry_geojson?: any;
  created_at: string;
}

export interface SupplyAllocationItem {
  source_location_id: string;
  source_location_name: string;
  destination_location_id: string;
  destination_location_name: string;
  category: string;
  quantity_allocated: number;
  transport_resource_id?: string | null;
  transport_resource_name?: string | null;
  route_name: string;
  distance_km: number;
  estimated_cost: number;
  rationale: string;
}

export interface UnmetDemandItem {
  destination_location_id: string;
  destination_name: string;
  category: string;
  forecast_demand: number;
  allocated_quantity: number;
  unmet_quantity: number;
  shortage_reason: string;
}

export interface SupplyAllocationResponse {
  solver_status: "OPTIMAL" | "FEASIBLE_WITH_DEFICIT" | "INFEASIBLE";
  solver_name: string;
  total_demand_requested: number;
  total_allocated: number;
  total_unmet_demand: number;
  total_transport_cost: number;
  allocations: SupplyAllocationItem[];
  unmet_demand_breakdown: UnmetDemandItem[];
  infeasible_constraints: string[];
  trade_off_explanation: string;
  solver_time_ms: number;
  calculated_at: string;
}

export interface DependencyNode {
  id: string;
  name: string;
  location_type: string;
  latitude: number;
  longitude: number;
  elevation_m?: number | null;
  status: string;
  risk_state: string;
  total_available_stock: number;
  daily_burn_rate: number;
  days_to_shortage: number;
}

export interface DependencyEdge {
  id: string;
  source: string;
  target: string;
  source_name: string;
  target_name: string;
  distance_km: number;
  road_class: string;
  is_blocked: boolean;
  average_flow_rate: number;
}

export interface RippleDisruptionSimulation {
  disrupted_node_id?: string | null;
  disrupted_link_id?: string | null;
  affected_nodes: Array<{
    node_id: string;
    node_name: string;
    baseline_days_to_shortage: number;
    projected_days_to_shortage: number;
    baseline_risk: string;
    projected_risk: string;
    dependent_supply_link: string;
    unmet_demand_impact: number;
    rationale: string;
  }>;
  isolated_nodes: string[];
  total_unmet_demand_delta: number;
  acceleration_summary: string;
}

export interface DependencyGraphResponse {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  ripple_analysis?: RippleDisruptionSimulation | null;
  source_attribution: string;
}

export interface DigitalTwinResponse {
  timestamp: string;
  mode: string;
  nodes_count: number;
  active_fleet_count: number;
  in_transit_convoys_count: number;
  open_alerts_count: number;
  nodes: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    latitude: number;
    longitude: number;
    elevation_m?: number | null;
    total_available_stock: number;
    total_reserved_stock: number;
    categories_at_risk: number;
    stationed_fleet_count: number;
    incoming_convoys_count: number;
    outgoing_convoys_count: number;
  }>;
  fleet: TransportResource[];
  active_routes: Array<{
    id: string;
    name: string;
    origin: string;
    destination: string;
    distance_km: number;
    road_class: string;
    is_blocked: boolean;
    elevation_gain_m: number;
    max_gradient_pct: number;
  }>;
  shortage_forecasts: Array<{
    location_id: string;
    location_name: string;
    category: string;
    severity: string;
    current_quantity: number;
    min_threshold: number;
    unit: string;
    reason: string;
  }>;
  network_summary: {
    total_nodes: number;
    total_fleet_capacity_kg: number;
    active_fleet_count: number;
    in_transit_convoys: number;
    corridor_segments_count: number;
    blocked_corridors_count: number;
    open_alerts: number;
    system_integrity: string;
  };
}

export interface ScenarioInputs {
  road_closures?: string[];
  demand_multipliers?: Record<string, number>;
  replenishment_delays?: Record<string, number>;
  transport_capacity_factor?: number;
  inventory_adjustments?: Record<string, number>;
  restricted_vehicle_ids?: string[];
}

export interface ScenarioResponse {
  id: number;
  scenario_code: string;
  title: string;
  description?: string | null;
  author: string;
  workflow_status: "DRAFT" | "SIMULATED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "COMMITTED";
  scenario_inputs: ScenarioInputs;
  baseline_results?: any;
  simulation_results?: any;
  comparison_metrics?: {
    baseline_total_demand: number;
    simulated_total_demand: number;
    demand_delta: number;
    baseline_unmet_demand: number;
    simulated_unmet_demand: number;
    unmet_demand_delta: number;
    baseline_transport_cost: number;
    simulated_transport_cost: number;
    cost_delta: number;
    fulfillment_rate_pct: number;
    solver_time_ms: number;
    active_road_closures_count: number;
    transport_capacity_factor: number;
  } | null;
  allocation_plan?: SupplyAllocationItem[] | null;
  impacted_locations?: Array<{
    location_id: string;
    location_name: string;
    location_type: string;
    is_directly_blocked: boolean;
    unmet_items_count: number;
    total_deficit: number;
    status: string;
  }> | null;
  candidate_routes?: RouteCandidate[] | null;
  infeasible_constraints?: string[] | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  approval_history: Array<{
    action: string;
    actor: string;
    timestamp: string;
    notes?: string;
  }>;
  model_version: string;
  created_at: string;
  updated_at: string;
}

export interface OperationalReportResponse {
  report_title: string;
  generated_at: string;
  generator: string;
  platform_version: string;
  system_status: string;
  current_inventory_summary: any;
  active_shortage_risks: any[];
  simulated_scenarios_summary: any[];
  optimization_performance: any;
  data_provenance_and_licensing: Record<string, string>;
  human_audit_trail: any[];
}

// API functions
export const api = {
  getDemandForecast: async (locationId: string, category: string, horizonDays: number = 14): Promise<ForecastResponse> => {
    const res = await fetch(`${API_BASE}/predictive/forecast?location_id=${locationId}&category=${category}&horizon_days=${horizonDays}`);
    if (!res.ok) throw new Error("Failed to load demand forecast");
    return res.json();
  },

  getDemandAnomalies: async (params?: { location_id?: string; category?: string; is_acknowledged?: boolean }): Promise<DemandAnomaly[]> => {
    const query = new URLSearchParams();
    if (params?.location_id) query.append("location_id", params.location_id);
    if (params?.category) query.append("category", params.category);
    if (params?.is_acknowledged !== undefined) query.append("is_acknowledged", String(params.is_acknowledged));
    const res = await fetch(`${API_BASE}/predictive/anomalies?${query.toString()}`);
    if (!res.ok) throw new Error("Failed to load anomalies");
    return res.json();
  },

  acknowledgeAnomaly: async (anomalyId: number): Promise<DemandAnomaly> => {
    const res = await fetch(`${API_BASE}/predictive/anomalies/${anomalyId}/acknowledge`, { method: "POST" });
    if (!res.ok) throw new Error("Failed to acknowledge anomaly");
    return res.json();
  },

  getRiskAssessments: async (params?: { location_id?: string; category?: string; risk_state?: string }): Promise<RiskAssessment[]> => {
    const query = new URLSearchParams();
    if (params?.location_id) query.append("location_id", params.location_id);
    if (params?.category) query.append("category", params.category);
    if (params?.risk_state) query.append("risk_state", params.risk_state);
    const res = await fetch(`${API_BASE}/predictive/risks?${query.toString()}`);
    if (!res.ok) throw new Error("Failed to load risk assessments");
    return res.json();
  },

  getPriorityQueue: async (params?: { status?: string; rebuild?: boolean }): Promise<PriorityQueueItem[]> => {
    const query = new URLSearchParams();
    if (params?.status) query.append("status", params.status);
    if (params?.rebuild) query.append("rebuild", "true");
    const res = await fetch(`${API_BASE}/predictive/priority-queue?${query.toString()}`);
    if (!res.ok) throw new Error("Failed to load priority queue");
    return res.json();
  },

  actionPriorityQueueItem: async (itemId: number, action: string, reviewer?: string, notes?: string): Promise<PriorityQueueItem> => {
    const res = await fetch(`${API_BASE}/predictive/priority-queue/${itemId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reviewer, notes }),
    });
    if (!res.ok) throw new Error("Failed to update priority queue item");
    return res.json();
  },

  getWeather: async (locationId: string, lat: number, lon: number, forceRefresh: boolean = false): Promise<WeatherObservation> => {
    const res = await fetch(`${API_BASE}/predictive/weather?location_id=${locationId}&lat=${lat}&lon=${lon}&force_refresh=${forceRefresh}`);
    if (!res.ok) throw new Error("Failed to load weather observation");
    return res.json();
  },

  getModelMonitoringMetrics: async (params?: { location_id?: string; category?: string }): Promise<ModelEvaluation[]> => {
    const query = new URLSearchParams();
    if (params?.location_id) query.append("location_id", params.location_id);
    if (params?.category) query.append("category", params.category);
    const res = await fetch(`${API_BASE}/predictive/models/monitoring?${query.toString()}`);
    if (!res.ok) throw new Error("Failed to load model monitoring metrics");
    return res.json();
  },
  getDashboardSummary: async (): Promise<DashboardSummary> => {
    const res = await fetch(`${API_BASE}/dashboard/summary`);
    if (!res.ok) throw new Error("Failed to load dashboard summary");
    return res.json();
  },

  getLocations: async (params?: { type?: string; status?: string; is_active?: boolean }): Promise<Location[]> => {
    const query = new URLSearchParams();
    if (params?.type) query.append("location_type", params.type);
    if (params?.status) query.append("status", params.status);
    if (params?.is_active !== undefined) query.append("is_active", String(params.is_active));
    const res = await fetch(`${API_BASE}/locations?${query.toString()}`);
    if (!res.ok) throw new Error("Failed to load locations");
    return res.json();
  },

  getLocationDetail: async (id: string): Promise<LocationDetail> => {
    const res = await fetch(`${API_BASE}/locations/${id}`);
    if (!res.ok) throw new Error(`Failed to load location ${id}`);
    return res.json();
  },

  createLocation: async (data: any): Promise<Location> => {
    const res = await fetch(`${API_BASE}/locations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to create location");
    }
    return res.json();
  },

  updateLocation: async (id: string, data: any): Promise<Location> => {
    const res = await fetch(`${API_BASE}/locations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update location");
    return res.json();
  },

  deactivateLocation: async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/locations/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to deactivate location");
  },

  getInventory: async (params?: { location_id?: string; category?: string; status?: string }): Promise<InventoryItem[]> => {
    const query = new URLSearchParams();
    if (params?.location_id) query.append("location_id", params.location_id);
    if (params?.category) query.append("category", params.category);
    if (params?.status) query.append("status", params.status);
    const res = await fetch(`${API_BASE}/inventory?${query.toString()}`);
    if (!res.ok) throw new Error("Failed to load inventory");
    return res.json();
  },

  adjustInventory: async (id: number, data: { action: string; quantity: number; notes?: string; reference_code?: string }): Promise<InventoryItem> => {
    const res = await fetch(`${API_BASE}/inventory/${id}/adjust`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to adjust inventory");
    }
    return res.json();
  },

  getEvents: async (params?: { location_id?: string; event_type?: string; status?: string; limit?: number }): Promise<LogisticsEvent[]> => {
    const query = new URLSearchParams();
    if (params?.location_id) query.append("location_id", params.location_id);
    if (params?.event_type) query.append("event_type", params.event_type);
    if (params?.status) query.append("status", params.status);
    if (params?.limit) query.append("limit", String(params.limit));
    const res = await fetch(`${API_BASE}/events?${query.toString()}`);
    if (!res.ok) throw new Error("Failed to load logistics events");
    return res.json();
  },

  recordReceipt: async (data: any): Promise<LogisticsEvent> => {
    const res = await fetch(`${API_BASE}/events/receipt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to record receipt");
    }
    return res.json();
  },

  recordConsumption: async (data: any): Promise<LogisticsEvent> => {
    const res = await fetch(`${API_BASE}/events/consumption`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to record consumption");
    }
    return res.json();
  },

  recordDispatch: async (data: any): Promise<LogisticsEvent> => {
    const res = await fetch(`${API_BASE}/events/dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to record dispatch");
    }
    return res.json();
  },

  deliverConvoy: async (eventId: string, notes?: string): Promise<LogisticsEvent> => {
    const query = notes ? `?notes=${encodeURIComponent(notes)}` : "";
    const res = await fetch(`${API_BASE}/events/${eventId}/deliver${query}`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to deliver convoy");
    }
    return res.json();
  },

  delayConvoy: async (eventId: string, reason: string): Promise<LogisticsEvent> => {
    const res = await fetch(`${API_BASE}/events/${eventId}/delay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to record delay");
    }
    return res.json();
  },

  getAlerts: async (params?: { is_acknowledged?: boolean; severity?: string; location_id?: string }): Promise<Alert[]> => {
    const query = new URLSearchParams();
    if (params?.is_acknowledged !== undefined) query.append("is_acknowledged", String(params.is_acknowledged));
    if (params?.severity) query.append("severity", params.severity);
    if (params?.location_id) query.append("location_id", params.location_id);
    const res = await fetch(`${API_BASE}/alerts?${query.toString()}`);
    if (!res.ok) throw new Error("Failed to load alerts");
    return res.json();
  },

  acknowledgeAlert: async (alertId: number, acknowledgedBy: string = "Logistics Officer"): Promise<Alert> => {
    const res = await fetch(`${API_BASE}/alerts/${alertId}/acknowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acknowledged_by: acknowledgedBy }),
    });
    if (!res.ok) throw new Error("Failed to acknowledge alert");
    return res.json();
  },

  getGISOverview: async (): Promise<GISOverview> => {
    const res = await fetch(`${API_BASE}/gis/overview`);
    if (!res.ok) throw new Error("Failed to load GIS overview");
    return res.json();
  },

  getRoadsGeoJSON: async (tier: string = "major"): Promise<any> => {
    const res = await fetch(`${API_BASE}/gis/roads?tier=${tier}`);
    if (!res.ok) throw new Error("Failed to load roads GeoJSON");
    return res.json();
  },

  getClippingBoundary: async (): Promise<any> => {
    const res = await fetch(`${API_BASE}/gis/boundary`);
    if (!res.ok) throw new Error("Failed to load clipping boundary");
    return res.json();
  },

  queryElevation: async (lat: number, lon: number): Promise<ElevationResponse> => {
    const res = await fetch(`${API_BASE}/gis/elevation?lat=${lat}&lon=${lon}`);
    if (!res.ok) throw new Error("Failed to query elevation");
    return res.json();
  },

  getDataStatus: async (): Promise<DatasetManagementOverview> => {
    const res = await fetch(`${API_BASE}/data/status`);
    if (!res.ok) throw new Error("Failed to load dataset status");
    return res.json();
  },

  importLocationsCSV: async (file: File): Promise<CSVImportResult> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/data/import/locations`, {
      method: "POST",
      body: formData,
    });
    return res.json();
  },

  importInventoryCSV: async (file: File): Promise<CSVImportResult> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/data/import/inventory`, {
      method: "POST",
      body: formData,
    });
    return res.json();
  },

  getTemplateDownloadUrl: (datasetType: string): string => {
    return `${API_BASE}/data/template/${datasetType}`;
  },

  generateSyntheticData: async (seed: number = 42, reset: boolean = true): Promise<any> => {
    const res = await fetch(`${API_BASE}/synthetic/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed, reset_existing: reset }),
    });
    if (!res.ok) throw new Error("Failed to generate demo data");
    return res.json();
  },

  // ============================================================================
  // STAGE 3: FLEET & TRANSPORTATION INTELLIGENCE
  // ============================================================================
  getTransportResources: async (params?: { status?: string; vehicle_type?: string; location_id?: string }): Promise<TransportResource[]> => {
    const query = new URLSearchParams();
    if (params?.status) query.append("status", params.status);
    if (params?.vehicle_type) query.append("vehicle_type", params.vehicle_type);
    if (params?.location_id) query.append("location_id", params.location_id);
    const res = await fetch(`${API_BASE}/optimization/resources?${query.toString()}`);
    if (!res.ok) throw new Error("Failed to load transport resources");
    return res.json();
  },

  getTransportResource: async (id: string): Promise<TransportResource> => {
    const res = await fetch(`${API_BASE}/optimization/resources/${id}`);
    if (!res.ok) throw new Error(`Failed to load resource ${id}`);
    return res.json();
  },

  createTransportResource: async (data: any): Promise<TransportResource> => {
    const res = await fetch(`${API_BASE}/optimization/resources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to create transport resource");
    }
    return res.json();
  },

  updateTransportResource: async (id: string, data: any): Promise<TransportResource> => {
    const res = await fetch(`${API_BASE}/optimization/resources/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to update transport resource");
    }
    return res.json();
  },

  // ============================================================================
  // STAGE 3: ROUTE ANALYSIS & CORRIDORS
  // ============================================================================
  getCorridors: async (): Promise<CorridorRouteSegment[]> => {
    const res = await fetch(`${API_BASE}/optimization/corridors`);
    if (!res.ok) throw new Error("Failed to load corridor route segments");
    return res.json();
  },

  analyzeRoutes: async (data: {
    origin_location_id: string;
    destination_location_id: string;
    avoid_road_classes?: string[];
    max_gradient_pct?: number;
    simulate_closures?: string[];
  }): Promise<RouteAnalysisResponse> => {
    const res = await fetch(`${API_BASE}/optimization/routes/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to analyze routes");
    }
    return res.json();
  },

  getNetworkConnectivity: async (): Promise<any> => {
    const res = await fetch(`${API_BASE}/optimization/network/connectivity`);
    if (!res.ok) throw new Error("Failed to load network connectivity");
    return res.json();
  },

  // ============================================================================
  // STAGE 3: MULTI-CONSTRAINT ALLOCATION SOLVER
  // ============================================================================
  runSupplyAllocation: async (data: {
    category?: string;
    priority_weights?: Record<string, number>;
    transport_cost_weight?: number;
    enforce_safety_stock?: boolean;
    blocked_route_ids?: string[];
    transport_capacity_factor?: number;
    demand_multiplier?: number;
  }): Promise<SupplyAllocationResponse> => {
    const res = await fetch(`${API_BASE}/optimization/allocate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to solve supply allocation");
    return res.json();
  },

  // ============================================================================
  // STAGE 3: DEPENDENCY GRAPH & RIPPLE EFFECT
  // ============================================================================
  getDependencyGraph: async (): Promise<DependencyGraphResponse> => {
    const res = await fetch(`${API_BASE}/optimization/dependencies`);
    if (!res.ok) throw new Error("Failed to load dependency graph");
    return res.json();
  },

  simulateRippleDisruption: async (params: { disrupted_node_id?: string; disrupted_link_id?: string }): Promise<RippleDisruptionSimulation> => {
    const query = new URLSearchParams();
    if (params.disrupted_node_id) query.append("disrupted_node_id", params.disrupted_node_id);
    if (params.disrupted_link_id) query.append("disrupted_link_id", params.disrupted_link_id);
    const res = await fetch(`${API_BASE}/optimization/dependencies/ripple?${query.toString()}`, {
      method: "POST"
    });
    if (!res.ok) throw new Error("Failed to simulate ripple disruption");
    return res.json();
  },

  // ============================================================================
  // STAGE 3: LOGISTICS DIGITAL TWIN
  // ============================================================================
  getDigitalTwin: async (): Promise<DigitalTwinResponse> => {
    const res = await fetch(`${API_BASE}/optimization/digital-twin`);
    if (!res.ok) throw new Error("Failed to load digital twin state");
    return res.json();
  },

  // ============================================================================
  // STAGE 3: WHAT-IF SCENARIOS & HUMAN APPROVAL
  // ============================================================================
  getScenarios: async (): Promise<ScenarioResponse[]> => {
    const res = await fetch(`${API_BASE}/optimization/scenarios`);
    if (!res.ok) throw new Error("Failed to load scenarios");
    return res.json();
  },

  getScenario: async (id: number): Promise<ScenarioResponse> => {
    const res = await fetch(`${API_BASE}/optimization/scenarios/${id}`);
    if (!res.ok) throw new Error(`Failed to load scenario ${id}`);
    return res.json();
  },

  createScenario: async (data: {
    scenario_code: string;
    title: string;
    description?: string;
    author?: string;
    scenario_inputs: ScenarioInputs;
  }): Promise<ScenarioResponse> => {
    const res = await fetch(`${API_BASE}/optimization/scenarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to create scenario");
    }
    return res.json();
  },

  simulateScenario: async (id: number): Promise<ScenarioResponse> => {
    const res = await fetch(`${API_BASE}/optimization/scenarios/${id}/simulate`, {
      method: "POST"
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to simulate scenario");
    }
    return res.json();
  },

  reviewScenario: async (id: number, data: { action: string; reviewer: string; notes?: string }): Promise<ScenarioResponse> => {
    const res = await fetch(`${API_BASE}/optimization/scenarios/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to submit review for scenario");
    }
    return res.json();
  },

  commitScenario: async (id: number, committedBy: string = "Logistics Operations Officer", notes?: string): Promise<ScenarioResponse> => {
    const query = new URLSearchParams({ committed_by: committedBy });
    if (notes) query.append("notes", notes);
    const res = await fetch(`${API_BASE}/optimization/scenarios/${id}/commit?${query.toString()}`, {
      method: "POST"
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to commit approved scenario");
    }
    return res.json();
  },

  compareScenarios: async (scenarioIds: number[]): Promise<any> => {
    const res = await fetch(`${API_BASE}/optimization/scenarios/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scenarioIds),
    });
    if (!res.ok) throw new Error("Failed to compare scenarios");
    return res.json();
  },

  deleteScenario: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/optimization/scenarios/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete scenario");
  },

  // ============================================================================
  // STAGE 3: REPORTING & ANALYTICS
  // ============================================================================
  getOperationalReport: async (): Promise<OperationalReportResponse> => {
    const res = await fetch(`${API_BASE}/optimization/reports/summary`);
    if (!res.ok) throw new Error("Failed to load operational report");
    return res.json();
  },

  getCSVExportUrl: (): string => {
    return `${API_BASE}/optimization/reports/export/csv`;
  },

  getJSONExportUrl: (): string => {
    return `${API_BASE}/optimization/reports/export/json`;
  },
};

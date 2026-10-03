import React, { useEffect, useState } from "react";
import { 
  Building2, Package, AlertTriangle, Truck, CheckCircle2, 
  Clock, ArrowUpRight, ArrowDownRight, Database, MapPin,
  BellRing, TrendingUp, Activity, ArrowRight, ShieldAlert
} from "lucide-react";
import { DashboardSummary, PriorityQueueItem, DemandAnomaly, api } from "../api/client";

interface DashboardViewProps {
  summary: DashboardSummary | null;
  onNavigateTab: (tab: string) => void;
  onSelectLocation?: (locationId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ summary, onNavigateTab }) => {
  const [priorityItems, setPriorityItems] = useState<PriorityQueueItem[]>([]);
  const [anomalies, setAnomalies] = useState<DemandAnomaly[]>([]);
  const [loadingStage2, setLoadingStage2] = useState<boolean>(true);

  useEffect(() => {
    const fetchStage2Overview = async () => {
      try {
        const [pq, anom] = await Promise.all([
          api.getPriorityQueue({ status: "OPEN" }),
          api.getDemandAnomalies(),
        ]);
        setPriorityItems(pq);
        setAnomalies(anom);
      } catch (err) {
        console.error("Error loading Stage 2 summary data:", err);
      } finally {
        setLoadingStage2(false);
      }
    };

    fetchStage2Overview();
  }, []);

  if (!summary) {
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
        Loading dashboard telemetry...
      </div>
    );
  }

  const {
    total_locations,
    total_inventory_items,
    active_alerts_count,
    critical_alerts_count,
    location_status,
    categories,
    flows,
    recent_events,
    recent_alerts,
    freshness
  } = summary;

  // Category labels and icons
  const categoryMeta: Record<string, { label: string; color: string; bg: string }> = {
    FOOD_WATER: { label: "Food & Potable Water", color: "#2D7D46", bg: "#EAF5EE" },
    FUEL: { label: "Petroleum & Turbine Fuel", color: "#C96F3D", bg: "#FBF0E9" },
    MEDICAL_SUPPLIES: { label: "Forward Medical Supplies", color: "#B71C1C", bg: "#FDE8E8" },
    GENERAL_SUPPLIES: { label: "General & Field Logistics", color: "#5E564D", bg: "#EFECE6" },
  };

  const getPriorityBadgeClass = (rank: number) => {
    if (rank <= 1) return "badge-critical";
    if (rank <= 2) return "badge-at-risk";
    if (rank <= 3) return "badge-watch";
    return "badge-stable";
  };

  const getPriorityLabel = (rank: number) => {
    if (rank <= 1) return "P1 Immediate Action";
    if (rank <= 2) return "P2 Urgent Review";
    if (rank <= 3) return "P3 Elevated Watch";
    if (rank <= 4) return "P4 Advisory";
    return "P5 Routine";
  };

  return (
    <div style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      
      {/* Honest Data Banner */}
      <div style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        padding: "1rem 1.25rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "1rem"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            backgroundColor: "var(--primary-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--primary)"
          }}>
            <Database size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-main)" }}>
              Operating in Hybrid GIS &amp; Stage 2 Predictive Intelligence Mode
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              NASA SRTMGL1 Elevation ({freshness.terrain_elevation_range || "27m - 1327m"}), OSM Road Network ({freshness.roads_feature_count.toLocaleString()} features), Ridge Forecasting, Z-Score Anomaly Engine &amp; NASA POWER Weather are online.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => onNavigateTab("priority-queue")}
            className="btn btn-primary btn-sm"
          >
            <BellRing size={14} />
            <span>Priority Queue ({priorityItems.length})</span>
          </button>
          <button
            onClick={() => onNavigateTab("data")}
            className="btn btn-secondary btn-sm"
          >
            Pipeline Audit
          </button>
        </div>
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="grid-cols-4">
        
        {/* Metric 1: Tracked Locations */}
        <div className="card" onClick={() => onNavigateTab("locations")} style={{ cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Tracked Locations
            </span>
            <Building2 size={20} color="var(--primary)" />
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, marginTop: "0.5rem", color: "var(--text-main)" }}>
            {total_locations}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem", fontSize: "0.75rem" }}>
            <span className="badge badge-stable">{location_status.stable} Stable</span>
            <span className="badge badge-watch">{location_status.watch} Watch</span>
            <span className="badge badge-critical">{location_status.critical} Critical</span>
          </div>
        </div>

        {/* Metric 2: Total Inventory Records */}
        <div className="card" onClick={() => onNavigateTab("inventory")} style={{ cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Total Stock Records
            </span>
            <Package size={20} color="var(--primary)" />
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, marginTop: "0.5rem", color: "var(--text-main)" }}>
            {total_inventory_items}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.4rem" }}>
            Across 4 forward supply categories
          </div>
        </div>

        {/* Metric 3: Active Stock Alerts */}
        <div className="card" onClick={() => onNavigateTab("alerts")} style={{ cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Stock Deficit Alerts
            </span>
            <AlertTriangle size={20} color="var(--status-critical)" />
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, marginTop: "0.5rem", color: active_alerts_count > 0 ? "var(--status-critical)" : "var(--status-stable)" }}>
            {active_alerts_count}
          </div>
          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.4rem", fontSize: "0.75rem" }}>
            <span className="badge badge-critical">{critical_alerts_count} Critical</span>
            <span className="badge badge-at-risk">{active_alerts_count - critical_alerts_count} Risk/Watch</span>
          </div>
        </div>

        {/* Metric 4: In-Transit Convoys */}
        <div className="card" onClick={() => onNavigateTab("events")} style={{ cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Convoys In-Transit
            </span>
            <Truck size={20} color="var(--primary)" />
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, marginTop: "0.5rem", color: "var(--text-main)" }}>
            {flows.in_transit_count}
          </div>
          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.4rem", fontSize: "0.75rem" }}>
            <span className="badge badge-watch">{flows.delayed_count} Delayed</span>
            <span className="badge badge-neutral">{flows.completed_today} Completed</span>
          </div>
        </div>

      </div>

      {/* FEATURE 5: WHAT NEEDS ATTENTION? PRIORITY QUEUE SECTION */}
      <div className="card" style={{ borderLeft: "4px solid var(--primary)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{
              width: "32px",
              height: "32px",
              borderRadius: "6px",
              backgroundColor: "var(--primary-light)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--primary)"
            }}>
              <BellRing size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: "1.05rem" }}>What Needs Attention? &bull; Priority Queue</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Prioritized queue of imminent stockouts, low-stock conditions, demand anomalies, and delayed supplies with audit trail.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab("priority-queue")}
            className="btn btn-outline btn-sm"
            style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            <span>View All ({priorityItems.length})</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {priorityItems.length === 0 ? (
          <div style={{
            padding: "1.5rem",
            textAlign: "center",
            backgroundColor: "var(--status-stable-bg)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--status-stable-border)"
          }}>
            <CheckCircle2 size={24} color="var(--status-stable)" style={{ margin: "0 auto 0.4rem" }} />
            <div style={{ fontWeight: 700, color: "var(--status-stable)", fontSize: "0.9rem" }}>
              Priority Queue Clear
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              No open bottleneck conditions, severe demand spikes, or delayed convoys awaiting review.
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" }}>
            {priorityItems.slice(0, 3).map((item) => (
              <div
                key={item.id}
                onClick={() => onNavigateTab("priority-queue")}
                style={{
                  padding: "0.85rem 1rem",
                  backgroundColor: "var(--bg-card-light)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--primary)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-subtle)";
                  e.currentTarget.style.transform = "none";
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                    <span className={`badge ${getPriorityBadgeClass(item.priority_rank)}`}>
                      {getPriorityLabel(item.priority_rank)}
                    </span>
                    <span className="mono" style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                      {item.item_type}
                    </span>
                  </div>

                  <h4 style={{ fontSize: "0.9rem", color: "var(--text-main)", marginBottom: "0.3rem" }}>
                    {item.title}
                  </h4>

                  <p style={{ fontSize: "0.775rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                    {item.explanation}
                  </p>
                </div>

                <div style={{
                  marginTop: "0.75rem",
                  paddingTop: "0.5rem",
                  borderTop: "1px solid var(--border-subtle)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.725rem",
                  color: "var(--primary)",
                  fontWeight: 600
                }}>
                  <span>Take Action &rarr;</span>
                  <span style={{ color: "var(--text-muted)" }}>
                    {new Date(item.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Predictive Intelligence Shortcuts */}
        <div style={{
          marginTop: "1.25rem",
          paddingTop: "1rem",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <TrendingUp size={14} color="var(--primary)" />
              <b>Forecasting:</b> 70/15/15 Ridge + Day Seasonality
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <Activity size={14} color="var(--status-watch)" />
              <b>Anomalies:</b> {anomalies.length} Flagged
            </span>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => onNavigateTab("forecast")}
              className="btn btn-secondary btn-sm"
              style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}
            >
              <TrendingUp size={13} />
              <span>Demand Forecasts</span>
            </button>
            <button
              onClick={() => onNavigateTab("anomalies")}
              className="btn btn-secondary btn-sm"
              style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}
            >
              <Activity size={13} />
              <span>Anomaly Registry</span>
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Category Inventory Ledger Breakdown & Location Status Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.25rem" }}>
        
        {/* Category Inventory Breakdown */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
            <div>
              <h3>Total Inventory by Supply Category</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Calculated in real-time across all nodes obeying strict transaction accounting.
              </p>
            </div>
            <button onClick={() => onNavigateTab("inventory")} className="btn btn-outline btn-sm">
              Ledger View
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {categories.map((cat) => {
              const meta = categoryMeta[cat.category] || { label: cat.category, color: "var(--primary)", bg: "#FBF0E9" };
              const totalStock = cat.total_available + cat.total_reserved;
              const reservedPct = totalStock > 0 ? (cat.total_reserved / totalStock) * 100 : 0;

              return (
                <div key={cat.category} style={{
                  padding: "0.85rem 1rem",
                  backgroundColor: "var(--bg-card-light)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-main)" }}>
                        {meta.label}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "0.5rem" }}>
                        ({cat.items_count} managed items)
                      </span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--text-main)" }}>
                        {cat.total_available.toLocaleString()} {cat.unit}
                      </span>
                      {cat.total_reserved > 0 && (
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "0.5rem" }}>
                          ({cat.total_reserved.toLocaleString()} reserved)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stock bar */}
                  <div style={{
                    marginTop: "0.6rem",
                    height: "8px",
                    width: "100%",
                    backgroundColor: "var(--border-subtle)",
                    borderRadius: "4px",
                    overflow: "hidden",
                    display: "flex"
                  }}>
                    <div style={{
                      height: "100%",
                      width: `${100 - reservedPct}%`,
                      backgroundColor: meta.color,
                      transition: "width 0.3s ease"
                    }} />
                    {cat.total_reserved > 0 && (
                      <div style={{
                        height: "100%",
                        width: `${reservedPct}%`,
                        backgroundColor: "#D9531E",
                        opacity: 0.6,
                        transition: "width 0.3s ease"
                      }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Location Status Breakdown */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
            <div>
              <h3>Network Node Readiness</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Corridor operational distribution
              </p>
            </div>
            <button onClick={() => onNavigateTab("locations")} className="btn btn-outline btn-sm">
              All Nodes
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.75rem",
              backgroundColor: "var(--status-stable-bg)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--status-stable-border)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <CheckCircle2 size={16} color="var(--status-stable)" />
                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--status-stable)" }}>Stable</span>
              </div>
              <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--status-stable)" }}>
                {location_status.stable}
              </span>
            </div>

            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.75rem",
              backgroundColor: "var(--status-watch-bg)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--status-watch-border)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Clock size={16} color="var(--status-watch)" />
                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--status-watch)" }}>Watch (Buffer Low)</span>
              </div>
              <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--status-watch)" }}>
                {location_status.watch}
              </span>
            </div>

            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.75rem",
              backgroundColor: "var(--status-at-risk-bg)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--status-at-risk-border)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <AlertTriangle size={16} color="var(--status-at-risk)" />
                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--status-at-risk)" }}>At Risk (&lt; Minimum)</span>
              </div>
              <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--status-at-risk)" }}>
                {location_status.at_risk}
              </span>
            </div>

            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.75rem",
              backgroundColor: "var(--status-critical-bg)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--status-critical-border)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <AlertTriangle size={16} color="var(--status-critical)" />
                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--status-critical)" }}>Critical Deficit</span>
              </div>
              <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--status-critical)" }}>
                {location_status.critical}
              </span>
            </div>

          </div>

          <div style={{ marginTop: "1.25rem", padding: "0.75rem", backgroundColor: "var(--bg-card)", borderRadius: "var(--radius-md)" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>
              Primary Corridor:
            </span>
            <p style={{ fontSize: "0.8rem", color: "var(--text-main)", marginTop: "0.2rem" }}>
              NH48 Expressway &amp; Bhor Ghat Pass connecting Pune Central, Talegaon, and Lonavala.
            </p>
          </div>
        </div>

      </div>

      {/* Row 3: Recent Logistics Events Stream & Active Threshold Alerts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
        
        {/* Recent Logistics Events */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div>
              <h3>Recent Logistics Events</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Transactional receipts, dispatches, delays, and deliveries
              </p>
            </div>
            <button onClick={() => onNavigateTab("events")} className="btn btn-outline btn-sm">
              All Events
            </button>
          </div>

          {recent_events.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", padding: "1rem 0" }}>No events recorded yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {recent_events.map((ev) => (
                <div key={ev.id} style={{
                  padding: "0.75rem",
                  backgroundColor: "var(--bg-card-light)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem"
                }}>
                  <div style={{
                    padding: "0.35rem",
                    borderRadius: "6px",
                    backgroundColor: ev.event_type === "RECEIPT" ? "var(--status-stable-bg)" :
                                     ev.event_type === "DISPATCH" ? "var(--primary-light)" :
                                     ev.event_type === "DELAY" ? "var(--status-watch-bg)" : "var(--bg-card)",
                    color: ev.event_type === "RECEIPT" ? "var(--status-stable)" :
                           ev.event_type === "DISPATCH" ? "var(--primary)" :
                           ev.event_type === "DELAY" ? "var(--status-watch)" : "var(--text-main)"
                  }}>
                    {ev.event_type === "RECEIPT" ? <ArrowDownRight size={16} /> :
                     ev.event_type === "DISPATCH" ? <ArrowUpRight size={16} /> :
                     ev.event_type === "DELAY" ? <Clock size={16} /> : <Truck size={16} />}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.825rem", color: "var(--text-main)" }}>
                        {ev.event_type} &bull; {ev.item_name}
                      </span>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                        {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div style={{ fontSize: "0.775rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                      {ev.quantity.toLocaleString()} {ev.unit} {ev.source_location_name ? `@ ${ev.source_location_name}` : ""}
                      {ev.destination_location_name ? ` &rarr; ${ev.destination_location_name}` : ""}
                    </div>

                    {ev.notes && (
                      <div style={{ fontSize: "0.725rem", color: "var(--text-light)", marginTop: "0.2rem", fontStyle: "italic" }}>
                        &ldquo;{ev.notes}&rdquo;
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Threshold Alerts */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div>
              <h3>Active Deficit Alerts</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Rule-based stock threshold flags (non-predictive)
              </p>
            </div>
            <button onClick={() => onNavigateTab("alerts")} className="btn btn-outline btn-sm">
              Alerts Ledger
            </button>
          </div>

          {recent_alerts.length === 0 ? (
            <div style={{
              padding: "2rem",
              textAlign: "center",
              backgroundColor: "var(--status-stable-bg)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--status-stable-border)"
            }}>
              <CheckCircle2 size={24} color="var(--status-stable)" style={{ margin: "0 auto 0.5rem" }} />
              <div style={{ fontWeight: 700, color: "var(--status-stable)", fontSize: "0.9rem" }}>
                All Forward Stock Buffers Healthy
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                No active threshold breaches currently flagged in the corridor.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {recent_alerts.map((al) => (
                <div key={al.id} style={{
                  padding: "0.75rem 0.85rem",
                  backgroundColor: al.severity === "CRITICAL" ? "var(--status-critical-bg)" : "var(--status-at-risk-bg)",
                  borderRadius: "var(--radius-md)",
                  border: `1px solid ${al.severity === "CRITICAL" ? "var(--status-critical-border)" : "var(--status-at-risk-border)"}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <span className={`badge badge-${al.severity.toLowerCase()}`}>
                        {al.severity}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-main)" }}>
                        {al.location_name || al.location_id}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-main)" }}>
                      {al.current_quantity} / min {al.min_threshold} {al.unit}
                    </span>
                  </div>

                  <p style={{ fontSize: "0.775rem", color: "var(--text-main)", marginTop: "0.35rem" }}>
                    {al.reason}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
};

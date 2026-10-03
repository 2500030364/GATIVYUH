import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { 
  Building2, Package, AlertTriangle, Truck, CheckCircle2, 
  Clock, ArrowUpRight, ArrowDownRight, MapPin,
  BellRing, TrendingUp, Activity, ArrowRight, ShieldCheck,
  Compass, ExternalLink, RefreshCw, GitBranch, AlertOctagon
} from "lucide-react";
import { DashboardSummary, PriorityQueueItem, DemandAnomaly, Location, InventoryItem, api } from "../api/client";
import { MissionBriefPanel } from "./MissionBriefPanel";

interface OverviewViewProps {
  summary: DashboardSummary | null;
  locations: Location[];
  inventory: InventoryItem[];
  onNavigate: (tab: string, subTab?: string, locationId?: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ summary, locations, inventory, onNavigate }) => {
  const [priorityItems, setPriorityItems] = useState<PriorityQueueItem[]>([]);
  const [anomalies, setAnomalies] = useState<DemandAnomaly[]>([]);
  const [loadingAttention, setLoadingAttention] = useState<boolean>(true);
  const miniMapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    const fetchAttentionData = async () => {
      try {
        setLoadingAttention(true);
        const [pq, anom] = await Promise.all([
          api.getPriorityQueue({ status: "OPEN" }),
          api.getDemandAnomalies(),
        ]);
        setPriorityItems(pq);
        setAnomalies(anom);
      } catch (err) {
        console.error("Error loading overview attention data:", err);
      } finally {
        setLoadingAttention(false);
      }
    };

    fetchAttentionData();
  }, []);

  // Initialize compact geographic preview map
  useEffect(() => {
    if (!miniMapRef.current || locations.length === 0) return;

    if (!mapInstance.current) {
      const map = L.map(miniMapRef.current, {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
        dragging: true,
      }).setView([18.72, 73.55], 10);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 16,
      }).addTo(map);

      mapInstance.current = map;
    }

    const map = mapInstance.current;
    // Clear old markers if any
    map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker) {
        map.removeLayer(layer);
      }
    });

    const getMarkerColor = (status: string) => {
      switch (status) {
        case "CRITICAL": return "#B71C1C";
        case "AT_RISK": return "#D9531E";
        case "WATCH": return "#C47F10";
        default: return "#2D7D46";
      }
    };

    // Add corridor markers
    locations.forEach((loc) => {
      const markerColor = getMarkerColor(loc.status);
      const marker = L.circleMarker([loc.latitude, loc.longitude], {
        radius: loc.status === "CRITICAL" ? 9 : 7,
        fillColor: markerColor,
        color: "#FFFFFF",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
      }).addTo(map);

      marker.bindTooltip(`<b>${loc.name}</b><br/><span style="color:${markerColor};font-weight:700;">${loc.status}</span>`, {
        direction: "top",
        offset: [0, -6],
      });

      marker.on("click", () => {
        onNavigate("map-locations", "map", loc.id);
      });
    });

    // Fit bounds nicely to locations
    if (locations.length > 0) {
      const bounds = L.latLngBounds(locations.map(l => [l.latitude, l.longitude]));
      map.fitBounds(bounds, { padding: [20, 20] });
    }

    return () => {
      // Map cleanup if component unmounts
    };
  }, [locations, onNavigate]);

  if (!summary) {
    return (
      <div style={{ padding: "4rem 2rem", textAlign: "center", color: "var(--text-muted)" }}>
        <RefreshCw size={24} className="spin-animation" style={{ margin: "0 auto 0.5rem", color: "var(--primary)" }} />
        <div>Connecting to GATIVYUH corridor telemetry...</div>
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

  const categoryMeta: Record<string, { label: string; color: string }> = {
    FOOD_WATER: { label: "Food & Water", color: "#426D4D" },
    FUEL: { label: "Petroleum & Fuel", color: "#A47729" },
    MEDICAL_SUPPLIES: { label: "Medical Supplies", color: "#B71C1C" },
    GENERAL_SUPPLIES: { label: "General Supplies", color: "#687267" },
  };

  const getPriorityLabel = (rank: number) => {
    if (rank <= 1) return "P1 Immediate Action";
    if (rank <= 2) return "P2 Urgent Review";
    if (rank <= 3) return "P3 Elevated Watch";
    if (rank <= 4) return "P4 Advisory";
    return "P5 Routine";
  };

  const getPriorityBadgeClass = (rank: number) => {
    if (rank <= 1) return "badge-critical";
    if (rank <= 2) return "badge-at-risk";
    if (rank <= 3) return "badge-watch";
    return "badge-stable";
  };

  return (
    <div className="overview-operation-page" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: "1600px", margin: "0 auto", width: "100%" }}>
      <MissionBriefPanel summary={summary} locations={locations} inventory={inventory} onNavigate={onNavigate} />
      {false && <>
      
      {/* Question 1 Header Banner: Current Situation at a Glance */}
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
            <ShieldCheck size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-main)" }}>
              Corridor Operational Status &bull; Pune – Lonavala Sector
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Real NASA 30m elevation terrain ({freshness.terrain_elevation_range || "27m - 1327m"}) and {freshness.roads_feature_count.toLocaleString()} OSM road segments verified.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.6rem" }}>
          <button
            onClick={() => onNavigate("map-locations", "map")}
            className="btn btn-primary btn-sm"
          >
            <Compass size={14} />
            <span>Open Corridor Map</span>
          </button>
          <button
            onClick={() => onNavigate("predictions-alerts", "priority")}
            className="btn btn-secondary btn-sm"
          >
            <BellRing size={14} />
            <span>Attention Queue ({priorityItems.length})</span>
          </button>
        </div>
      </div>

      {/* 4 Focused KPI Summary Cards */}
      <div className="grid-cols-4">
        
        {/* Card 1: Tracked Locations */}
        <div 
          className="card" 
          onClick={() => onNavigate("map-locations", "locations")} 
          style={{ cursor: "pointer", transition: "transform 0.15s ease, box-shadow 0.15s ease" }}
          onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
          onMouseLeave={(e) => e.currentTarget.style.transform = "none"}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
              Tracked Locations
            </span>
            <Building2 size={18} color="var(--primary)" />
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, marginTop: "0.4rem", color: "var(--text-main)" }}>
            {total_locations}
          </div>
          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.4rem", fontSize: "0.725rem" }}>
            <span className="badge badge-stable">{location_status.stable} Stable</span>
            <span className="badge badge-watch">{location_status.watch} Watch</span>
            {location_status.critical > 0 && (
              <span className="badge badge-critical">{location_status.critical} Critical</span>
            )}
          </div>
        </div>

        {/* Card 2: Stock Runway & Safety Thresholds */}
        <div 
          className="card" 
          onClick={() => onNavigate("predictions-alerts", "forecast")} 
          style={{ cursor: "pointer", transition: "transform 0.15s ease, box-shadow 0.15s ease" }}
          onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
          onMouseLeave={(e) => e.currentTarget.style.transform = "none"}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
              Supply Deficit Alerts
            </span>
            <AlertTriangle size={18} color={critical_alerts_count > 0 ? "var(--status-critical)" : "var(--status-stable)"} />
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, marginTop: "0.4rem", color: critical_alerts_count > 0 ? "var(--status-critical)" : "var(--text-main)" }}>
            {active_alerts_count}
          </div>
          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.4rem", fontSize: "0.725rem" }}>
            <span className="badge badge-critical">{critical_alerts_count} Critical</span>
            <span className="badge badge-at-risk">{active_alerts_count - critical_alerts_count} At Risk</span>
          </div>
        </div>

        {/* Card 3: In-Transit Convoys */}
        <div 
          className="card" 
          onClick={() => onNavigate("map-locations", "events")} 
          style={{ cursor: "pointer", transition: "transform 0.15s ease, box-shadow 0.15s ease" }}
          onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
          onMouseLeave={(e) => e.currentTarget.style.transform = "none"}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
              Active Convoys
            </span>
            <Truck size={18} color="var(--primary)" />
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, marginTop: "0.4rem", color: "var(--text-main)" }}>
            {flows.in_transit_count}
          </div>
          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.4rem", fontSize: "0.725rem" }}>
            <span className="badge badge-watch">{flows.delayed_count} Delayed</span>
            <span className="badge badge-stable">{flows.completed_today} Completed Today</span>
          </div>
        </div>

        {/* Card 4: Action Priority Queue */}
        <div 
          className="card" 
          onClick={() => onNavigate("predictions-alerts", "priority")} 
          style={{ cursor: "pointer", transition: "transform 0.15s ease, box-shadow 0.15s ease" }}
          onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
          onMouseLeave={(e) => e.currentTarget.style.transform = "none"}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
              Needs Attention
            </span>
            <BellRing size={18} color="var(--primary)" />
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, marginTop: "0.4rem", color: priorityItems.length > 0 ? "var(--primary)" : "var(--status-stable)" }}>
            {priorityItems.length}
          </div>
          <div style={{ fontSize: "0.725rem", color: "var(--text-muted)", marginTop: "0.4rem" }}>
            {anomalies.length} demand anomalies detected
          </div>
        </div>

      </div>
      </>}

      {/* Question 2: Central "Needs Attention" Priority Section */}
      <div className="card" style={{ borderLeft: "4px solid var(--primary)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
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
              <h3 style={{ fontSize: "1.05rem", color: "var(--text-main)" }}>
                What Needs Attention? &bull; Action Items
              </h3>
              <p style={{ fontSize: "0.785rem", color: "var(--text-muted)" }}>
                Highest-urgency shortages, low-stock buffers, and demand spikes prioritized for immediate review.
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate("predictions-alerts", "priority")}
            className="btn btn-outline btn-sm"
          >
            <span>Open Full Priority Queue ({priorityItems.length})</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {loadingAttention ? (
          <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
            Evaluating corridor risks...
          </div>
        ) : priorityItems.length === 0 ? (
          <div style={{
            padding: "1.5rem",
            textAlign: "center",
            backgroundColor: "var(--status-stable-bg)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--status-stable-border)"
          }}>
            <CheckCircle2 size={24} color="var(--status-stable)" style={{ margin: "0 auto 0.35rem" }} />
            <div style={{ fontWeight: 700, color: "var(--status-stable)", fontSize: "0.9rem" }}>
              All Buffers Healthy &bull; No Open Bottlenecks
            </div>
            <div style={{ fontSize: "0.785rem", color: "var(--text-muted)" }}>
              No critical shortages or delayed movements requiring immediate controller intervention.
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "0.85rem" }}>
            {priorityItems.slice(0, 3).map((item) => (
              <div
                key={item.id}
                style={{
                  padding: "0.85rem 1rem",
                  backgroundColor: "var(--bg-card-light)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "0.5rem"
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                    <span className={`badge ${getPriorityBadgeClass(item.priority_rank)}`}>
                      {getPriorityLabel(item.priority_rank)}
                    </span>
                    <span className="mono" style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                      {item.item_type}
                    </span>
                  </div>

                  <h4 style={{ fontSize: "0.875rem", color: "var(--text-main)", marginBottom: "0.25rem", fontWeight: 700 }}>
                    {item.title}
                  </h4>

                  <p style={{ fontSize: "0.775rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                    {item.explanation}
                  </p>
                </div>

                <div style={{
                  paddingTop: "0.5rem",
                  borderTop: "1px solid var(--border-subtle)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <button
                    onClick={() => {
                      if (item.location_id) {
                        onNavigate("map-locations", "map", item.location_id);
                      } else {
                        onNavigate("predictions-alerts", "priority");
                      }
                    }}
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: "0.725rem", padding: "0.25rem 0.5rem" }}
                  >
                    <span>Inspect on Map</span>
                    <ArrowRight size={12} />
                  </button>

                  <button
                    onClick={() => onNavigate("predictions-alerts", "forecast", item.location_id || undefined)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: "0.725rem", padding: "0.25rem 0.5rem" }}
                  >
                    <span>Review Forecast</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Two-Column Middle: Compact Map Preview & Recent Activity */}
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "1.25rem" }}>
        
        {/* Left Column: Compact Geographic Overview */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <div>
              <h3 style={{ fontSize: "1rem" }}>Corridor Geographic Preview</h3>
              <p style={{ fontSize: "0.775rem", color: "var(--text-muted)" }}>
                Click any depot marker to view live stock and forward shortage risk.
              </p>
            </div>
            <button
              onClick={() => onNavigate("map-locations", "map")}
              className="btn btn-outline btn-sm"
            >
              <ExternalLink size={13} />
              <span>Full Interactive Map</span>
            </button>
          </div>

          <div
            ref={miniMapRef}
            style={{
              width: "100%",
              height: "260px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
              overflow: "hidden",
              zIndex: 1
            }}
          />

          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "0.65rem",
            fontSize: "0.725rem",
            color: "var(--text-muted)",
            flexWrap: "wrap",
            gap: "0.5rem"
          }}>
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#2D7D46", display: "inline-block" }}></span>
                Stable
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#C47F10", display: "inline-block" }}></span>
                Watch
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#B71C1C", display: "inline-block" }}></span>
                Critical
              </span>
            </div>
            <span className="mono">Bhor Ghat / NH48 Highway Segment</span>
          </div>
        </div>

        {/* Right Column: Recent Logistics Activity & Supply Balances */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          
          {/* Supply Balance Summary */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <h3 style={{ fontSize: "1rem" }}>Forward Inventory Balances</h3>
              <button
                onClick={() => onNavigate("map-locations", "inventory")}
                className="btn btn-outline btn-sm"
              >
                <span>Stock Ledgers</span>
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
              {categories.map((cat) => {
                const meta = categoryMeta[cat.category] || { label: cat.category, color: "var(--primary)" };
                const total = cat.total_available + cat.total_reserved;
                const reservedPct = total > 0 ? Math.round((cat.total_reserved / total) * 100) : 0;
                return (
                  <div key={cat.category} style={{
                    padding: "0.65rem 0.85rem",
                    backgroundColor: "var(--bg-card-light)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.775rem" }}>
                      <span style={{ fontWeight: 700, color: "var(--text-main)" }}>{meta.label}</span>
                      <span className="mono" style={{ fontWeight: 700, color: meta.color }}>
                        {cat.total_available.toLocaleString()} {cat.unit}
                      </span>
                    </div>
                    <div style={{
                      marginTop: "0.4rem",
                      height: "5px",
                      backgroundColor: "var(--border-subtle)",
                      borderRadius: "3px",
                      overflow: "hidden"
                    }}>
                      <div style={{
                        height: "100%",
                        width: `${100 - reservedPct}%`,
                        backgroundColor: meta.color
                      }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.25rem", fontSize: "0.7rem", color: "var(--text-muted)" }}>
                      <span>{cat.items_count} items</span>
                      <span>{reservedPct > 0 ? `${cat.total_reserved} reserved` : "Available"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Logistics Activity List */}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <h3 style={{ fontSize: "1rem" }}>Recent Logistics Activity</h3>
              <button
                onClick={() => onNavigate("map-locations", "events")}
                className="btn btn-outline btn-sm"
              >
                <span>All Movements</span>
              </button>
            </div>

            {recent_events.length === 0 ? (
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>No movements recorded today.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                {recent_events.slice(0, 3).map((ev) => (
                  <div key={ev.id} style={{
                    padding: "0.55rem 0.75rem",
                    backgroundColor: "var(--bg-card-light)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem"
                  }}>
                    <div style={{
                      padding: "0.3rem",
                      borderRadius: "4px",
                      backgroundColor: ev.event_type === "RECEIPT" ? "var(--status-stable-bg)" :
                                       ev.event_type === "DISPATCH" ? "var(--primary-light)" : "var(--status-watch-bg)",
                      color: ev.event_type === "RECEIPT" ? "var(--status-stable)" :
                             ev.event_type === "DISPATCH" ? "var(--primary)" : "var(--status-watch)"
                    }}>
                      {ev.event_type === "RECEIPT" ? <ArrowDownRight size={13} /> :
                       ev.event_type === "DISPATCH" ? <ArrowUpRight size={13} /> : <Clock size={13} />}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.785rem", color: "var(--text-main)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {ev.event_type}: {ev.quantity.toLocaleString()} {ev.unit} {ev.item_name}
                        </span>
                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginLeft: "0.4rem" }}>
                          {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.725rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {ev.source_location_name ? `@ ${ev.source_location_name}` : ""}
                        {ev.destination_location_name ? ` &rarr; ${ev.destination_location_name}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Question 3: Guided Planner Action Tray */}
      <div style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        padding: "1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.85rem"
      }}>
        <div>
          <h3 style={{ fontSize: "0.95rem", color: "var(--text-main)" }}>
            What can the planner examine next?
          </h3>
          <p style={{ fontSize: "0.785rem", color: "var(--text-muted)" }}>
            Select a guided workflow to inspect bottlenecks, evaluate forward projections, or test mitigation scenarios.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0.85rem" }}>
          
          <div 
            onClick={() => onNavigate("map-locations", "map")}
            style={{
              padding: "0.85rem",
              backgroundColor: "var(--bg-card-light)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
              cursor: "pointer",
              transition: "border-color 0.15s ease"
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--primary)"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border-subtle)"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--primary)", fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.3rem" }}>
              <Compass size={16} />
              <span>1. Inspect Corridor Geography</span>
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Explore OSM road segments, 30m elevation profiles, and depot stock health on the interactive map.
            </p>
          </div>

          <div 
            onClick={() => onNavigate("predictions-alerts", "forecast")}
            style={{
              padding: "0.85rem",
              backgroundColor: "var(--bg-card-light)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
              cursor: "pointer",
              transition: "border-color 0.15s ease"
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--primary)"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border-subtle)"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--primary)", fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.3rem" }}>
              <TrendingUp size={16} />
              <span>2. Review Forecasts &amp; Shortages</span>
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Examine Ridge demand forecasts, estimated days until stock runs low, and rolling anomaly flags.
            </p>
          </div>

          <div 
            onClick={() => onNavigate("plan-simulate", "scenarios")}
            style={{
              padding: "0.85rem",
              backgroundColor: "var(--bg-card-light)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-subtle)",
              cursor: "pointer",
              transition: "border-color 0.15s ease"
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--primary)"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border-subtle)"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--primary)", fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.3rem" }}>
              <GitBranch size={16} />
              <span>3. Simulate What-If Scenarios</span>
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Model weather disruptions, road closures, or surge demand, and run the SciPy HiGHS allocation solver.
            </p>
          </div>

        </div>
      </div>

    </div>
  );
};

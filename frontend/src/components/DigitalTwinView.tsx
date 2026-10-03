import React, { useState, useEffect } from "react";
import { 
  Cpu, Activity, Truck, Package, AlertTriangle, ShieldCheck, 
  ArrowRight, RefreshCw, Zap, TrendingDown, Layers, MapPin, 
  ChevronRight, Compass, Info, Play
} from "lucide-react";
import { 
  api, DigitalTwinResponse, DependencyGraphResponse, 
  RippleDisruptionSimulation, Location 
} from "../api/client";

interface DigitalTwinViewProps {
  locations: Location[];
  onNavigateTab: (tab: string, state?: any) => void;
}

export const DigitalTwinView: React.FC<DigitalTwinViewProps> = ({
  locations,
  onNavigateTab
}) => {
  const [twin, setTwin] = useState<DigitalTwinResponse | null>(null);
  const [depGraph, setDepGraph] = useState<DependencyGraphResponse | null>(null);
  const [rippleResult, setRippleResult] = useState<RippleDisruptionSimulation | null>(null);
  const [selectedDisruptedNode, setSelectedDisruptedNode] = useState<string>("");
  const [selectedDisruptedLink, setSelectedDisruptedLink] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSimulatingRipple, setIsSimulatingRipple] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchTwinData = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const [tData, gData] = await Promise.all([
        api.getDigitalTwin(),
        api.getDependencyGraph()
      ]);
      setTwin(tData);
      setDepGraph(gData);
      if (!selectedDisruptedNode && tData.nodes.length > 1) {
        setSelectedDisruptedNode(tData.nodes[1].id); // Default to Talegaon Strategic Depot
      }
    } catch (err: any) {
      console.error("Error loading digital twin:", err);
      setErrorMessage(err.message || "Failed to load Digital Twin workspace.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTwinData();
  }, []);

  const handleSimulateDisruption = async () => {
    if (!selectedDisruptedNode && !selectedDisruptedLink) return;
    try {
      setIsSimulatingRipple(true);
      const res = await api.simulateRippleDisruption({
        disrupted_node_id: selectedDisruptedNode || undefined,
        disrupted_link_id: selectedDisruptedLink || undefined
      });
      setRippleResult(res);
    } catch (err: any) {
      alert("Disruption simulation error: " + err.message);
    } finally {
      setIsSimulatingRipple(false);
    }
  };

  const handleLaunchScenarioFromDisruption = () => {
    // Navigate to scenarios tab with prefilled parameters
    onNavigateTab("scenarios", {
      disrupted_node: selectedDisruptedNode,
      disrupted_link: selectedDisruptedLink,
      ripple_impact: rippleResult
    });
  };

  return (
    <div style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.75rem", maxWidth: "1600px", margin: "0 auto", width: "100%" }}>
      {/* Title & Mode Banner */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "1rem",
        backgroundColor: "#FFFFFF",
        padding: "1.25rem 1.75rem",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
        border: "1px solid var(--border-subtle)"
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <h1 style={{ fontSize: "1.45rem", fontWeight: 800, color: "var(--text-main)", margin: 0 }}>
              Logistics Digital Twin Workspace
            </h1>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.25rem 0.65rem",
              borderRadius: "4px",
              fontSize: "0.72rem",
              fontWeight: 800,
              backgroundColor: "var(--status-stable-bg)",
              color: "var(--status-stable)",
              border: "1px solid var(--status-stable-border)",
              letterSpacing: "0.04em"
            }}>
              <ShieldCheck size={13} />
              RECORDED OPERATIONAL STATE
            </span>
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.35rem" }}>
            Real-time synchronization of forward inventories, active convoys, stationed fleet resources, and topological corridor relationships.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            onClick={fetchTwinData}
            disabled={isLoading}
            className="btn btn-secondary btn-sm"
          >
            <RefreshCw size={13} className={isLoading ? "spin-animation" : ""} />
            <span>Sync Live Telemetry</span>
          </button>
          <button
            onClick={() => onNavigateTab("scenarios")}
            className="btn btn-primary btn-sm"
            style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            <Cpu size={14} />
            <span>Launch What-If Simulator</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div style={{ padding: "1rem", backgroundColor: "var(--status-critical-bg)", color: "var(--status-critical)", borderRadius: "var(--radius-md)", border: "1px solid var(--status-critical-border)" }}>
          {errorMessage}
        </div>
      )}

      {/* KPI Status Strip */}
      {twin && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1.25rem"
        }}>
          {/* Card 1: Forward Nodes */}
          <div style={{
            backgroundColor: "#FFFFFF",
            padding: "1.25rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-sm)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-muted)" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>MONITORED FORWARD NODES</span>
              <Compass size={18} color="var(--primary)" />
            </div>
            <div style={{ fontSize: "1.9rem", fontWeight: 800, color: "var(--text-main)", marginTop: "0.4rem" }}>
              {twin.nodes_count} Nodes
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.3rem" }}>
              Hinjewadi &bull; Talegaon &bull; Lonavala &bull; Mulshi
            </div>
          </div>

          {/* Card 2: Transport Fleet */}
          <div style={{
            backgroundColor: "#FFFFFF",
            padding: "1.25rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-sm)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-muted)" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>TACTICAL FLEET INVENTORY</span>
              <Truck size={18} color="var(--primary)" />
            </div>
            <div style={{ fontSize: "1.9rem", fontWeight: 800, color: "var(--text-main)", marginTop: "0.4rem" }}>
              {twin.active_fleet_count} / {twin.fleet.length} Available
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.3rem" }}>
              Total Payload: {(twin.network_summary.total_fleet_capacity_kg / 1000).toFixed(1)} Metric Tons
            </div>
          </div>

          {/* Card 3: In-Transit Convoys */}
          <div style={{
            backgroundColor: "#FFFFFF",
            padding: "1.25rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-sm)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-muted)" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>ACTIVE TRANSIT CONVOYS</span>
              <Activity size={18} color="var(--primary)" />
            </div>
            <div style={{ fontSize: "1.9rem", fontWeight: 800, color: "var(--text-main)", marginTop: "0.4rem" }}>
              {twin.in_transit_convoys_count} En Route
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.3rem" }}>
              Live dispatch missions tracked on GIS map
            </div>
          </div>

          {/* Card 4: Shortages & Alerts */}
          <div style={{
            backgroundColor: "#FFFFFF",
            padding: "1.25rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-sm)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-muted)" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>OPEN SHORTAGE RISKS</span>
              <AlertTriangle size={18} color="var(--status-critical)" />
            </div>
            <div style={{ fontSize: "1.9rem", fontWeight: 800, color: twin.open_alerts_count > 0 ? "var(--status-critical)" : "var(--status-stable)", marginTop: "0.4rem" }}>
              {twin.open_alerts_count} Alerts
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.3rem" }}>
              14-Day Ridge ML demand projections
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Twin Nodes Table + Supply-Chain Ripple Simulator */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.75rem" }}>
        {/* Left Column: Recorded Forward Nodes Ledger */}
        <div style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-sm)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}>
          <div style={{
            padding: "1.2rem 1.5rem",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "var(--bg-card-light)"
          }}>
            <div>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                Forward Node Digital States
              </h2>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Live stock levels, burn rates & stationed tactical fleet
              </span>
            </div>
            <button
              onClick={() => onNavigateTab("inventory")}
              className="btn btn-secondary btn-sm"
            >
              Open Inventory Ledger
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.825rem" }}>
              <thead>
                <tr style={{ backgroundColor: "#FDFBF7", borderBottom: "1px solid var(--border-subtle)", textAlign: "left" }}>
                  <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Location Node</th>
                  <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Type</th>
                  <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Available Stock</th>
                  <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Stationed Fleet</th>
                  <th style={{ padding: "0.75rem 1rem", fontWeight: 700 }}>Risk State</th>
                </tr>
              </thead>
              <tbody>
                {twin?.nodes.map((node) => (
                  <tr key={node.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <div style={{ fontWeight: 700, color: "var(--text-main)" }}>{node.name}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                        {node.id} &bull; Elev: {node.elevation_m || 600}m
                      </div>
                    </td>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <span style={{
                        padding: "0.2rem 0.5rem",
                        borderRadius: "4px",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        backgroundColor: "var(--bg-card)",
                        color: "var(--text-main)"
                      }}>
                        {node.type}
                      </span>
                    </td>
                    <td style={{ padding: "0.85rem 1rem", fontWeight: 700 }}>
                      {node.total_available_stock.toLocaleString()} units
                    </td>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                        <Truck size={14} color="var(--primary)" />
                        <strong>{node.stationed_fleet_count}</strong> vehicles
                      </span>
                    </td>
                    <td style={{ padding: "0.85rem 1rem" }}>
                      <span style={{
                        padding: "0.2rem 0.55rem",
                        borderRadius: "4px",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        backgroundColor: node.categories_at_risk > 0 ? "var(--status-critical-bg)" : "var(--status-stable-bg)",
                        color: node.categories_at_risk > 0 ? "var(--status-critical)" : "var(--status-stable)",
                        border: `1px solid ${node.categories_at_risk > 0 ? "var(--status-critical-border)" : "var(--status-stable-border)"}`
                      }}>
                        {node.categories_at_risk > 0 ? `${node.categories_at_risk} AT RISK` : "STABLE"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Feature 5 — Supply-Chain Dependency & Ripple-Effect Analysis */}
        <div style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-sm)",
          display: "flex",
          flexDirection: "column"
        }}>
          <div style={{
            padding: "1.2rem 1.5rem",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "var(--bg-card-light)"
          }}>
            <div>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
                Feature 5 &bull; Supply-Chain Ripple Effect Simulator
              </h2>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Evaluate hypothetical failure of a key depot or road link
              </span>
            </div>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
              fontSize: "0.72rem",
              fontWeight: 700,
              backgroundColor: "var(--primary-light)",
              color: "var(--primary-dark)",
              padding: "0.2rem 0.5rem",
              borderRadius: "4px"
            }}>
              <Zap size={12} />
              DYNAMIC PROPAGATION
            </div>
          </div>

          <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Disruption Target Selection */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "0.35rem" }}>
                  Disrupt Supply Depot Node:
                </label>
                <select
                  value={selectedDisruptedNode}
                  onChange={(e) => {
                    setSelectedDisruptedNode(e.target.value);
                    setSelectedDisruptedLink("");
                  }}
                  style={{
                    width: "100%",
                    padding: "0.55rem 0.75rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-strong)",
                    backgroundColor: "#FFFFFF",
                    fontSize: "0.85rem"
                  }}
                >
                  <option value="">-- None / Select Node --</option>
                  {twin?.nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({n.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "0.35rem" }}>
                  Or Block Corridor Link:
                </label>
                <select
                  value={selectedDisruptedLink}
                  onChange={(e) => {
                    setSelectedDisruptedLink(e.target.value);
                    setSelectedDisruptedNode("");
                  }}
                  style={{
                    width: "100%",
                    padding: "0.55rem 0.75rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-strong)",
                    backgroundColor: "#FFFFFF",
                    fontSize: "0.85rem"
                  }}
                >
                  <option value="">-- None / Select Link --</option>
                  {twin?.active_routes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.distance_km} km)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleSimulateDisruption}
              disabled={isSimulatingRipple || (!selectedDisruptedNode && !selectedDisruptedLink)}
              className="btn btn-primary"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                padding: "0.65rem 1.25rem"
              }}
            >
              <Play size={15} />
              <span>{isSimulatingRipple ? "Computing Downstream Ripple..." : "Run Downstream Ripple Simulation"}</span>
            </button>

            {/* Ripple Simulation Results */}
            {rippleResult ? (
              <div style={{
                marginTop: "0.5rem",
                padding: "1.2rem",
                backgroundColor: "var(--bg-card-light)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-strong)",
                display: "flex",
                flexDirection: "column",
                gap: "1rem"
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)" }}>
                    Disruption Ripple Impact Assessment
                  </div>
                  <span style={{
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    color: "var(--status-critical)",
                    backgroundColor: "var(--status-critical-bg)",
                    padding: "0.2rem 0.6rem",
                    borderRadius: "4px"
                  }}>
                    +{rippleResult.total_unmet_demand_delta.toFixed(0)} Units Shortage Shock
                  </span>
                </div>

                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                  {rippleResult.acceleration_summary}
                </p>

                {/* Downstream Affected Nodes */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>
                    DOWNSTREAM DEPLETION ACCELERATION:
                  </span>
                  {rippleResult.affected_nodes.map((aff) => (
                    <div
                      key={aff.node_id}
                      style={{
                        padding: "0.75rem",
                        backgroundColor: "#FFFFFF",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-subtle)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between"
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.825rem", color: "var(--text-main)" }}>
                          {aff.node_name}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                          {aff.rationale}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          Days to stock-out:
                        </div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--status-critical)" }}>
                          {aff.baseline_days_to_shortage}d &rarr; {aff.projected_days_to_shortage}d
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action button to prefill scenario */}
                <button
                  onClick={handleLaunchScenarioFromDisruption}
                  className="btn btn-secondary btn-sm"
                  style={{ alignSelf: "flex-end", display: "flex", alignItems: "center", gap: "0.4rem" }}
                >
                  <span>Model Mitigation in What-If Simulator</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            ) : (
              <div style={{
                padding: "2rem",
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: "0.85rem",
                backgroundColor: "var(--bg-card-light)",
                borderRadius: "var(--radius-md)",
                border: "1px dashed var(--border-strong)"
              }}>
                Select a supply depot (e.g. Talegaon Strategic Depot) or road conduit above and run simulation to inspect downstream vulnerability.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Network Provenance and Mathematical Notice */}
      <div style={{
        padding: "1rem 1.5rem",
        backgroundColor: "#FFFFFF",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "1rem",
        fontSize: "0.785rem",
        color: "var(--text-muted)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Info size={15} color="var(--primary)" />
          <span>
            <strong>Digital Twin Transparency:</strong> Recorded states reflect transactional ledger facts. Modeled projections use Ridge 14-day demand inference and SciPy HiGHS exact LP routing.
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span>OSM Roads (ODbL 1.0)</span>
          <span>NASA SRTMGL1 (30m)</span>
          <span>Decision Support Only</span>
        </div>
      </div>
    </div>
  );
};

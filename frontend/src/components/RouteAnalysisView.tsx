import React, { useState, useEffect } from "react";
import { 
  Navigation, MapPin, Compass, ArrowRight, Activity, 
  Mountain, AlertTriangle, ShieldCheck, CheckCircle2, 
  XCircle, Info, RefreshCw, Layers 
} from "lucide-react";
import { 
  api, RouteAnalysisResponse, RouteCandidate, Location, CorridorRouteSegment 
} from "../api/client";

interface RouteAnalysisViewProps {
  locations: Location[];
}

export const RouteAnalysisView: React.FC<RouteAnalysisViewProps> = ({ locations }) => {
  const [originId, setOriginId] = useState<string>("LOC-PUN-01");
  const [destId, setDestId] = useState<string>("LOC-LON-03");
  const [avoidExpressway, setAvoidExpressway] = useState<boolean>(false);
  const [maxSlope, setMaxSlope] = useState<number>(15.0);
  const [analysisResult, setAnalysisResult] = useState<RouteAnalysisResponse | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [networkInfo, setNetworkInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleAnalyze = async () => {
    try {
      setIsLoading(true);
      const avoids: string[] = [];
      if (avoidExpressway) avoids.push("expressway");

      const res = await api.analyzeRoutes({
        origin_location_id: originId,
        destination_location_id: destId,
        avoid_road_classes: avoids.length > 0 ? avoids : undefined,
        max_gradient_pct: maxSlope < 15.0 ? maxSlope : undefined
      });
      setAnalysisResult(res);
      if (res.candidate_routes.length > 0) {
        setSelectedRouteId(res.recommended_route_id || res.candidate_routes[0].route_id);
      }
    } catch (err: any) {
      alert("Route analysis failed: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleAnalyze();
    api.getNetworkConnectivity().then(setNetworkInfo).catch(console.error);
  }, [originId, destId]);

  const selectedCandidate = analysisResult?.candidate_routes.find(r => r.route_id === selectedRouteId);

  // SVG Elevation Profile Chart Generator
  const renderElevationChart = (candidate: RouteCandidate) => {
    const pts = candidate.elevation_profile;
    if (!pts || pts.length === 0) return null;

    const minElev = Math.min(...pts.map(p => p.elevation_m));
    const maxElev = Math.max(...pts.map(p => p.elevation_m));
    const maxDist = Math.max(...pts.map(p => p.distance_km), 1.0);
    const chartHeight = 140;
    const chartWidth = 560;
    const padding = 25;

    const scaleX = (d: number) => padding + (d / maxDist) * (chartWidth - padding * 2);
    const scaleY = (e: number) => {
      const span = Math.max(maxElev - minElev, 20.0);
      return chartHeight - padding - ((e - minElev) / span) * (chartHeight - padding * 2);
    };

    const polylinePts = pts.map(p => `${scaleX(p.distance_km)},${scaleY(p.elevation_m)}`).join(" ");
    const areaPts = `${scaleX(0)},${chartHeight - padding} ` + polylinePts + ` ${scaleX(maxDist)},${chartHeight - padding}`;

    return (
      <div style={{ marginTop: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
          <span><strong>SRTMGL1 Elevation Profile:</strong> {pts[0].elevation_m}m &rarr; {pts[pts.length - 1].elevation_m}m</span>
          <span>Gain: +{candidate.elevation_gain_m}m &bull; Max Grade: {candidate.max_slope_pct}%</span>
        </div>
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: "100%", height: "140px", backgroundColor: "#FDFBF7", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
          {/* Fill Area */}
          <polygon points={areaPts} fill="rgba(201, 111, 61, 0.15)" />
          {/* Line */}
          <polyline points={polylinePts} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" />
          {/* Elevation Points */}
          {pts.map((p, i) => (
            <circle key={i} cx={scaleX(p.distance_km)} cy={scaleY(p.elevation_m)} r="3" fill="var(--primary-dark)" />
          ))}
          {/* Axis Labels */}
          <text x={padding} y={chartHeight - 6} fontSize="9" fill="#8E8478">0 km ({minElev.toFixed(0)}m)</text>
          <text x={chartWidth - padding - 40} y={chartHeight - 6} fontSize="9" fill="#8E8478">{maxDist.toFixed(1)} km ({maxElev.toFixed(0)}m)</text>
        </svg>
      </div>
    );
  };

  return (
    <div style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.75rem", maxWidth: "1600px", margin: "0 auto", width: "100%" }}>
      {/* Top Banner */}
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
              Road Network & Route Comparison Intelligence
            </h1>
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.25rem 0.65rem",
              borderRadius: "4px",
              fontSize: "0.72rem",
              fontWeight: 800,
              backgroundColor: "var(--bg-card)",
              color: "var(--text-main)",
              border: "1px solid var(--border-strong)",
              letterSpacing: "0.04em"
            }}>
              <Mountain size={13} color="var(--primary)" />
              NASA SRTMGL1 (30m) + OSM ROADS
            </span>
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.35rem" }}>
            Compare distance, travel time, elevation profiles and gradient constraints across corridor corridors.
          </p>
        </div>

        {networkInfo && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.78rem" }}>
            <span style={{ padding: "0.3rem 0.6rem", backgroundColor: "var(--status-stable-bg)", color: "var(--status-stable)", borderRadius: "4px", fontWeight: 700 }}>
              {networkInfo.active_corridor_segments} Corridor Segments Verified
            </span>
            <span style={{ padding: "0.3rem 0.6rem", backgroundColor: "var(--bg-card-light)", color: "var(--text-muted)", borderRadius: "4px" }}>
              Total: {networkInfo.total_corridor_length_km} km
            </span>
          </div>
        )}
      </div>

      {/* Query Selector Bar */}
      <div style={{
        backgroundColor: "#FFFFFF",
        padding: "1.25rem 1.75rem",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-sm)",
        display: "grid",
        gridTemplateColumns: "1fr 1fr auto auto auto",
        alignItems: "flex-end",
        gap: "1.25rem"
      }}>
        <div>
          <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "0.35rem" }}>
            Origin Forward Node:
          </label>
          <select
            value={originId}
            onChange={(e) => setOriginId(e.target.value)}
            style={{ width: "100%", padding: "0.55rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-strong)", fontSize: "0.85rem" }}
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} ({loc.id})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "0.35rem" }}>
            Destination Node:
          </label>
          <select
            value={destId}
            onChange={(e) => setDestId(e.target.value)}
            style={{ width: "100%", padding: "0.55rem 0.75rem", borderRadius: "var(--radius-md)", border: "1px solid var(--border-strong)", fontSize: "0.85rem" }}
          >
            {locations.filter(l => l.id !== originId).map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} ({loc.id})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-main)", cursor: "pointer", paddingBottom: "0.55rem" }}>
            <input
              type="checkbox"
              checked={avoidExpressway}
              onChange={(e) => setAvoidExpressway(e.target.checked)}
            />
            <span>Avoid Expressway</span>
          </label>
        </div>

        <div style={{ minWidth: "140px" }}>
          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "0.2rem" }}>
            Max Gradient: {maxSlope.toFixed(0)}%
          </label>
          <input
            type="range"
            min="4.0"
            max="18.0"
            step="1.0"
            value={maxSlope}
            onChange={(e) => setMaxSlope(parseFloat(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>

        <button
          onClick={handleAnalyze}
          disabled={isLoading}
          className="btn btn-primary"
          style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.6rem 1.25rem" }}
        >
          <RefreshCw size={14} className={isLoading ? "spin-animation" : ""} />
          <span>Compare Routes</span>
        </button>
      </div>

      {/* Candidate Routes Grid */}
      {analysisResult && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "1.5rem" }}>
          {analysisResult.candidate_routes.map((candidate) => {
            const isSelected = selectedRouteId === candidate.route_id;
            const isRecommended = analysisResult.recommended_route_id === candidate.route_id;

            return (
              <div
                key={candidate.route_id}
                onClick={() => setSelectedRouteId(candidate.route_id)}
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: "var(--radius-lg)",
                  border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border-subtle)",
                  boxShadow: isSelected ? "var(--shadow-md)" : "var(--shadow-sm)",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  position: "relative"
                }}
              >
                {/* Badges */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    {isRecommended && (
                      <span style={{
                        padding: "0.2rem 0.5rem",
                        backgroundColor: "var(--status-stable-bg)",
                        color: "var(--status-stable)",
                        border: "1px solid var(--status-stable-border)",
                        borderRadius: "4px",
                        fontSize: "0.7rem",
                        fontWeight: 800
                      }}>
                        RECOMMENDED CANDIDATE
                      </span>
                    )}
                    <span style={{
                      padding: "0.2rem 0.5rem",
                      backgroundColor: candidate.is_feasible ? "var(--primary-light)" : "var(--status-critical-bg)",
                      color: candidate.is_feasible ? "var(--primary-dark)" : "var(--status-critical)",
                      borderRadius: "4px",
                      fontSize: "0.7rem",
                      fontWeight: 700
                    }}>
                      {candidate.is_feasible ? "FEASIBLE" : "CONSTRAINED"}
                    </span>
                  </div>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {candidate.route_id}
                  </span>
                </div>

                <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-main)", margin: "0 0 0.5rem 0", lineHeight: 1.3 }}>
                  {candidate.name}
                </h3>

                {/* Metrics Matrix */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "0.5rem",
                  backgroundColor: "var(--bg-card-light)",
                  padding: "0.75rem",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                  margin: "0.5rem 0"
                }}>
                  <div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>DISTANCE</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-main)" }}>
                      {candidate.distance_km} km
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>EST. TIME</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-main)" }}>
                      {candidate.estimated_duration_min} min
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>MAX GRADE</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 800, color: candidate.max_slope_pct > 8.0 ? "var(--primary)" : "var(--text-main)" }}>
                      {candidate.max_slope_pct}%
                    </div>
                  </div>
                </div>

                {/* Road Classes Tags */}
                <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
                  {candidate.road_classes.map((c, i) => (
                    <span key={i} style={{ fontSize: "0.68rem", padding: "0.15rem 0.4rem", backgroundColor: "var(--bg-card)", borderRadius: "3px", fontWeight: 600 }}>
                      {c.toUpperCase()}
                    </span>
                  ))}
                  <span style={{ fontSize: "0.68rem", padding: "0.15rem 0.4rem", backgroundColor: "#F0EAE1", color: "var(--text-muted)", borderRadius: "3px" }}>
                    Gain: +{candidate.elevation_gain_m}m
                  </span>
                </div>

                {/* Elevation Profile Chart */}
                {renderElevationChart(candidate)}

                {/* Operational Explanation */}
                <p style={{ fontSize: "0.785rem", color: "var(--text-muted)", margin: "0.85rem 0 0 0", lineHeight: 1.4 }}>
                  {candidate.explanation}
                </p>

                {candidate.unfeasible_reason && (
                  <div style={{
                    marginTop: "0.75rem",
                    padding: "0.5rem 0.75rem",
                    backgroundColor: "var(--status-critical-bg)",
                    color: "var(--status-critical)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.75rem",
                    fontWeight: 600
                  }}>
                    Constraint Warning: {candidate.unfeasible_reason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Feature 4 Operational Disclaimer & Data Grounding Notice */}
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
            <strong>Operational Advisory:</strong> A candidate route is not operationally approved or certified safe solely because it scores favorably in topological models. Field verification and recon required for actual convoy movement.
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span>OpenStreetMap (ODbL)</span>
          <span>NASA SRTMGL1 (30m Elevation)</span>
        </div>
      </div>
    </div>
  );
};

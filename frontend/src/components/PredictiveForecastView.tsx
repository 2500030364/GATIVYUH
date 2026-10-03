import React, { useState, useEffect } from "react";
import { 
  TrendingUp, Calendar, AlertOctagon, ShieldCheck, 
  BarChart3, Info, AlertTriangle, ArrowRight, Activity
} from "lucide-react";
import { Location, ForecastResponse, ModelEvaluation, RiskAssessment, api } from "../api/client";

interface PredictiveForecastViewProps {
  locations: Location[];
  initialLocationId?: string;
}

export const PredictiveForecastView: React.FC<PredictiveForecastViewProps> = ({ locations, initialLocationId }) => {
  const [selectedLoc, setSelectedLoc] = useState<string>(initialLocationId || locations[0]?.id || "LOC-PUN-01");
  const [selectedCat, setSelectedCat] = useState<string>("FUEL");
  const [horizonDays, setHorizonDays] = useState<number>(14);
  const [showModelDetails, setShowModelDetails] = useState<boolean>(false);

  useEffect(() => {
    if (initialLocationId) {
      setSelectedLoc(initialLocationId);
    }
  }, [initialLocationId]);

  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment | null>(null);
  const [monitoringMetrics, setMonitoringMetrics] = useState<ModelEvaluation[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [fResp, rResp, mResp] = await Promise.all([
        api.getDemandForecast(selectedLoc, selectedCat, horizonDays),
        api.getRiskAssessments({ location_id: selectedLoc, category: selectedCat }),
        api.getModelMonitoringMetrics({ location_id: selectedLoc, category: selectedCat }),
      ]);
      setForecast(fResp);
      setRiskAssessment(rResp[0] || null);
      setMonitoringMetrics(mResp);
    } catch (err) {
      console.error("Failed to load forecast data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedLoc, selectedCat, horizonDays]);

  // SVG Chart Dimensions & Computations
  const renderChart = () => {
    if (!forecast) return null;
    if (forecast.insufficient_data) {
      return (
        <div style={{
          padding: "3rem 2rem",
          textAlign: "center",
          backgroundColor: "var(--bg-card-light)",
          borderRadius: "var(--radius-lg)",
          border: "1px dashed var(--border-strong)"
        }}>
          <AlertTriangle size={32} color="var(--status-watch)" style={{ margin: "0 auto 0.5rem" }} />
          <h3 style={{ color: "var(--text-main)" }}>Insufficient Historical Telemetry</h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", maxWidth: "480px", margin: "0.5rem auto" }}>
            {forecast.data_limitation_note || "Minimum 5 continuous daily consumption records required. GATIVYUH does not invent synthetic predictions when actual data is lacking."}
          </p>
        </div>
      );
    }

    const hist = forecast.historical_series.slice(-21); // Last 21 historical days
    const pred = forecast.forecast_series;             // Forward forecast days

    const allValues = [
      ...hist.map(h => h.actual_demand),
      ...pred.map(p => p.predicted_demand),
      ...pred.map(p => p.upper_bound),
    ];
    const maxVal = Math.max(...allValues, 10.0) * 1.15;

    const width = 850;
    const height = 300;
    const padding = { top: 25, right: 30, bottom: 45, left: 55 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const totalPoints = hist.length + pred.length;
    const getX = (index: number) => padding.left + (index / (totalPoints - 1)) * chartWidth;
    const getY = (val: number) => padding.top + chartHeight - (val / maxVal) * chartHeight;

    // Build historical line
    const histPath = hist.map((h, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(h.actual_demand)}`).join(" ");

    // Build predicted line starting from last historical point
    const lastHistIdx = hist.length - 1;
    const predPointsWithConnect = [
      { x: getX(lastHistIdx), y: getY(hist[lastHistIdx].actual_demand) },
      ...pred.map((p, i) => ({ x: getX(lastHistIdx + 1 + i), y: getY(p.predicted_demand) }))
    ];
    const predPath = predPointsWithConnect.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ");

    // Build baseline line
    const baselinePath = pred.map((p, i) => `${i === 0 ? "M" : "L"} ${getX(lastHistIdx + 1 + i)} ${getY(p.baseline_demand)}`).join(" ");

    // Build uncertainty area polygon (upper to lower bound)
    const upperPoints = pred.map((p, i) => ({ x: getX(lastHistIdx + 1 + i), y: getY(p.upper_bound) }));
    const lowerPoints = pred.map((p, i) => ({ x: getX(lastHistIdx + 1 + i), y: getY(p.lower_bound) })).reverse();
    const areaPath = [
      `M ${upperPoints[0].x} ${upperPoints[0].y}`,
      ...upperPoints.slice(1).map(pt => `L ${pt.x} ${pt.y}`),
      ...lowerPoints.map(pt => `L ${pt.x} ${pt.y}`),
      "Z"
    ].join(" ");

    const splitX = getX(lastHistIdx);

    return (
      <div style={{ width: "100%", overflowX: "auto" }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto", minWidth: "650px" }}>
          {/* Y Axis Gridlines */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((pct, idx) => {
            const y = padding.top + chartHeight * (1 - pct);
            const val = Math.round(maxVal * pct);
            return (
              <g key={idx}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="var(--border-subtle)" strokeDasharray="3 3" />
                <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="var(--text-muted)" fontFamily="var(--font-mono)">
                  {val}
                </text>
              </g>
            );
          })}

          {/* Historical vs Forecast Boundary divider */}
          <line x1={splitX} y1={padding.top} x2={splitX} y2={height - padding.bottom} stroke="var(--primary)" strokeDasharray="4 4" strokeWidth="1.5" />
          <text x={splitX - 6} y={padding.top + 12} textAnchor="end" fontSize="11" fontWeight="700" fill="var(--text-muted)">
            Historical Observation
          </text>
          <text x={splitX + 6} y={padding.top + 12} textAnchor="start" fontSize="11" fontWeight="700" fill="var(--primary)">
            Forecast Horizon ({forecast.horizon_days}d)
          </text>

          {/* Uncertainty Confidence Band */}
          <path d={areaPath} fill="rgba(201, 111, 61, 0.15)" stroke="none" />

          {/* 7-Day Moving Average Baseline Line */}
          <path d={baselinePath} fill="none" stroke="#8E8478" strokeWidth="1.8" strokeDasharray="4 3" />

          {/* Historical Observed Demand Line */}
          <path d={histPath} fill="none" stroke="#302D2A" strokeWidth="2.5" />
          {hist.map((h, i) => (
            <circle key={i} cx={getX(i)} cy={getY(h.actual_demand)} r="3" fill="#302D2A" />
          ))}

          {/* Forecasted Demand Line */}
          <path d={predPath} fill="none" stroke="var(--primary)" strokeWidth="2.5" />
          {pred.map((p, i) => (
            <circle key={i} cx={getX(lastHistIdx + 1 + i)} cy={getY(p.predicted_demand)} r="3.5" fill="var(--primary)" />
          ))}

          {/* X Axis Labels */}
          {hist.filter((_, idx) => idx % 4 === 0).map((h, i) => (
            <text key={i} x={getX(i * 4)} y={height - padding.bottom + 18} textAnchor="middle" fontSize="10" fill="var(--text-muted)" fontFamily="var(--font-mono)">
              {h.date.slice(5)}
            </text>
          ))}
          {pred.filter((_, idx) => idx % 4 === 0).map((p, i) => (
            <text key={i} x={getX(lastHistIdx + 1 + i * 4)} y={height - padding.bottom + 18} textAnchor="middle" fontSize="10" fill="var(--primary)" fontFamily="var(--font-mono)" fontWeight="600">
              +{i * 4 + 1}d
            </text>
          ))}
        </svg>

        {/* Chart Legend */}
        <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem", marginTop: "0.5rem", fontSize: "0.75rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ width: "16px", height: "3px", backgroundColor: "#302D2A" }} />
            <span>Observed Historical Demand</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ width: "16px", height: "3px", backgroundColor: "var(--primary)" }} />
            <span>Ridge Regression Forecast ({forecast.model_name})</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ width: "16px", height: "8px", backgroundColor: "rgba(201, 111, 61, 0.25)", border: "1px solid rgba(201, 111, 61, 0.4)" }} />
            <span>95% Confidence Interval (±1.96σ)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ width: "16px", height: "2px", borderTop: "2px dashed #8E8478" }} />
            <span>7-Day Rolling Mean Baseline</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2>Predictive Demand Forecasting &amp; Depletion Telemetry</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Time-series burn rate modeling, confidence intervals, days-to-shortage estimation, and baseline accuracy benchmarks.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span className="badge badge-neutral">Model: RidgeTrendSeasonality_v1</span>
          <span className="badge badge-stable">Chronological 70/15/15 Split</span>
        </div>
      </div>

      {/* Control selectors */}
      <div className="card" style={{ padding: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" }}>
          
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Node:</span>
            <select
              className="form-control"
              value={selectedLoc}
              onChange={(e) => setSelectedLoc(e.target.value)}
              style={{ width: "auto", minWidth: "220px" }}
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.id})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Category:</span>
            <select
              className="form-control"
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              style={{ width: "auto" }}
            >
              <option value="FUEL">Petroleum &amp; Fuel</option>
              <option value="FOOD_WATER">Food &amp; Water</option>
              <option value="MEDICAL_SUPPLIES">Medical Supplies</option>
              <option value="GENERAL_SUPPLIES">General Supplies</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Forecast Horizon:</span>
            <div style={{ display: "flex", gap: "0.25rem" }}>
              {[7, 14, 30].map(h => (
                <button
                  key={h}
                  onClick={() => setHorizonDays(h)}
                  className={`btn btn-sm ${horizonDays === h ? "btn-primary" : "btn-secondary"}`}
                >
                  {h} Days
                </button>
              ))}
            </div>
          </div>

        </div>

        <button onClick={fetchData} className="btn btn-secondary btn-sm">
          Refresh Telemetry
        </button>
      </div>

      {/* Row 1: Days to Shortage & Risk Assessment Cards */}
      {riskAssessment && (
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 2fr", gap: "1.25rem" }}>
          
          {/* Days-to-Shortage Card */}
          <div className="card" style={{
            backgroundColor: riskAssessment.risk_state === "CRITICAL" ? "var(--status-critical-bg)" :
                             riskAssessment.risk_state === "AT_RISK" ? "var(--status-at-risk-bg)" :
                             riskAssessment.risk_state === "WATCH" ? "var(--status-watch-bg)" : "var(--status-stable-bg)",
            border: `1px solid ${
              riskAssessment.risk_state === "CRITICAL" ? "var(--status-critical-border)" :
              riskAssessment.risk_state === "AT_RISK" ? "var(--status-at-risk-border)" :
              riskAssessment.risk_state === "WATCH" ? "var(--status-watch-border)" : "var(--status-stable-border)"
            }`,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between"
          }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className={`badge badge-${riskAssessment.risk_state.toLowerCase()}`}>
                  {riskAssessment.risk_state}
                </span>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)" }}>
                  FEATURE 2: STOCKOUT ESTIMATION
                </span>
              </div>

              <div style={{ marginTop: "0.75rem" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Estimated days until stock runs low
                </div>
                <div style={{ fontSize: "2.4rem", fontWeight: 800, color: "var(--text-main)", lineHeight: 1.1 }}>
                  {riskAssessment.insufficient_data ? "Insufficient Data" :
                   riskAssessment.days_to_shortage !== null ? `${riskAssessment.days_to_shortage} Days` : "Stable Runway"}
                </div>
                {!riskAssessment.insufficient_data && riskAssessment.projected_stockout_date && (
                  <div style={{ fontSize: "0.8rem", color: "var(--text-main)", fontWeight: 600, marginTop: "0.25rem" }}>
                    Projected safety buffer breach: <strong>{riskAssessment.projected_stockout_date}</strong>
                  </div>
                )}
              </div>
            </div>

            <div style={{
              marginTop: "1rem",
              padding: "0.6rem 0.75rem",
              backgroundColor: "rgba(255,255,255,0.75)",
              borderRadius: "var(--radius-md)",
              fontSize: "0.75rem",
              color: "var(--text-main)"
            }}>
              <strong>Action Directive:</strong> {riskAssessment.recommended_action}
            </div>
          </div>

          {/* Explainable Contributing Factors Breakdown */}
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
              <h4>Explainable Contributing Factors &amp; Data Grounding</h4>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Calculated {new Date(riskAssessment.calculated_at).toLocaleTimeString()}
              </span>
            </div>

            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
              Transparent factor breakdown accounting for available stock, safety thresholds, forecast burn rate, and in-transit supply.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
              {riskAssessment.contributing_factors.map((factor, idx) => (
                <div key={idx} style={{
                  padding: "0.5rem 0.75rem",
                  backgroundColor: "var(--bg-card-light)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: "0.775rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem"
                }}>
                  <span style={{ color: "var(--primary)", fontWeight: 800 }}>&bull;</span>
                  <span>{factor}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Row 2: Main Time-Series Forecast Chart Card */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <h3>Demand Trajectory &amp; Horizon Projection</h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Actual historical consumption versus projected demand with 95% confidence bounds (±1.96σ) and moving average baseline.
            </p>
          </div>

          {forecast && (
            <span style={{
              fontSize: "0.725rem",
              padding: "0.2rem 0.5rem",
              borderRadius: "4px",
              backgroundColor: forecast.is_synthetic_input ? "var(--bg-card)" : "var(--status-stable-bg)",
              color: forecast.is_synthetic_input ? "var(--text-muted)" : "var(--status-stable)",
              fontWeight: 700
            }}>
              {forecast.is_synthetic_input ? "INPUT DATA: CALIBRATED SYNTHETIC" : "INPUT DATA: USER IMPORT"}
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
            Computing time-series models...
          </div>
        ) : (
          renderChart()
        )}
      </div>

      {/* Model Performance & Monitoring Benchmark (Expandable) */}
      <div className="card">
        <div 
          onClick={() => setShowModelDetails(!showModelDetails)}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
        >
          <div>
            <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.95rem" }}>
              <span>Forecast Model Performance &amp; Error Benchmarks</span>
              <span className="badge badge-neutral" style={{ fontSize: "0.68rem" }}>
                {showModelDetails ? "Hide Metrics" : "View Benchmark Metrics"}
              </span>
            </h3>
            <p style={{ fontSize: "0.785rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
              Measured against independent chronological holdout test partitions. Zero-leakage evaluation.
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" type="button">
            {showModelDetails ? "Collapse Details" : "Expand Metrics"}
          </button>
        </div>

        {showModelDetails && (
          <div style={{ marginTop: "1rem" }}>
            {monitoringMetrics.length === 0 ? (
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>No evaluation metrics recorded yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {monitoringMetrics.map((m) => (
                  <div key={m.id} style={{
                    padding: "0.85rem",
                    backgroundColor: "var(--bg-card-light)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)"
                  }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", textAlign: "center" }}>
                      
                      <div style={{ padding: "0.5rem", backgroundColor: "#FFFFFF", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700 }}>MODEL MAE (TEST)</div>
                        <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--primary)" }}>{m.mae}</div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Baseline: {m.baseline_mae}</div>
                      </div>

                      <div style={{ padding: "0.5rem", backgroundColor: "#FFFFFF", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700 }}>MODEL RMSE (TEST)</div>
                        <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--primary)" }}>{m.rmse}</div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Baseline: {m.baseline_rmse}</div>
                      </div>

                      <div style={{ padding: "0.5rem", backgroundColor: "#FFFFFF", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700 }}>WAPE ERROR</div>
                        <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-main)" }}>
                          {m.wape !== null ? `${m.wape}%` : "N/A"}
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Weighted Absolute Error</div>
                      </div>

                      <div style={{ padding: "0.5rem", backgroundColor: "#FFFFFF", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700 }}>MAPE (NON-ZERO)</div>
                        <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text-main)" }}>
                          {m.mape !== null ? `${m.mape}%` : "N/A"}
                        </div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Restricted to y &gt; 0</div>
                      </div>

                    </div>

                    {m.evaluation_notes && (
                      <div style={{ marginTop: "0.75rem", fontSize: "0.725rem", color: "var(--text-muted)", borderTop: "1px solid var(--border-subtle)", paddingTop: "0.5rem" }}>
                        <Info size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />
                        {m.evaluation_notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};

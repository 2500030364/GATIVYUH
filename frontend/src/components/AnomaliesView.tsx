import React, { useState } from "react";
import { Clock, AlertTriangle, AlertOctagon, CheckCircle2, Search, Filter, Info, ShieldAlert } from "lucide-react";
import { DemandAnomaly, api } from "../api/client";

interface AnomaliesViewProps {
  anomalies: DemandAnomaly[];
  onRefresh: () => void;
}

export const AnomaliesView: React.FC<AnomaliesViewProps> = ({ anomalies, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [ackFilter, setAckFilter] = useState("UNACKNOWLEDGED");

  const handleAcknowledge = async (id: number) => {
    try {
      await api.acknowledgeAnomaly(id);
      onRefresh();
    } catch (err: any) {
      alert("Failed to acknowledge anomaly: " + err.message);
    }
  };

  const filtered = anomalies.filter((a) => {
    const matchesSearch =
      a.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.location_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.location_name && a.location_name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesSev = severityFilter === "ALL" || a.severity === severityFilter;
    const matchesAck =
      ackFilter === "ALL" ||
      (ackFilter === "UNACKNOWLEDGED" && !a.is_acknowledged) ||
      (ackFilter === "ACKNOWLEDGED" && a.is_acknowledged);

    return matchesSearch && matchesSev && matchesAck;
  });

  return (
    <div style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2>Feature 3 &bull; Demand Anomaly Detection</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Rolling statistical Z-score baseline identifying consumption surges with explainable magnitude and non-alarmist severity.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <span className="badge badge-watch">
            {anomalies.filter(a => !a.is_acknowledged).length} Unacknowledged Spikes
          </span>
        </div>
      </div>

      {/* Advisory Banner */}
      <div style={{
        padding: "0.85rem 1rem",
        backgroundColor: "var(--bg-card-light)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-subtle)",
        fontSize: "0.775rem",
        color: "var(--text-muted)",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem"
      }}>
        <div style={{ color: "var(--primary)" }}>
          <ShieldAlert size={20} />
        </div>
        <div>
          <strong>Statistical Guardrail:</strong> Anomaly detection uses a 14-day preceding window to calculate expected bounds ($\mu \pm 2\sigma$). Per operational guidelines, unusual consumption increases are not automatically interpreted as emergency crises unless accompanied by critical safety buffer depletion.
        </div>
      </div>

      {/* Filter controls */}
      <div className="card" style={{ padding: "0.85rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: "260px" }}>
          <Search size={16} color="var(--primary)" />
          <input
            type="text"
            className="form-control"
            placeholder="Search anomalies by location or supply item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%", maxWidth: "340px" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Status:</span>
            <select
              className="form-control"
              value={ackFilter}
              onChange={(e) => setAckFilter(e.target.value)}
              style={{ width: "auto", padding: "0.4rem 0.6rem" }}
            >
              <option value="UNACKNOWLEDGED">Unacknowledged</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="ALL">All Anomalies</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Severity:</span>
            <select
              className="form-control"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              style={{ width: "auto", padding: "0.4rem 0.6rem" }}
            >
              <option value="ALL">All Severities</option>
              <option value="HIGH">HIGH (Z &ge; 3.0σ)</option>
              <option value="MEDIUM">MEDIUM (Z &ge; 2.2σ)</option>
              <option value="LOW">LOW</option>
            </select>
          </div>

          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>
            {filtered.length} anomalies
          </span>
        </div>
      </div>

      {/* Anomalies List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        {filtered.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
            <CheckCircle2 size={32} color="var(--status-stable)" style={{ margin: "0 auto 0.5rem" }} />
            <h3 style={{ color: "var(--status-stable)" }}>No Anomalies Detected</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              Consumption history across corridor nodes is consistent with rolling baseline parameters.
            </p>
          </div>
        ) : (
          filtered.map((a) => (
            <div
              key={a.id}
              className="card"
              style={{
                backgroundColor: a.is_acknowledged ? "#FFFFFF" :
                                 a.severity === "HIGH" ? "var(--status-at-risk-bg)" : "var(--bg-card-light)",
                border: `1px solid ${
                  a.is_acknowledged ? "var(--border-subtle)" :
                  a.severity === "HIGH" ? "var(--status-at-risk-border)" : "var(--border-strong)"
                }`,
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <span className={`badge ${a.severity === "HIGH" ? "badge-critical" : "badge-watch"}`}>
                    {a.severity} SEVERITY
                  </span>
                  {a.is_emergency && (
                    <span className="badge badge-critical" style={{ backgroundColor: "#B71C1C", color: "#FFFFFF" }}>
                      EMERGENCY SURGE
                    </span>
                  )}
                  <span style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text-main)" }}>
                    {a.location_name || a.location_id}
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    &bull; {a.item_name} ({a.category})
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Observed on: <strong>{a.anomaly_date}</strong>
                  </span>
                  {!a.is_acknowledged ? (
                    <button
                      onClick={() => handleAcknowledge(a.id)}
                      className="btn btn-secondary btn-sm"
                    >
                      <CheckCircle2 size={13} />
                      <span>Acknowledge</span>
                    </button>
                  ) : (
                    <span style={{ fontSize: "0.75rem", color: "var(--status-stable)", fontWeight: 700 }}>
                      &check; Acknowledged
                    </span>
                  )}
                </div>
              </div>

              {/* Observed vs Expected Baseline */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "0.75rem",
                padding: "0.75rem",
                backgroundColor: "#FFFFFF",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)"
              }}>
                <div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700 }}>OBSERVED VALUE</div>
                  <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--primary)" }}>{a.observed_value}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700 }}>EXPECTED BASELINE</div>
                  <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--text-main)" }}>{a.baseline_mean}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700 }}>EXPECTED BOUNDS</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-muted)", marginTop: "2px" }}>
                    [{a.expected_range_min}, {a.expected_range_max}]
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 700 }}>DEVIATION MAGNITUDE</div>
                  <div style={{ fontSize: "1.15rem", fontWeight: 800, color: a.z_score >= 3.0 ? "var(--status-critical)" : "var(--status-watch)" }}>
                    {(a.z_score >= 0 ? "+" : "") + a.z_score.toFixed(2)}σ ({(a.deviation_pct >= 0 ? "+" : "") + a.deviation_pct.toFixed(1)}%)
                  </div>
                </div>
              </div>

              {/* Explanation & Limitations */}
              <div>
                <p style={{ fontSize: "0.825rem", color: "var(--text-main)", lineHeight: 1.45 }}>
                  {a.explanation}
                </p>
                {a.limitations && (
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.3rem", fontStyle: "italic" }}>
                    <strong>Statistical limitation:</strong> {a.limitations}
                  </p>
                )}
              </div>

            </div>
          ))
        )}
      </div>

    </div>
  );
};

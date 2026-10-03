import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, ShieldCheck, Filter, Search } from "lucide-react";
import { Alert, api } from "../api/client";

interface AlertsViewProps {
  alerts: Alert[];
  onRefresh: () => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({ alerts, onRefresh }) => {
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");
  const [filterAck, setFilterAck] = useState<string>("ACTIVE");
  const [officerName, setOfficerName] = useState<string>("Commander Rao (Logistics Ops)");

  const handleAcknowledge = async (alertId: number) => {
    try {
      await api.acknowledgeAlert(alertId, officerName);
      onRefresh();
    } catch (err: any) {
      alert("Failed to acknowledge alert: " + err.message);
    }
  };

  const filtered = alerts.filter((al) => {
    const matchesSev = filterSeverity === "ALL" || al.severity === filterSeverity;
    const matchesAck =
      filterAck === "ALL" ||
      (filterAck === "ACTIVE" && !al.is_acknowledged) ||
      (filterAck === "ACKNOWLEDGED" && al.is_acknowledged);
    return matchesSev && matchesAck;
  });

  const activeCount = alerts.filter(a => !a.is_acknowledged).length;
  const criticalCount = alerts.filter(a => !a.is_acknowledged && a.severity === "CRITICAL").length;

  return (
    <div style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2>Stock Threshold Alerts Center</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Deterministic rule-based safety buffer monitors (Immediate safety stock indicators).
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.6rem" }}>
          <span className="badge badge-critical" style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}>
            {criticalCount} Critical Deficits
          </span>
          <span className="badge badge-watch" style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}>
            {activeCount - criticalCount} Advisory Warnings
          </span>
        </div>
      </div>

      {/* Rationale Notice */}
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
          <ShieldCheck size={20} />
        </div>
        <div>
          <strong>Operational Threshold Rules:</strong> Alerts trigger when available stock drops below the configured minimum safety buffer (<code>available_stock &lt; min_stock</code>). Severe deficit is flagged when stock drops below 25% of the minimum threshold. Forward shortage trajectories and demand forecasts are available in Demand Forecasts.
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Status:</span>
            <select
              className="form-control"
              value={filterAck}
              onChange={(e) => setFilterAck(e.target.value)}
              style={{ width: "auto", padding: "0.4rem 0.6rem" }}
            >
              <option value="ACTIVE">Active Alerts Only</option>
              <option value="ACKNOWLEDGED">Acknowledged History</option>
              <option value="ALL">All Alerts</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Severity:</span>
            <select
              className="form-control"
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              style={{ width: "auto", padding: "0.4rem 0.6rem" }}
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">CRITICAL (&lt; 25% Min)</option>
              <option value="AT_RISK">AT RISK (&lt; Min)</option>
              <option value="WATCH">WATCH (Near Min)</option>
            </select>
          </div>

        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Duty Officer:</span>
          <input
            type="text"
            className="form-control"
            value={officerName}
            onChange={(e) => setOfficerName(e.target.value)}
            style={{ width: "220px", padding: "0.35rem 0.6rem", fontSize: "0.8rem" }}
          />
        </div>
      </div>

      {/* Alerts List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        {filtered.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
            <CheckCircle2 size={32} color="var(--status-stable)" style={{ margin: "0 auto 0.5rem" }} />
            <h3 style={{ color: "var(--status-stable)" }}>No Active Alerts</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              All inventory levels in the corridor are maintained above configured safety buffers.
            </p>
          </div>
        ) : (
          filtered.map((al) => (
            <div
              key={al.id}
              className="card"
              style={{
                backgroundColor: al.is_acknowledged ? "#FFFFFF" :
                                 al.severity === "CRITICAL" ? "var(--status-critical-bg)" : "var(--status-at-risk-bg)",
                border: `1px solid ${
                  al.is_acknowledged ? "var(--border-subtle)" :
                  al.severity === "CRITICAL" ? "var(--status-critical-border)" : "var(--status-at-risk-border)"
                }`,
                display: "flex",
                flexDirection: "column",
                gap: "0.6rem"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <span className={`badge badge-${al.severity.toLowerCase()}`}>
                    {al.severity}
                  </span>
                  <span style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text-main)" }}>
                    {al.location_name || al.location_id}
                  </span>
                  <span className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    ({al.location_id})
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Triggered: {new Date(al.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>

                  {!al.is_acknowledged ? (
                    <button
                      onClick={() => handleAcknowledge(al.id)}
                      className="btn btn-primary btn-sm"
                    >
                      <CheckCircle2 size={13} />
                      <span>Acknowledge Alert</span>
                    </button>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", color: "var(--status-stable)", fontWeight: 700 }}>
                      <CheckCircle2 size={14} />
                      <span>Acknowledged by {al.acknowledged_by} ({new Date(al.acknowledged_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Reason & Quantities */}
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.6rem 0.85rem",
                backgroundColor: "rgba(255,255,255,0.7)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)",
                flexWrap: "wrap",
                gap: "0.5rem"
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-main)" }}>
                    Supply Line: {al.category.replace("_", " ")} &bull; {al.item_name || "Bulk Stock"}
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                    {al.reason}
                  </p>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Current Level / Safety Threshold</div>
                  <div style={{ fontWeight: 800, fontSize: "1.1rem", color: al.severity === "CRITICAL" ? "var(--status-critical)" : "var(--status-at-risk)" }}>
                    {al.current_quantity.toLocaleString()} / {al.min_threshold.toLocaleString()} {al.unit}
                  </div>
                </div>
              </div>

            </div>
          ))
        )}
      </div>

    </div>
  );
};

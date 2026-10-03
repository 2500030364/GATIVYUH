import React, { useState } from "react";
import { 
  AlertOctagon, AlertTriangle, Clock, Truck, Database, 
  CheckCircle2, UserCheck, ShieldAlert, ArrowRight, History, X, RefreshCw
} from "lucide-react";
import { PriorityQueueItem, api } from "../api/client";

interface PriorityQueueViewProps {
  items: PriorityQueueItem[];
  onRefresh: () => void;
  onNavigateTab: (tab: string) => void;
}

export const PriorityQueueView: React.FC<PriorityQueueViewProps> = ({ items, onRefresh, onNavigateTab }) => {
  const [urgencyFilter, setUrgencyFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedAuditItem, setSelectedAuditItem] = useState<PriorityQueueItem | null>(null);

  // Action modal
  const [actionItem, setActionItem] = useState<PriorityQueueItem | null>(null);
  const [actionType, setActionType] = useState<string>("ACKNOWLEDGE");
  const [reviewerName, setReviewerName] = useState<string>("Major Verma");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRebuilding, setIsRebuilding] = useState(false);

  const handleOpenAction = (item: PriorityQueueItem, type: string) => {
    setActionItem(item);
    setActionType(type);
    setReviewerName(item.assigned_reviewer || "Major Verma (Staff Ops)");
    setNotes("");
  };

  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionItem) return;
    setIsSubmitting(true);
    try {
      await api.actionPriorityQueueItem(actionItem.id, actionType, reviewerName, notes);
      setActionItem(null);
      onRefresh();
    } catch (err: any) {
      alert("Failed to update queue item: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRebuildQueue = async () => {
    setIsRebuilding(true);
    try {
      await api.getPriorityQueue({ rebuild: true });
      onRefresh();
    } catch (err: any) {
      alert("Failed to rebuild queue: " + err.message);
    } finally {
      setIsRebuilding(false);
    }
  };

  const filtered = items.filter((item) => {
    const matchesUrgency = urgencyFilter === "ALL" || item.urgency === urgencyFilter;
    const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;
    return matchesUrgency && matchesStatus;
  });

  const getItemTypeBadge = (type: string) => {
    switch (type) {
      case "IMMINENT_SHORTAGE":
        return <span className="badge badge-critical"><AlertOctagon size={12} /> Imminent Shortage (&le;3d)</span>;
      case "LOW_STOCK":
        return <span className="badge badge-at-risk"><AlertTriangle size={12} /> Low Stock (&lt;Min)</span>;
      case "DEMAND_ANOMALY":
        return <span className="badge badge-watch"><Clock size={12} /> Consumption Surge</span>;
      case "DELAYED_SUPPLY":
        return <span className="badge badge-watch"><Truck size={12} /> Convoy Delayed</span>;
      case "DATA_QUALITY":
        return <span className="badge badge-neutral"><Database size={12} /> Telemetry Gap</span>;
      default:
        return <span className="badge badge-neutral">{type}</span>;
    }
  };

  return (
    <div style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2>&ldquo;What Needs Attention?&rdquo; &bull; Priority Action Queue</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Real-time ranked queue prioritizing imminent stockouts, buffer breaches, demand anomalies, and delayed convoys.
          </p>
        </div>

        <button
          onClick={handleRebuildQueue}
          disabled={isRebuilding}
          className="btn btn-secondary btn-sm"
          title="Re-run explainable risk engine to update priority order"
        >
          <RefreshCw size={13} className={isRebuilding ? "spin-animation" : ""} />
          <span>{isRebuilding ? "Rebuilding Queue..." : "Re-evaluate Queue"}</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: "0.85rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Urgency:</span>
            <select
              className="form-control"
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value)}
              style={{ width: "auto", padding: "0.4rem 0.6rem" }}
            >
              <option value="ALL">All Urgencies</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Status:</span>
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: "auto", padding: "0.4rem 0.6rem" }}
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open (Needs Attention)</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>

        </div>

        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>
          {filtered.length} prioritized items
        </span>
      </div>

      {/* Queue Items List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        {filtered.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
            <CheckCircle2 size={32} color="var(--status-stable)" style={{ margin: "0 auto 0.5rem" }} />
            <h3 style={{ color: "var(--status-stable)" }}>Priority Queue Clear</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              No critical shortages, delayed shipments, or unacknowledged anomalies currently flagged.
            </p>
          </div>
        ) : (
          filtered.map((item, idx) => (
            <div
              key={item.id}
              className="card"
              style={{
                backgroundColor: item.status === "RESOLVED" ? "var(--bg-card-light)" : "#FFFFFF",
                borderLeft: `4px solid ${
                  item.urgency === "CRITICAL" ? "var(--status-critical)" :
                  item.urgency === "HIGH" ? "var(--status-at-risk)" :
                  item.urgency === "MEDIUM" ? "var(--status-watch)" : "var(--border-strong)"
                }`,
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                opacity: item.status === "RESOLVED" ? 0.75 : 1
              }}
            >
              {/* Item Top row */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                  <span style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    backgroundColor: "var(--bg-card)",
                    color: "var(--text-main)",
                    fontWeight: 800,
                    fontSize: "0.75rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--border-strong)"
                  }}>
                    #{item.priority_rank}
                  </span>

                  {getItemTypeBadge(item.item_type)}

                  <span style={{
                    fontSize: "0.725rem",
                    fontWeight: 700,
                    padding: "0.15rem 0.5rem",
                    borderRadius: "4px",
                    backgroundColor: item.status === "OPEN" ? "var(--status-critical-bg)" :
                                     item.status === "UNDER_REVIEW" ? "var(--status-watch-bg)" : "var(--status-stable-bg)",
                    color: item.status === "OPEN" ? "var(--status-critical)" :
                           item.status === "UNDER_REVIEW" ? "var(--status-watch)" : "var(--status-stable)"
                  }}>
                    {item.status.replace("_", " ")}
                  </span>

                  {item.assigned_reviewer && (
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      &bull; Assigned to: <strong>{item.assigned_reviewer}</strong>
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <button
                    onClick={() => setSelectedAuditItem(item)}
                    className="btn btn-secondary btn-sm"
                    title="View historical audit trail of actions"
                  >
                    <History size={13} />
                    <span>Audit Trail</span>
                  </button>

                  {item.status !== "RESOLVED" && (
                    <button
                      onClick={() => handleOpenAction(item, item.status === "OPEN" ? "ACKNOWLEDGE" : "RESOLVE")}
                      className="btn btn-primary btn-sm"
                    >
                      {item.status === "OPEN" ? "Acknowledge" : "Resolve Item"}
                    </button>
                  )}
                  {item.status === "OPEN" && (
                    <button
                      onClick={() => handleOpenAction(item, "ASSIGN")}
                      className="btn btn-secondary btn-sm"
                    >
                      Assign Reviewer
                    </button>
                  )}
                </div>
              </div>

              {/* Title & Explanation */}
              <div>
                <h4 style={{ fontSize: "1rem", color: "var(--text-main)" }}>{item.title}</h4>
                <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", marginTop: "0.3rem", lineHeight: 1.45 }}>
                  {item.explanation}
                </p>
              </div>

              {/* Node location & actions footer */}
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: "0.6rem",
                borderTop: "1px solid var(--border-subtle)",
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                flexWrap: "wrap",
                gap: "0.5rem"
              }}>
                <div>
                  Node: <strong>{item.location_name || item.location_id}</strong> &bull; Category: <strong>{item.category || "General"}</strong>
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={() => onNavigateTab("predictive-forecast")}
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: "0.725rem", padding: "0.2rem 0.5rem" }}
                  >
                    Forecast Demand <ArrowRight size={11} />
                  </button>
                  <button
                    onClick={() => onNavigateTab("map")}
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: "0.725rem", padding: "0.2rem 0.5rem" }}
                  >
                    GIS Corridor <ArrowRight size={11} />
                  </button>
                </div>
              </div>

            </div>
          ))
        )}
      </div>

      {/* Action Dialog */}
      {actionItem && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Take Action: {actionItem.title}</h3>
              <button
                onClick={() => setActionItem(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleExecuteAction}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Action</label>
                  <select
                    className="form-control"
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value)}
                  >
                    <option value="ACKNOWLEDGE">ACKNOWLEDGE (Acknowledge operational awareness)</option>
                    <option value="ASSIGN">ASSIGN (Designate responsible logistics officer)</option>
                    <option value="RESOLVE">RESOLVE (Mark condition mitigated / convoy deployed)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Reviewer / Duty Officer</label>
                  <input
                    type="text"
                    className="form-control"
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Operational Notes &amp; Audit Log</label>
                  <textarea
                    rows={3}
                    className="form-control"
                    placeholder="Enter dispatch order numbers, weather mitigation steps, or convoy details..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setActionItem(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary"
                >
                  {isSubmitting ? "Updating..." : "Commit Action"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Trail Modal */}
      {selectedAuditItem && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h3>Audit Trail &bull; Item #{selectedAuditItem.priority_rank}</h3>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                  {selectedAuditItem.title}
                </p>
              </div>
              <button
                onClick={() => setSelectedAuditItem(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                &times;
              </button>
            </div>

            <div className="modal-body">
              {selectedAuditItem.audit_trail && selectedAuditItem.audit_trail.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {selectedAuditItem.audit_trail.map((entry, idx) => (
                    <div key={idx} style={{
                      padding: "0.75rem",
                      backgroundColor: "var(--bg-card-light)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-subtle)"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--primary)" }}>
                          {entry.action}
                        </span>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.775rem", color: "var(--text-main)", marginTop: "0.25rem" }}>
                        Officer: <strong>{entry.user}</strong>
                      </div>
                      {entry.notes && (
                        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem", fontStyle: "italic" }}>
                          &ldquo;{entry.notes}&rdquo;
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>No audit records available.</p>
              )}
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setSelectedAuditItem(null)}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

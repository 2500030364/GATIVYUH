import React, { useState } from "react";
import { Truck, ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, AlertOctagon, Plus, Search, Filter } from "lucide-react";
import { LogisticsEvent, Location, InventoryItem, api } from "../api/client";

interface EventsViewProps {
  events: LogisticsEvent[];
  locations: Location[];
  inventory: InventoryItem[];
  onRefresh: () => void;
}

export const EventsView: React.FC<EventsViewProps> = ({ events, locations, inventory, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // New Movement / Dispatch Modal
  const [isDispatchOpen, setIsDispatchOpen] = useState(false);
  const [sourceLoc, setSourceLoc] = useState<string>(locations[0]?.id || "LOC-PUN-01");
  const [destLoc, setDestLoc] = useState<string>(locations[1]?.id || "LOC-LON-03");
  const [category, setCategory] = useState<string>("FUEL");
  const [itemName, setItemName] = useState<string>("High-Speed Diesel (HSD)");
  const [quantity, setQuantity] = useState<number>(500);
  const [unit, setUnit] = useState<string>("Liters");
  const [refCode, setRefCode] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delay Modal
  const [delayingEvent, setDelayingEvent] = useState<LogisticsEvent | null>(null);
  const [delayReason, setDelayReason] = useState<string>("Weather-induced landslide along mountain pass");

  const handleOpenDispatch = () => {
    setSourceLoc(locations[0]?.id || "LOC-PUN-01");
    setDestLoc(locations[1]?.id || "LOC-LON-03");
    setCategory("FUEL");
    setItemName("High-Speed Diesel (HSD)");
    setQuantity(500);
    setUnit("Liters");
    setRefCode(`CONVOY-${Math.floor(1000 + Math.random() * 9000)}`);
    setNotes("Standard corridor resupply convoy");
    setDispatchError(null);
    setIsDispatchOpen(true);
  };

  const handleExecuteDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceLoc === destLoc) {
      setDispatchError("Source and Destination locations cannot be the same.");
      return;
    }
    setDispatchError(null);
    setIsSubmitting(true);

    try {
      await api.recordDispatch({
        source_location_id: sourceLoc,
        destination_location_id: destLoc,
        category,
        item_name: itemName,
        quantity: Number(quantity),
        unit,
        reference_code: refCode,
        notes,
      });
      setIsDispatchOpen(false);
      onRefresh();
    } catch (err: any) {
      setDispatchError(err.message || "Failed to dispatch convoy.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeliver = async (eventId: string) => {
    try {
      await api.deliverConvoy(eventId, "Convoy arrived and offloaded successfully.");
      onRefresh();
    } catch (err: any) {
      alert("Failed to record delivery: " + err.message);
    }
  };

  const handleExecuteDelay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delayingEvent) return;
    try {
      await api.delayConvoy(delayingEvent.id, delayReason);
      setDelayingEvent(null);
      onRefresh();
    } catch (err: any) {
      alert("Failed to report delay: " + err.message);
    }
  };

  // Filter events
  const filtered = events.filter((ev) => {
    const matchesSearch = ev.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          ev.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (ev.reference_code && ev.reference_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (ev.notes && ev.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = typeFilter === "ALL" || ev.event_type === typeFilter;
    const matchesStatus = statusFilter === "ALL" || ev.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2>Operational Logistics Events Journal</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Immutable chronological register of supply movements, receipts, consumption, in-transit dispatches, and delays.
          </p>
        </div>

        <button onClick={handleOpenDispatch} className="btn btn-primary">
          <Truck size={16} />
          <span>Dispatch New Convoy</span>
        </button>
      </div>

      {/* Filter bar */}
      <div className="card" style={{ padding: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: "260px" }}>
          <Search size={16} color="var(--primary)" />
          <input
            type="text"
            className="form-control"
            placeholder="Search by event ID, item, convoy reference or notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%", maxWidth: "340px" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Type:</span>
            <select
              className="form-control"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ width: "auto", padding: "0.4rem 0.6rem" }}
            >
              <option value="ALL">All Types</option>
              <option value="DISPATCH">DISPATCH</option>
              <option value="DELIVERY">DELIVERY</option>
              <option value="RECEIPT">RECEIPT</option>
              <option value="CONSUMPTION">CONSUMPTION</option>
              <option value="DELAY">DELAY</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Status:</span>
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: "auto", padding: "0.4rem 0.6rem" }}
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="DELAYED">Delayed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>
            {filtered.length} events logged
          </span>
        </div>
      </div>

      {/* Events Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Event ID</th>
              <th>Timestamp</th>
              <th>Type</th>
              <th>Status</th>
              <th>Supply Item</th>
              <th>Quantity</th>
              <th>Source &rarr; Destination</th>
              <th>Reference / Notes</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                  No logistics events match the filter selection.
                </td>
              </tr>
            ) : (
              filtered.map((ev) => (
                <tr key={ev.id}>
                  <td>
                    <span className="mono" style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--primary)" }}>
                      {ev.id}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-main)" }}>
                      {new Date(ev.timestamp).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      {new Date(ev.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </td>
                  <td>
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.3rem",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: ev.event_type === "RECEIPT" ? "var(--status-stable)" :
                             ev.event_type === "DISPATCH" ? "var(--primary)" :
                             ev.event_type === "CONSUMPTION" ? "var(--text-muted)" :
                             ev.event_type === "DELAY" ? "var(--status-watch)" : "var(--status-stable)"
                    }}>
                      {ev.event_type === "RECEIPT" && <ArrowDownRight size={14} />}
                      {ev.event_type === "DISPATCH" && <ArrowUpRight size={14} />}
                      {ev.event_type === "DELAY" && <Clock size={14} />}
                      {ev.event_type}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${
                      ev.status === "COMPLETED" ? "badge-stable" :
                      ev.status === "IN_TRANSIT" ? "badge-watch" :
                      ev.status === "DELAYED" ? "badge-critical" : "badge-neutral"
                    }`}>
                      {ev.status.replace("_", " ")}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, fontSize: "0.825rem", color: "var(--text-main)" }}>
                      {ev.item_name}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                      {ev.category}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontWeight: 800, fontSize: "0.95rem" }}>
                      {ev.quantity.toLocaleString()}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "0.25rem" }}>
                      {ev.unit}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-main)" }}>
                      {ev.source_location_name || ev.location_id}
                    </div>
                    {ev.destination_location_name && (
                      <div style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: 600 }}>
                        &rarr; {ev.destination_location_name}
                      </div>
                    )}
                  </td>
                  <td>
                    {ev.reference_code && (
                      <span className="mono" style={{ fontSize: "0.7rem", fontWeight: 600, backgroundColor: "var(--bg-card)", padding: "0.1rem 0.35rem", borderRadius: "3px" }}>
                        {ev.reference_code}
                      </span>
                    )}
                    {ev.notes && (
                      <div style={{ fontSize: "0.725rem", color: "var(--text-muted)", marginTop: "0.2rem", maxWidth: "260px" }}>
                        {ev.notes}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {ev.status === "IN_TRANSIT" && (
                      <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                        <button
                          onClick={() => handleDeliver(ev.id)}
                          className="btn btn-primary btn-sm"
                          title="Record arrival at destination & credit available stock"
                        >
                          <CheckCircle2 size={13} />
                          <span>Deliver</span>
                        </button>
                        <button
                          onClick={() => setDelayingEvent(ev)}
                          className="btn btn-secondary btn-sm"
                          style={{ color: "var(--status-critical)" }}
                          title="Report roadblock, landslide, or delay"
                        >
                          <AlertOctagon size={13} />
                          <span>Delay</span>
                        </button>
                      </div>
                    )}
                    {ev.status === "DELAYED" && (
                      <button
                        onClick={() => handleDeliver(ev.id)}
                        className="btn btn-secondary btn-sm"
                        title="Resume and complete delivery"
                      >
                        <CheckCircle2 size={13} />
                        <span>Deliver</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Dispatch Convoy Modal */}
      {isDispatchOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Dispatch Strategic Supply Convoy</h3>
              <button
                onClick={() => setIsDispatchOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleExecuteDispatch}>
              <div className="modal-body">
                {dispatchError && (
                  <div style={{
                    padding: "0.75rem",
                    marginBottom: "1rem",
                    backgroundColor: "var(--status-critical-bg)",
                    border: "1px solid var(--status-critical-border)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "0.8rem",
                    color: "var(--status-critical)"
                  }}>
                    {dispatchError}
                  </div>
                )}

                <div className="grid-cols-2">
                  <div className="form-group">
                    <label className="form-label">Source Staging Node</label>
                    <select
                      className="form-control"
                      value={sourceLoc}
                      onChange={(e) => setSourceLoc(e.target.value)}
                    >
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({l.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Destination Node</label>
                    <select
                      className="form-control"
                      value={destLoc}
                      onChange={(e) => setDestLoc(e.target.value)}
                    >
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({l.id})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid-cols-2">
                  <div className="form-group">
                    <label className="form-label">Supply Category</label>
                    <select
                      className="form-control"
                      value={category}
                      onChange={(e) => {
                        setCategory(e.target.value);
                        if (e.target.value === "FUEL") {
                          setItemName("High-Speed Diesel (HSD)");
                          setUnit("Liters");
                        } else if (e.target.value === "FOOD_WATER") {
                          setItemName("Emergency MRE Rations");
                          setUnit("Rations");
                        } else if (e.target.value === "MEDICAL_SUPPLIES") {
                          setItemName("Trauma Surgical Field Kits");
                          setUnit("Kits");
                        } else {
                          setItemName("Portable Multi-Fuel Generators");
                          setUnit("Units");
                        }
                      }}
                    >
                      <option value="FUEL">Petroleum & Fuel</option>
                      <option value="FOOD_WATER">Food & Water</option>
                      <option value="MEDICAL_SUPPLIES">Medical Supplies</option>
                      <option value="GENERAL_SUPPLIES">General Supplies</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Item Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={itemName}
                      required
                      onChange={(e) => setItemName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid-cols-2">
                  <div className="form-group">
                    <label className="form-label">Quantity</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      className="form-control mono"
                      value={quantity}
                      required
                      onChange={(e) => setQuantity(parseFloat(e.target.value))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Convoy Reference Code</label>
                    <input
                      type="text"
                      className="form-control mono"
                      value={refCode}
                      onChange={(e) => setRefCode(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Transit Escort / Corridor Notes</label>
                  <textarea
                    rows={2}
                    className="form-control"
                    value={notes}
                    placeholder="e.g. NH48 expressway transit with mountain guard..."
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                <div style={{
                  padding: "0.75rem",
                  backgroundColor: "var(--bg-card-light)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: "0.75rem",
                  color: "var(--text-muted)"
                }}>
                  <strong>Transactional Rule:</strong> When dispatched, the quantity is automatically held under &ldquo;reserved stock&rdquo; at the source location. It will be released and credited to the destination upon delivery completion.
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsDispatchOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary"
                >
                  {isSubmitting ? "Dispatching..." : "Authorize Dispatch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delay Modal */}
      {delayingEvent && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Report Transit Delay: {delayingEvent.id}</h3>
              <button
                onClick={() => setDelayingEvent(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleExecuteDelay}>
              <div className="modal-body">
                <p style={{ fontSize: "0.85rem", color: "var(--text-main)", marginBottom: "1rem" }}>
                  Convoy: <strong>{delayingEvent.reference_code || delayingEvent.id}</strong> ({delayingEvent.quantity} {delayingEvent.unit} of {delayingEvent.item_name})
                </p>

                <div className="form-group">
                  <label className="form-label">Delay Cause / Situation Report</label>
                  <select
                    className="form-control"
                    value={delayReason}
                    onChange={(e) => setDelayReason(e.target.value)}
                  >
                    <option value="Landslide and rockfall reported along Bhor Ghat pass">Landslide / Rockfall on Bhor Ghat</option>
                    <option value="Severe heavy monsoon fog with zero visibility">Heavy Monsoon Fog &amp; Zero Visibility</option>
                    <option value="Mechanical convoy breakdown on NH48 expressway">Mechanical Breakdown on Expressway</option>
                    <option value="Bridge weight-restriction inspection near Mulshi reservoir">Bridge Weight Inspection near Mulshi</option>
                    <option value="Tactical checkpoint delay by local authorities">Tactical Staging Checkpoint Delay</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setDelayingEvent(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ backgroundColor: "var(--status-critical)" }}
                >
                  Confirm Delay Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

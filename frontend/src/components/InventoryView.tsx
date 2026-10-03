import React, { useState } from "react";
import { Package, Search, Filter, ArrowDownRight, ArrowUpRight, ShieldAlert, CheckCircle2, SlidersHorizontal } from "lucide-react";
import { InventoryItem, Location, api } from "../api/client";

interface InventoryViewProps {
  inventory: InventoryItem[];
  locations: Location[];
  onRefresh: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ inventory, locations, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Stock adjustment modal state
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [actionType, setActionType] = useState<string>("RECEIPT");
  const [quantity, setQuantity] = useState<number>(100);
  const [refCode, setRefCode] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenAdjust = (item: InventoryItem) => {
    setSelectedItem(item);
    setActionType("RECEIPT");
    setQuantity(item.min_stock > 0 ? Math.round(item.min_stock * 0.5) : 100);
    setRefCode("");
    setNotes("");
    setAdjustmentError(null);
  };

  const handleExecuteAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setAdjustmentError(null);
    setIsSubmitting(true);

    try {
      await api.adjustInventory(selectedItem.id, {
        action: actionType,
        quantity: Number(quantity),
        reference_code: refCode,
        notes: notes || undefined,
      });
      setSelectedItem(null);
      onRefresh();
    } catch (err: any) {
      setAdjustmentError(err.message || "Failed to process stock adjustment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter items
  const filtered = inventory.filter((item) => {
    const matchesSearch = item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.location_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (item.location_name && item.location_name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesLoc = locationFilter === "ALL" || item.location_id === locationFilter;
    const matchesCat = categoryFilter === "ALL" || item.category === categoryFilter;
    const matchesStatus = statusFilter === "ALL" || item.stock_status === statusFilter;
    return matchesSearch && matchesLoc && matchesCat && matchesStatus;
  });

  return (
    <div style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      
      {/* Header bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2>Forward Supply Inventory Ledger</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Itemized stock accounting across Food/Water, Fuel, Medical Supplies, and General Logistics.
          </p>
        </div>
      </div>

      {/* Filter controls */}
      <div className="card" style={{ padding: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: "260px" }}>
          <Search size={16} color="var(--primary)" />
          <input
            type="text"
            className="form-control"
            placeholder="Search items, supply lines, or location names..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%", maxWidth: "320px" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", flexWrap: "wrap" }}>
          {/* Location filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Node:</span>
            <select
              className="form-control"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              style={{ width: "auto", padding: "0.4rem 0.6rem" }}
            >
              <option value="ALL">All Nodes</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Category:</span>
            <select
              className="form-control"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ width: "auto", padding: "0.4rem 0.6rem" }}
            >
              <option value="ALL">All Categories</option>
              <option value="FOOD_WATER">Food & Water</option>
              <option value="FUEL">Petroleum & Fuel</option>
              <option value="MEDICAL_SUPPLIES">Medical Supplies</option>
              <option value="GENERAL_SUPPLIES">General Supplies</option>
            </select>
          </div>

          {/* Status filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Status:</span>
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: "auto", padding: "0.4rem 0.6rem" }}
            >
              <option value="ALL">All Statuses</option>
              <option value="STABLE">Stable</option>
              <option value="WATCH">Watch</option>
              <option value="AT_RISK">At Risk</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>
            {filtered.length} line items
          </span>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Node Location</th>
              <th>Category</th>
              <th>Supply Item</th>
              <th>Stock Level &amp; Buffer Status</th>
              <th>Available</th>
              <th>Reserved</th>
              <th>Min Safety Buffer</th>
              <th>Max Capacity</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                  No inventory records match the current filter selection.
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const totalStock = item.available_stock + item.reserved_stock;
                const capacityPct = Math.min(100, Math.round((totalStock / (item.max_capacity || 1000)) * 100));
                const minPct = Math.min(100, Math.round((item.min_stock / (item.max_capacity || 1000)) * 100));

                return (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: "var(--text-main)" }}>
                        {item.location_name || item.location_id}
                      </div>
                      <div className="mono" style={{ fontSize: "0.725rem", color: "var(--text-muted)" }}>
                        {item.location_id}
                      </div>
                    </td>
                    <td>
                      <span style={{
                        fontSize: "0.725rem",
                        fontWeight: 700,
                        padding: "0.2rem 0.5rem",
                        borderRadius: "4px",
                        backgroundColor: "var(--bg-card)",
                        color: "var(--text-main)"
                      }}>
                        {item.category.replace("_", " ")}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: "var(--text-main)" }}>{item.item_name}</div>
                      <div style={{ fontSize: "0.725rem", color: "var(--text-muted)" }}>Unit: {item.unit}</div>
                    </td>
                    <td style={{ minWidth: "160px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                        <span className={`badge badge-${item.stock_status?.toLowerCase() || "stable"}`}>
                          {item.stock_status}
                        </span>
                        <span style={{ fontSize: "0.725rem", color: "var(--text-muted)", fontWeight: 600 }}>
                          {capacityPct}% capacity
                        </span>
                      </div>
                      <div style={{
                        height: "6px",
                        backgroundColor: "var(--border-subtle)",
                        borderRadius: "3px",
                        overflow: "hidden",
                        position: "relative"
                      }}>
                        <div style={{
                          height: "100%",
                          width: `${capacityPct}%`,
                          backgroundColor: item.stock_status === "CRITICAL" ? "var(--status-critical)" :
                                           item.stock_status === "AT_RISK" ? "var(--status-at-risk)" :
                                           item.stock_status === "WATCH" ? "var(--status-watch)" : "var(--status-stable)",
                          transition: "width 0.3s ease"
                        }} />
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-main)" }}>
                        {item.available_stock.toLocaleString()}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "0.25rem" }}>
                        {item.unit}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.85rem", color: item.reserved_stock > 0 ? "var(--primary)" : "var(--text-muted)", fontWeight: item.reserved_stock > 0 ? 700 : 400 }}>
                        {item.reserved_stock.toLocaleString()} {item.unit}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                        {item.min_stock.toLocaleString()} {item.unit}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                        {item.max_capacity.toLocaleString()} {item.unit}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        onClick={() => handleOpenAdjust(item)}
                        className="btn btn-secondary btn-sm"
                        title="Record receipt, operational consumption, or stock reserve"
                      >
                        <SlidersHorizontal size={13} />
                        <span>Adjust Stock</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Stock Adjustment Modal */}
      {selectedItem && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h3>Stock Transaction: {selectedItem.item_name}</h3>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                  Location: {selectedItem.location_name || selectedItem.location_id} &bull; Current Available: {selectedItem.available_stock} {selectedItem.unit}
                </p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleExecuteAdjustment}>
              <div className="modal-body">
                {adjustmentError && (
                  <div style={{
                    padding: "0.75rem",
                    marginBottom: "1rem",
                    backgroundColor: "var(--status-critical-bg)",
                    border: "1px solid var(--status-critical-border)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "0.8rem",
                    color: "var(--status-critical)"
                  }}>
                    {adjustmentError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Transaction Type</label>
                  <select
                    className="form-control"
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value)}
                  >
                    <option value="RECEIPT">RECEIPT (Add supply to available stock)</option>
                    <option value="CONSUMPTION">CONSUMPTION (Deduct consumed stock — strictly verified)</option>
                    <option value="RESERVE">RESERVE (Hold available stock for upcoming convoy)</option>
                    <option value="RELEASE">RELEASE (Release reserved stock back to available)</option>
                  </select>
                </div>

                <div className="grid-cols-2">
                  <div className="form-group">
                    <label className="form-label">Quantity ({selectedItem.unit})</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      className="form-control mono"
                      value={quantity}
                      required
                      onChange={(e) => setQuantity(parseFloat(e.target.value))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Reference / PO Code</label>
                    <input
                      type="text"
                      className="form-control mono"
                      placeholder="e.g. PO-8831 or CONVOY-12"
                      value={refCode}
                      onChange={(e) => setRefCode(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Operational Notes</label>
                  <textarea
                    rows={2}
                    className="form-control"
                    placeholder="Rationale for adjustment, delivery voucher notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                {/* Accounting Business Rule Advisory */}
                <div style={{
                  padding: "0.75rem",
                  backgroundColor: "var(--bg-card-light)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: "0.75rem",
                  color: "var(--text-muted)"
                }}>
                  <strong>Accounting Rule:</strong> All stock adjustments are logged as immutable logistics events. Consumption requests that exceed available stock are strictly rejected by the server to prevent negative balances.
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary"
                >
                  {isSubmitting ? "Executing..." : "Confirm Transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

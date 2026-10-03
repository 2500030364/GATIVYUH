import React, { useState } from "react";
import { Plus, Edit2, Trash2, Compass, Search, Filter, Mountain, CheckCircle2, AlertTriangle } from "lucide-react";
import { Location, api } from "../api/client";

interface LocationsViewProps {
  locations: Location[];
  onRefresh: () => void;
  onSelectOnMap: (location: Location) => void;
}

export const LocationsView: React.FC<LocationsViewProps> = ({ locations, onRefresh, onSelectOnMap }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingLoc, setEditingLoc] = useState<Location | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    location_type: "FORWARD_DEPOT",
    status: "STABLE",
    latitude: 18.65,
    longitude: 73.55,
    elevation_m: 600,
    description: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQueryingElevation, setIsQueryingElevation] = useState(false);

  const resetForm = () => {
    setFormData({
      id: "",
      name: "",
      location_type: "FORWARD_DEPOT",
      status: "STABLE",
      latitude: 18.65,
      longitude: 73.55,
      elevation_m: 600,
      description: "",
    });
    setFormError(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (loc: Location) => {
    setEditingLoc(loc);
    setFormData({
      id: loc.id,
      name: loc.name,
      location_type: loc.location_type,
      status: loc.status,
      latitude: loc.latitude,
      longitude: loc.longitude,
      elevation_m: loc.elevation_m || 600,
      description: loc.description || "",
    });
    setFormError(null);
  };

  const handleQuerySRTMElevation = async () => {
    setIsQueryingElevation(true);
    try {
      const res = await api.queryElevation(Number(formData.latitude), Number(formData.longitude));
      if (res.elevation_m !== null && res.elevation_m !== undefined) {
        setFormData(prev => ({ ...prev, elevation_m: res.elevation_m! }));
      } else {
        alert(res.message);
      }
    } catch (e: any) {
      alert("Failed to query SRTM elevation: " + e.message);
    } finally {
      setIsQueryingElevation(false);
    }
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (editingLoc) {
        await api.updateLocation(editingLoc.id, {
          name: formData.name,
          location_type: formData.location_type,
          status: formData.status,
          latitude: Number(formData.latitude),
          longitude: Number(formData.longitude),
          elevation_m: Number(formData.elevation_m),
          description: formData.description,
        });
        setEditingLoc(null);
      } else {
        await api.createLocation({
          id: formData.id,
          name: formData.name,
          location_type: formData.location_type,
          status: formData.status,
          latitude: Number(formData.latitude),
          longitude: Number(formData.longitude),
          elevation_m: Number(formData.elevation_m),
          description: formData.description,
          is_synthetic: false,
          is_active: true,
        });
        setIsCreateOpen(false);
      }
      onRefresh();
    } catch (err: any) {
      setFormError(err.message || "Failed to save location");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    if (!window.confirm(`Are you sure you want to deactivate location ${id}?`)) return;
    try {
      await api.deactivateLocation(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed to deactivate");
    }
  };

  // Filtered list
  const filtered = locations.filter(loc => {
    const matchesSearch = loc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          loc.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "ALL" || loc.location_type === typeFilter;
    const matchesStatus = statusFilter === "ALL" || loc.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      
      {/* Header bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2>Corridor Strategic Nodes</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Manage staging depots, medical facilities, forward posts, and fuel depots across Pune, Mulshi &amp; Lonavala.
          </p>
        </div>

        <button onClick={handleOpenCreate} className="btn btn-primary">
          <Plus size={16} />
          <span>Add Location</span>
        </button>
      </div>

      {/* Filters bar */}
      <div className="card" style={{ padding: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: "260px" }}>
          <Search size={16} color="var(--primary)" />
          <input
            type="text"
            className="form-control"
            placeholder="Search by name or node ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%", maxWidth: "320px" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Type:</span>
            <select
              className="form-control"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ width: "auto", padding: "0.4rem 0.6rem" }}
            >
              <option value="ALL">All Types</option>
              <option value="HUB">Central Hub</option>
              <option value="FORWARD_DEPOT">Forward Depot</option>
              <option value="FIELD_HOSPITAL">Field Hospital</option>
              <option value="FUEL_DEPOT">Fuel Depot</option>
              <option value="TRANSIT_NODE">Transit Node</option>
              <option value="DISTRIBUTION_CENTER">Distribution Center</option>
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
              <option value="STABLE">Stable</option>
              <option value="WATCH">Watch</option>
              <option value="AT_RISK">At Risk</option>
              <option value="CRITICAL">Critical</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>
            {filtered.length} nodes
          </span>
        </div>
      </div>

      {/* Locations Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Node ID</th>
              <th>Location Name</th>
              <th>Type</th>
              <th>Status</th>
              <th>Coordinates</th>
              <th>SRTM Elevation</th>
              <th>Dataset Origin</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                  No locations match the selected criteria.
                </td>
              </tr>
            ) : (
              filtered.map((loc) => (
                <tr key={loc.id}>
                  <td>
                    <span className="mono" style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--primary)" }}>
                      {loc.id}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: "var(--text-main)" }}>{loc.name}</div>
                    {loc.description && (
                      <div style={{ fontSize: "0.725rem", color: "var(--text-muted)", maxWidth: "340px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {loc.description}
                      </div>
                    )}
                  </td>
                  <td>
                    <span style={{ fontSize: "0.775rem", fontWeight: 600, color: "var(--text-muted)" }}>
                      {loc.location_type}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${loc.status.toLowerCase()}`}>
                      {loc.status}
                    </span>
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-main)" }}>
                      {loc.elevation_m ? `${loc.elevation_m} m` : "—"}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      padding: "0.15rem 0.4rem",
                      borderRadius: "4px",
                      backgroundColor: loc.is_synthetic ? "var(--bg-card)" : "var(--status-stable-bg)",
                      color: loc.is_synthetic ? "var(--text-muted)" : "var(--status-stable)"
                    }}>
                      {loc.is_synthetic ? "SIMULATED" : "USER IMPORT"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: "0.4rem" }}>
                      <button
                        onClick={() => onSelectOnMap(loc)}
                        className="btn btn-secondary btn-sm"
                        title="View on GIS Corridor Map"
                      >
                        <Compass size={13} />
                        <span>Map</span>
                      </button>
                      <button
                        onClick={() => handleOpenEdit(loc)}
                        className="btn btn-secondary btn-sm"
                        title="Edit node parameters"
                      >
                        <Edit2 size={13} />
                      </button>
                      {loc.is_active && (
                        <button
                          onClick={() => handleDeactivate(loc.id)}
                          className="btn btn-secondary btn-sm"
                          style={{ color: "var(--status-critical)" }}
                          title="Deactivate location"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {(isCreateOpen || editingLoc) && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingLoc ? `Edit Location: ${editingLoc.id}` : "Register New Demonstration Node"}</h3>
              <button
                onClick={() => { setIsCreateOpen(false); setEditingLoc(null); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveLocation}>
              <div className="modal-body">
                {formError && (
                  <div style={{
                    padding: "0.75rem",
                    marginBottom: "1rem",
                    backgroundColor: "var(--status-critical-bg)",
                    border: "1px solid var(--status-critical-border)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "0.8rem",
                    color: "var(--status-critical)"
                  }}>
                    {formError}
                  </div>
                )}

                <div className="grid-cols-2">
                  <div className="form-group">
                    <label className="form-label">Node Identifier (Unique)</label>
                    <input
                      type="text"
                      className="form-control mono"
                      placeholder="e.g. LOC-PUN-09"
                      value={formData.id}
                      disabled={!!editingLoc}
                      required
                      onChange={(e) => setFormData({ ...formData, id: e.target.value.toUpperCase() })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Location Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Shirwal Staging Depot"
                      value={formData.name}
                      required
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid-cols-2">
                  <div className="form-group">
                    <label className="form-label">Location Type</label>
                    <select
                      className="form-control"
                      value={formData.location_type}
                      onChange={(e) => setFormData({ ...formData, location_type: e.target.value })}
                    >
                      <option value="HUB">Central Hub</option>
                      <option value="FORWARD_DEPOT">Forward Depot</option>
                      <option value="FIELD_HOSPITAL">Field Hospital</option>
                      <option value="FUEL_DEPOT">Fuel Depot</option>
                      <option value="TRANSIT_NODE">Transit Node</option>
                      <option value="DISTRIBUTION_CENTER">Distribution Center</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Initial Operational Status</label>
                    <select
                      className="form-control"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="STABLE">Stable</option>
                      <option value="WATCH">Watch</option>
                      <option value="AT_RISK">At Risk</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                </div>

                <div className="grid-cols-2">
                  <div className="form-group">
                    <label className="form-label">Latitude (-90 to 90)</label>
                    <input
                      type="number"
                      step="0.0001"
                      className="form-control mono"
                      value={formData.latitude}
                      required
                      onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Longitude (-180 to 180)</label>
                    <input
                      type="number"
                      step="0.0001"
                      className="form-control mono"
                      value={formData.longitude}
                      required
                      onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>

                {/* Elevation & SRTM Query */}
                <div className="form-group">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Elevation (Meters ASL)</label>
                    <button
                      type="button"
                      onClick={handleQuerySRTMElevation}
                      disabled={isQueryingElevation}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: "0.72rem", padding: "0.2rem 0.5rem" }}
                    >
                      <Mountain size={12} />
                      <span>{isQueryingElevation ? "Querying..." : "Auto-Fetch SRTM GeoTIFF"}</span>
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    className="form-control mono"
                    value={formData.elevation_m}
                    onChange={(e) => setFormData({ ...formData, elevation_m: parseFloat(e.target.value) })}
                  />
                  <small style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px", display: "block" }}>
                    Click &ldquo;Auto-Fetch&rdquo; to retrieve the exact elevation from the local SRTMGL1 raster.
                  </small>
                </div>

                <div className="form-group">
                  <label className="form-label">Strategic Description / Mission Notes</label>
                  <textarea
                    rows={3}
                    className="form-control"
                    placeholder="Provide operational context, transit limitations, convoy accessibility..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => { setIsCreateOpen(false); setEditingLoc(null); }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn btn-primary"
                >
                  {isSubmitting ? "Saving..." : editingLoc ? "Update Node" : "Register Node"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

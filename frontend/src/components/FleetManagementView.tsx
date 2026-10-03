import React, { useState, useEffect } from "react";
import { 
  Truck, Plus, RefreshCw, Filter, ShieldCheck, AlertCircle, 
  MapPin, Gauge, Fuel, CheckCircle2, Wrench, X, Edit3, ArrowRight
} from "lucide-react";
import { api, TransportResource, Location } from "../api/client";

interface FleetManagementViewProps {
  locations: Location[];
}

export const FleetManagementView: React.FC<FleetManagementViewProps> = ({ locations }) => {
  const [fleet, setFleet] = useState<TransportResource[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showUpdateModal, setShowUpdateModal] = useState<boolean>(false);
  const [selectedVehicle, setSelectedVehicle] = useState<TransportResource | null>(null);

  // New vehicle form state
  const [newId, setNewId] = useState<string>(`TR-HCV-${Math.floor(10 + Math.random() * 90)}`);
  const [newName, setNewName] = useState<string>("Ashok Leyland 2820 Heavy Cargo Transporter");
  const [newType, setNewType] = useState<string>("HEAVY_TRUCK");
  const [newCapacity, setNewCapacity] = useState<number>(12000);
  const [newVolume, setNewVolume] = useState<number>(30);
  const [newLocationId, setNewLocationId] = useState<string>(locations[0]?.id || "LOC-PUN-01");
  const [newCostPerKm, setNewCostPerKm] = useState<number>(16.5);
  const [newStatus, setNewStatus] = useState<string>("AVAILABLE");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Update vehicle form state
  const [updateStatus, setUpdateStatus] = useState<string>("AVAILABLE");
  const [updateLoad, setUpdateLoad] = useState<number>(0);
  const [updateLocationId, setUpdateLocationId] = useState<string>("");
  const [updateMaintenance, setUpdateMaintenance] = useState<string>("OPERATIONAL");

  const fetchFleet = async () => {
    try {
      setIsLoading(true);
      const data = await api.getTransportResources({
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        vehicle_type: typeFilter !== "ALL" ? typeFilter : undefined
      });
      setFleet(data);
    } catch (err: any) {
      console.error("Error loading fleet:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFleet();
  }, [statusFilter, typeFilter]);

  const handleCreateVehicle = async () => {
    try {
      setIsSubmitting(true);
      await api.createTransportResource({
        id: newId,
        name: newName,
        vehicle_type: newType,
        capacity_weight_kg: newCapacity,
        capacity_volume_m3: newVolume,
        current_location_id: newLocationId,
        cost_per_km: newCostPerKm,
        status: newStatus,
        maintenance_status: "OPERATIONAL"
      });
      setShowCreateModal(false);
      await fetchFleet();
    } catch (err: any) {
      alert("Failed to register resource: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenUpdate = (veh: TransportResource) => {
    setSelectedVehicle(veh);
    setUpdateStatus(veh.status);
    setUpdateLoad(veh.current_load_kg);
    setUpdateLocationId(veh.current_location_id);
    setUpdateMaintenance(veh.maintenance_status);
    setShowUpdateModal(true);
  };

  const handleUpdateVehicle = async () => {
    if (!selectedVehicle) return;
    try {
      setIsSubmitting(true);
      await api.updateTransportResource(selectedVehicle.id, {
        status: updateStatus,
        current_load_kg: updateLoad,
        current_location_id: updateLocationId,
        maintenance_status: updateMaintenance
      });
      setShowUpdateModal(false);
      await fetchFleet();
    } catch (err: any) {
      alert("Failed to update resource: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
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
              Feature 1 &bull; Transportation Resource Intelligence
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
              <Truck size={13} color="var(--primary)" />
              TACTICAL FLEET LEDGER
            </span>
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.35rem" }}>
            Validated transport resource inventory: payload capacity, load tracking, operational restrictions, and maintenance readiness.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button onClick={fetchFleet} disabled={isLoading} className="btn btn-secondary btn-sm">
            <RefreshCw size={13} className={isLoading ? "spin-animation" : ""} />
            <span>Refresh</span>
          </button>
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary btn-sm" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Plus size={14} />
            <span>Register Transport Resource</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div style={{
        backgroundColor: "#FFFFFF",
        padding: "1rem 1.75rem",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        gap: "1.5rem",
        flexWrap: "wrap"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Filter size={15} color="var(--primary)" />
          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)" }}>Filter Fleet:</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem" }}>
          <span>Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: "0.35rem 0.65rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)", fontSize: "0.8rem" }}
          >
            <option value="ALL">All Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="STANDBY">Standby</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem" }}>
          <span>Vehicle Type:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{ padding: "0.35rem 0.65rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)", fontSize: "0.8rem" }}
          >
            <option value="ALL">All Types</option>
            <option value="HEAVY_TRUCK">Heavy Freight Truck</option>
            <option value="MEDIUM_TRUCK">Medium Truck</option>
            <option value="LIGHT_UTILITY">Light Tactical Utility (4x4)</option>
            <option value="FUEL_TANKER">Petroleum Fuel Bowzer</option>
            <option value="REFRIGERATED_VAN">Refrigerated Medical Van</option>
          </select>
        </div>

        <div style={{ marginLeft: "auto", fontSize: "0.8rem", color: "var(--text-muted)" }}>
          Showing <strong>{fleet.length}</strong> vehicles in corridor
        </div>
      </div>

      {/* Fleet Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1.5rem" }}>
        {fleet.map((veh) => {
          const loadPct = veh.capacity_weight_kg > 0 ? (veh.current_load_kg / veh.capacity_weight_kg) * 100 : 0;
          return (
            <div
              key={veh.id}
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border-subtle)",
                boxShadow: "var(--shadow-sm)",
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.85rem"
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--primary-dark)" }}>
                    {veh.id}
                  </div>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-main)", margin: "0.2rem 0" }}>
                    {veh.name}
                  </h3>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                    {veh.vehicle_type.replace("_", " ")}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.3rem" }}>
                  <span style={{
                    padding: "0.2rem 0.55rem",
                    borderRadius: "4px",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    backgroundColor: veh.status === "AVAILABLE" ? "var(--status-stable-bg)" : (veh.status === "IN_TRANSIT" ? "var(--primary-light)" : "var(--status-watch-bg)"),
                    color: veh.status === "AVAILABLE" ? "var(--status-stable)" : (veh.status === "IN_TRANSIT" ? "var(--primary-dark)" : "var(--status-watch)")
                  }}>
                    {veh.status}
                  </span>
                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                    {veh.maintenance_status}
                  </span>
                </div>
              </div>

              {/* Load Capacity Gauge */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.25rem" }}>
                  <span style={{ color: "var(--text-muted)" }}>Current Payload Load:</span>
                  <strong>{veh.current_load_kg.toLocaleString()} / {veh.capacity_weight_kg.toLocaleString()} kg ({loadPct.toFixed(0)}%)</strong>
                </div>
                <div style={{ height: "6px", width: "100%", backgroundColor: "var(--bg-card)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.min(loadPct, 100)}%`,
                    backgroundColor: loadPct > 90 ? "var(--status-critical)" : (loadPct > 0 ? "var(--primary)" : "#CBB499"),
                    transition: "width 0.3s ease"
                  }} />
                </div>
              </div>

              {/* Specs Grid */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.5rem",
                backgroundColor: "var(--bg-card-light)",
                padding: "0.75rem",
                borderRadius: "var(--radius-md)",
                fontSize: "0.75rem"
              }}>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Stationed Location:</span>
                  <div style={{ fontWeight: 700, color: "var(--text-main)" }}>
                    {veh.current_location_name || veh.current_location_id}
                  </div>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Transit Destination:</span>
                  <div style={{ fontWeight: 700, color: "var(--text-main)" }}>
                    {veh.destination_location_name || (veh.destination_location_id ? veh.destination_location_id : "None (Stationed)")}
                  </div>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Speed (Loaded / Empty):</span>
                  <div style={{ fontWeight: 700 }}>
                    {veh.speed_loaded_kmh} / {veh.speed_empty_kmh} km/h
                  </div>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Operating Cost:</span>
                  <div style={{ fontWeight: 700 }}>
                    &#8377;{veh.cost_per_km}/km &bull; {veh.fuel_efficiency_km_l} km/L
                  </div>
                </div>
              </div>

              {/* Operational Restrictions */}
              {veh.operational_restrictions && Object.keys(veh.operational_restrictions).length > 0 && (
                <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", fontSize: "0.68rem" }}>
                  {Object.entries(veh.operational_restrictions).map(([k, v]) => (
                    <span key={k} style={{ padding: "0.15rem 0.4rem", backgroundColor: "var(--bg-card)", borderRadius: "3px", fontWeight: 600 }}>
                      {k}: {String(v)}
                    </span>
                  ))}
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={() => handleOpenUpdate(veh)}
                className="btn btn-secondary btn-sm"
                style={{ alignSelf: "flex-end", marginTop: "auto", display: "flex", alignItems: "center", gap: "0.3rem" }}
              >
                <Edit3 size={13} />
                <span>Update Status / Load</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* CREATE VEHICLE MODAL */}
      {showCreateModal && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(48, 45, 42, 0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2000,
          padding: "1rem"
        }}>
          <div style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "var(--radius-lg)",
            width: "100%",
            maxWidth: "520px",
            boxShadow: "var(--shadow-lg)",
            overflow: "hidden"
          }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-card-light)" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--text-main)" }}>
                Register New Transport Resource
              </h3>
            </div>

            <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.3rem" }}>Vehicle ID:</label>
                  <input
                    type="text"
                    value={newId}
                    onChange={(e) => setNewId(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.3rem" }}>Vehicle Type:</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)" }}
                  >
                    <option value="HEAVY_TRUCK">Heavy Freight Truck</option>
                    <option value="MEDIUM_TRUCK">Medium Truck</option>
                    <option value="LIGHT_UTILITY">Light Tactical Utility (4x4)</option>
                    <option value="FUEL_TANKER">Fuel Bowzer</option>
                    <option value="REFRIGERATED_VAN">Refrigerated Medical Van</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.3rem" }}>Vehicle Name / Model:</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.3rem" }}>Max Payload (kg):</label>
                  <input
                    type="number"
                    value={newCapacity}
                    onChange={(e) => setNewCapacity(parseFloat(e.target.value))}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.3rem" }}>Volume (m³):</label>
                  <input
                    type="number"
                    value={newVolume}
                    onChange={(e) => setNewVolume(parseFloat(e.target.value))}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.3rem" }}>Stationed Node:</label>
                  <select
                    value={newLocationId}
                    onChange={(e) => setNewLocationId(e.target.value)}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)" }}
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.3rem" }}>Cost per km (₹):</label>
                  <input
                    type="number"
                    value={newCostPerKm}
                    onChange={(e) => setNewCostPerKm(parseFloat(e.target.value))}
                    style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)" }}
                  />
                </div>
              </div>
            </div>

            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end", gap: "0.75rem", backgroundColor: "var(--bg-card-light)" }}>
              <button onClick={() => setShowCreateModal(false)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button onClick={handleCreateVehicle} disabled={isSubmitting} className="btn btn-primary btn-sm">
                {isSubmitting ? "Registering..." : "Register Vehicle"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPDATE VEHICLE MODAL */}
      {showUpdateModal && selectedVehicle && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(48, 45, 42, 0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2000,
          padding: "1rem"
        }}>
          <div style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "var(--radius-lg)",
            width: "100%",
            maxWidth: "480px",
            boxShadow: "var(--shadow-lg)",
            overflow: "hidden"
          }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-card-light)" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--text-main)" }}>
                Update {selectedVehicle.name} ({selectedVehicle.id})
              </h3>
            </div>

            <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.3rem" }}>Operational Status:</label>
                <select
                  value={updateStatus}
                  onChange={(e) => setUpdateStatus(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)" }}
                >
                  <option value="AVAILABLE">Available</option>
                  <option value="IN_TRANSIT">In Transit</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="STANDBY">Standby</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.3rem" }}>
                  Current Load kg (Max: {selectedVehicle.capacity_weight_kg} kg):
                </label>
                <input
                  type="number"
                  max={selectedVehicle.capacity_weight_kg}
                  value={updateLoad}
                  onChange={(e) => setUpdateLoad(parseFloat(e.target.value) || 0)}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.3rem" }}>Current Stationed Location:</label>
                <select
                  value={updateLocationId}
                  onChange={(e) => setUpdateLocationId(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)" }}
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.3rem" }}>Maintenance Readiness:</label>
                <select
                  value={updateMaintenance}
                  onChange={(e) => setUpdateMaintenance(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)" }}
                >
                  <option value="OPERATIONAL">Operational</option>
                  <option value="SERVICE_DUE">Service Due</option>
                  <option value="REPAIR_REQUIRED">Repair Required</option>
                </select>
              </div>
            </div>

            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end", gap: "0.75rem", backgroundColor: "var(--bg-card-light)" }}>
              <button onClick={() => setShowUpdateModal(false)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button onClick={handleUpdateVehicle} disabled={isSubmitting} className="btn btn-primary btn-sm">
                {isSubmitting ? "Saving..." : "Save Updates"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from "react";
import { 
  Map, Building2, Package, Truck, Compass
} from "lucide-react";
import { Location, GISOverview, InventoryItem, LogisticsEvent } from "../api/client";
import { MapView } from "./MapView";
import { LocationsView } from "./LocationsView";
import { InventoryView } from "./InventoryView";
import { EventsView } from "./EventsView";

interface MapAndLocationsViewProps {
  locations: Location[];
  inventory: InventoryItem[];
  events: LogisticsEvent[];
  gisOverview: GISOverview | null;
  onRefreshData: () => void;
  initialSubTab?: string;
  selectedLocationId?: string | null;
  onNavigateForecast?: (locationId: string) => void;
}

export const MapAndLocationsView: React.FC<MapAndLocationsViewProps> = ({
  locations,
  inventory,
  events,
  gisOverview,
  onRefreshData,
  initialSubTab = "map",
  selectedLocationId,
  onNavigateForecast,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<string>(initialSubTab);

  const subTabs = [
    { id: "map", label: "Interactive Corridor Map", icon: Map, count: locations.length },
    { id: "locations", label: "Locations Directory", icon: Building2, count: locations.length },
    { id: "inventory", label: "Stock Ledgers", icon: Package, count: inventory.length },
    { id: "events", label: "Logistics Movements", icon: Truck, count: events.length },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      {/* Sub-Header Bar with Contextual Tabs */}
      <div style={{
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid var(--border-subtle)",
        padding: "0.6rem 1.75rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "0.75rem"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{
            width: "28px",
            height: "28px",
            borderRadius: "6px",
            backgroundColor: "var(--primary-light)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--primary)"
          }}>
            <Compass size={16} />
          </div>
          <div>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
              Map &amp; Locations Workspace
            </h2>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>
              Geographic corridor map, terrain profiles, facility registry, forward stock ledgers, and logistics movements.
            </p>
          </div>
        </div>

        {/* Sub-tab pills */}
        <div style={{
          display: "flex",
          backgroundColor: "var(--bg-main)",
          padding: "0.25rem",
          borderRadius: "8px",
          border: "1px solid var(--border-subtle)",
          gap: "0.2rem"
        }}>
          {subTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  padding: "0.4rem 0.75rem",
                  fontSize: "0.785rem",
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#FFFFFF" : "var(--text-main)",
                  backgroundColor: isActive ? "var(--primary)" : "transparent",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  fontFamily: "var(--font-sans)"
                }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                <span style={{
                  fontSize: "0.68rem",
                  opacity: isActive ? 0.9 : 0.6,
                  padding: "0.05rem 0.35rem",
                  borderRadius: "4px",
                  backgroundColor: isActive ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.06)",
                  marginLeft: "0.2rem"
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-view Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {activeSubTab === "map" && (
          <MapView
            locations={locations}
            gisOverview={gisOverview}
            onRefreshData={onRefreshData}
            selectedLocationId={selectedLocationId}
            onNavigateForecast={onNavigateForecast}
          />
        )}

        {activeSubTab === "locations" && (
          <LocationsView
            locations={locations}
            onRefresh={onRefreshData}
            onSelectOnMap={(loc) => {
              setActiveSubTab("map");
            }}
          />
        )}

        {activeSubTab === "inventory" && (
          <InventoryView
            inventory={inventory}
            locations={locations}
            onRefresh={onRefreshData}
          />
        )}

        {activeSubTab === "events" && (
          <EventsView
            events={events}
            locations={locations}
            inventory={inventory}
            onRefresh={onRefreshData}
          />
        )}
      </div>
    </div>
  );
};

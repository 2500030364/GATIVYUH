import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { OverviewView } from "./components/OverviewView";
import { MapAndLocationsView } from "./components/MapAndLocationsView";
import { PredictionsAndAlertsView } from "./components/PredictionsAndAlertsView";
import { PlanAndSimulateView } from "./components/PlanAndSimulateView";
import { DataManagerView } from "./components/DataManagerView";
import { MissionJourney } from "./components/MissionJourney";
import { X, RefreshCw } from "lucide-react";
import { 
  api, DashboardSummary, Location, InventoryItem, 
  LogisticsEvent, Alert, GISOverview, PriorityQueueItem, DemandAnomaly 
} from "./api/client";

interface AppProps { onReturnToLanding?: () => void; }

export const App: React.FC<AppProps> = ({ onReturnToLanding }) => {
  // 4 Primary Navigation Sections
  const [activeTab, setActiveTab] = useState<string>("overview");

  // Contextual Sub-Tabs per primary section
  const [mapSubTab, setMapSubTab] = useState<string>("map");
  const [predictSubTab, setPredictSubTab] = useState<string>("priority");
  const [planSubTab, setPlanSubTab] = useState<string>("scenarios");

  // Cross-Navigation Selected Context
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [forecastLocationId, setForecastLocationId] = useState<string | undefined>(undefined);
  const [initialScenarioData, setInitialScenarioData] = useState<any>(null);

  // Data Pipeline Modal
  const [showDataModal, setShowDataModal] = useState<boolean>(false);

  // Core Data Telemetry State
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [events, setEvents] = useState<LogisticsEvent[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [gisOverview, setGisOverview] = useState<GISOverview | null>(null);
  const [priorityQueueItems, setPriorityQueueItems] = useState<PriorityQueueItem[]>([]);
  const [anomalies, setAnomalies] = useState<DemandAnomaly[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchAllData = async () => {
    try {
      setErrorMessage(null);
      const [sum, locs, inv, evs, als, gis, pq, anoms] = await Promise.all([
        api.getDashboardSummary(),
        api.getLocations(),
        api.getInventory(),
        api.getEvents({ limit: 100 }),
        api.getAlerts(),
        api.getGISOverview(),
        api.getPriorityQueue().catch(() => []),
        api.getDemandAnomalies().catch(() => []),
      ]);
      setSummary(sum);
      setLocations(locs);
      setInventory(inv);
      setEvents(evs);
      setAlerts(als);
      setGisOverview(gis);
      setPriorityQueueItems(pq);
      setAnomalies(anoms);
    } catch (err: any) {
      console.error("Error fetching platform data:", err);
      setErrorMessage(err.message || "Failed to communicate with GATIVYUH FastAPI backend.");
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleRefreshDemo = async () => {
    setIsRefreshing(true);
    try {
      await api.generateSyntheticData(42, true);
      await fetchAllData();
    } catch (err: any) {
      alert("Failed to reset demo: " + err.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Universal Cross-Section Navigation Handler
  const handleNavigate = (tab: string, subTab?: string, locationId?: string) => {
    // Legacy tab id redirects to 4 core sections
    if (tab === "dashboard" || tab === "overview") {
      setActiveTab("overview");
      return;
    }

    if (tab === "map" || tab === "locations" || tab === "inventory" || tab === "events" || tab === "map-locations") {
      setActiveTab("map-locations");
      if (subTab) {
        setMapSubTab(subTab);
      } else if (tab === "locations") {
        setMapSubTab("locations");
      } else if (tab === "inventory") {
        setMapSubTab("inventory");
      } else if (tab === "events") {
        setMapSubTab("events");
      } else {
        setMapSubTab("map");
      }
      if (locationId) {
        setSelectedLocationId(locationId);
      }
      return;
    }

    if (tab === "forecast" || tab === "anomalies" || tab === "priority-queue" || tab === "alerts" || tab === "predictions-alerts") {
      setActiveTab("predictions-alerts");
      if (subTab) {
        setPredictSubTab(subTab);
      } else if (tab === "forecast") {
        setPredictSubTab("forecast");
      } else if (tab === "anomalies") {
        setPredictSubTab("anomalies");
      } else if (tab === "alerts") {
        setPredictSubTab("alerts");
      } else {
        setPredictSubTab("priority");
      }
      if (locationId) {
        setForecastLocationId(locationId);
      }
      return;
    }

    if (tab === "scenarios" || tab === "digital-twin" || tab === "routes" || tab === "fleet" || tab === "plan-simulate") {
      setActiveTab("plan-simulate");
      if (subTab) {
        setPlanSubTab(subTab);
      } else if (tab === "digital-twin") {
        setPlanSubTab("digital-twin");
      } else if (tab === "routes") {
        setPlanSubTab("routes");
      } else if (tab === "fleet") {
        setPlanSubTab("fleet");
      } else {
        setPlanSubTab("scenarios");
      }
      return;
    }

    if (tab === "data") {
      setShowDataModal(true);
      return;
    }

    setActiveTab(tab);
  };

  const handleOpenForecastForLocation = (locationId: string) => {
    setForecastLocationId(locationId);
    setPredictSubTab("forecast");
    setActiveTab("predictions-alerts");
  };

  const activeAlertsCount = alerts.filter(a => !a.is_acknowledged).length;
  const openPriorityCount = priorityQueueItems.filter(p => p.status === "OPEN" || p.status === "ACKNOWLEDGED").length;
  const openAnomaliesCount = anomalies.filter(a => !a.is_acknowledged).length;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--bg-main)" }}>
      {/* Top Header & 4-Tab Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={handleNavigate}
        activeAlertsCount={activeAlertsCount}
        priorityQueueCount={openPriorityCount}
        anomaliesCount={openAnomaliesCount}
        onRefreshDemo={handleRefreshDemo}
        isRefreshing={isRefreshing}
        onOpenDataTools={() => setShowDataModal(true)}
        onReturnToMission={onReturnToLanding}
      />

      {/* Main View Area */}
      <main className="app-workspace">
        <MissionJourney activeTab={activeTab} mapSubTab={mapSubTab} predictSubTab={predictSubTab} planSubTab={planSubTab} onNavigate={handleNavigate} />
        <div className="workspace-content">
        {errorMessage && (
          <div style={{
            margin: "1.25rem 1.75rem 0",
            padding: "0.85rem 1.25rem",
            backgroundColor: "var(--status-critical-bg)",
            border: "1px solid var(--status-critical-border)",
            borderRadius: "var(--radius-md)",
            fontSize: "0.85rem",
            color: "var(--status-critical)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}>
            <span>Backend Telemetry Error: {errorMessage}</span>
            <button onClick={fetchAllData} className="btn btn-secondary btn-sm">
              Retry
            </button>
          </div>
        )}

        {initialLoading ? (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            padding: "4rem",
            color: "var(--text-muted)",
            gap: "1rem"
          }}>
            <RefreshCw size={32} className="spin-animation" style={{ color: "var(--primary)" }} />
            <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--primary)" }}>
              Initializing GATIVYUH Logistics Platform...
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Verifying real OSM road networks, SRTM elevation models, and forward inventory ledgers.
            </p>
          </div>
        ) : (
          <>
            {/* SECTION 1: OVERVIEW */}
            {activeTab === "overview" && (
              <OverviewView
                summary={summary}
                locations={locations}
                inventory={inventory}
                onNavigate={handleNavigate}
              />
            )}

            {/* SECTION 2: MAP & LOCATIONS */}
            {activeTab === "map-locations" && (
              <MapAndLocationsView
                locations={locations}
                inventory={inventory}
                events={events}
                gisOverview={gisOverview}
                onRefreshData={fetchAllData}
                initialSubTab={mapSubTab}
                selectedLocationId={selectedLocationId}
                onNavigateForecast={handleOpenForecastForLocation}
              />
            )}

            {/* SECTION 3: PREDICTIONS & ALERTS */}
            {activeTab === "predictions-alerts" && (
              <PredictionsAndAlertsView
                locations={locations}
                priorityQueueItems={priorityQueueItems}
                anomalies={anomalies}
                alerts={alerts}
                onRefreshData={fetchAllData}
                initialSubTab={predictSubTab}
                initialLocationId={forecastLocationId}
                onNavigateTab={handleNavigate}
              />
            )}

            {/* SECTION 4: PLAN & SIMULATE */}
            {activeTab === "plan-simulate" && (
              <PlanAndSimulateView
                locations={locations}
                initialSubTab={planSubTab}
                initialScenarioData={initialScenarioData}
              />
            )}
          </>
        )}
        </div>
      </main>

      {/* Secondary Capability Modal: Data Management & CSV Pipeline */}
      {showDataModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(48, 45, 42, 0.6)",
          backdropFilter: "blur(2px)",
          zIndex: 2000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem"
        }}>
          <div style={{
            backgroundColor: "var(--bg-main)",
            borderRadius: "var(--radius-lg)",
            width: "100%",
            maxWidth: "1100px",
            maxHeight: "90vh",
            overflowY: "auto",
            border: "1px solid var(--border-strong)",
            boxShadow: "var(--shadow-lg)",
            display: "flex",
            flexDirection: "column"
          }}>
            <div style={{
              padding: "1rem 1.5rem",
              borderBottom: "1px solid var(--border-subtle)",
              backgroundColor: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              position: "sticky",
              top: 0,
              zIndex: 10
            }}>
              <div>
                <h3 style={{ fontSize: "1.1rem", margin: 0 }}>Data Pipeline &amp; Dataset Management</h3>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>
                  Upload CSV records, configure synthetic dataset generation, and view immutable audit trails.
                </p>
              </div>
              <button
                onClick={() => setShowDataModal(false)}
                className="btn btn-secondary btn-sm"
                style={{ padding: "0.4rem 0.6rem" }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ flex: 1, padding: "0" }}>
              <DataManagerView onRefreshAll={fetchAllData} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

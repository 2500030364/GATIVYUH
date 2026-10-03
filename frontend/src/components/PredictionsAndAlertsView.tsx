import React, { useState } from "react";
import { 
  TrendingUp, BellRing, Activity, AlertTriangle, 
  ShieldCheck, HelpCircle, Info
} from "lucide-react";
import { Location, PriorityQueueItem, DemandAnomaly, Alert } from "../api/client";
import { PriorityQueueView } from "./PriorityQueueView";
import { PredictiveForecastView } from "./PredictiveForecastView";
import { AnomaliesView } from "./AnomaliesView";
import { AlertsView } from "./AlertsView";

interface PredictionsAndAlertsViewProps {
  locations: Location[];
  priorityQueueItems: PriorityQueueItem[];
  anomalies: DemandAnomaly[];
  alerts: Alert[];
  onRefreshData: () => void;
  initialSubTab?: string;
  initialLocationId?: string;
  onNavigateTab?: (tab: string) => void;
}

export const PredictionsAndAlertsView: React.FC<PredictionsAndAlertsViewProps> = ({
  locations,
  priorityQueueItems,
  anomalies,
  alerts,
  onRefreshData,
  initialSubTab = "priority",
  initialLocationId,
  onNavigateTab
}) => {
  const [activeSubTab, setActiveSubTab] = useState<string>(initialSubTab);

  const openPriorityCount = priorityQueueItems.filter(p => p.status === "OPEN" || p.status === "ACKNOWLEDGED").length;
  const openAnomaliesCount = anomalies.filter(a => !a.is_acknowledged).length;
  const activeAlertsCount = alerts.filter(a => !a.is_acknowledged).length;

  const subTabs = [
    { id: "priority", label: "What Needs Attention?", icon: BellRing, badge: openPriorityCount },
    { id: "forecast", label: "Demand Forecasts & Shortages", icon: TrendingUp },
    { id: "anomalies", label: "Demand Anomalies", icon: Activity, badge: openAnomaliesCount },
    { id: "alerts", label: "Threshold Alerts", icon: AlertTriangle, badge: activeAlertsCount },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      {/* Sub-Header Bar */}
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
            <TrendingUp size={16} />
          </div>
          <div>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
              Predictions &amp; Alerts Center
            </h2>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>
              Forecast demand trajectories, estimate days until stock runs low, and review flagged anomalies.
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
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    padding: "0.05rem 0.35rem",
                    borderRadius: "10px",
                    backgroundColor: isActive ? "rgba(255,255,255,0.3)" : "var(--status-critical)",
                    color: "#FFFFFF",
                    marginLeft: "0.2rem"
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-view Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {activeSubTab === "priority" && (
          <PriorityQueueView
            items={priorityQueueItems}
            onRefresh={onRefreshData}
            onNavigateTab={onNavigateTab || (() => {})}
          />
        )}

        {activeSubTab === "forecast" && (
          <PredictiveForecastView
            locations={locations}
            initialLocationId={initialLocationId}
          />
        )}

        {activeSubTab === "anomalies" && (
          <AnomaliesView
            anomalies={anomalies}
            onRefresh={onRefreshData}
          />
        )}

        {activeSubTab === "alerts" && (
          <AlertsView
            alerts={alerts}
            onRefresh={onRefreshData}
          />
        )}
      </div>
    </div>
  );
};

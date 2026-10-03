import React from "react";
import { 
  LayoutDashboard, Map, TrendingUp, GitBranch, Compass,
  Database, RefreshCw, ShieldCheck, Activity
} from "lucide-react";

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeAlertsCount: number;
  priorityQueueCount?: number;
  anomaliesCount?: number;
  onRefreshDemo: () => void;
  isRefreshing: boolean;
  onOpenDataTools: () => void;
  onReturnToMission?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  activeAlertsCount,
  priorityQueueCount = 0,
  anomaliesCount = 0,
  onRefreshDemo,
  isRefreshing,
  onOpenDataTools,
  onReturnToMission,
}) => {
  const totalAlertBadge = priorityQueueCount + anomaliesCount + activeAlertsCount;

  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "map-locations", label: "Map & Locations", icon: Map },
    { 
      id: "predictions-alerts", 
      label: "Predictions & Alerts", 
      icon: TrendingUp, 
      badge: totalAlertBadge > 0 ? totalAlertBadge : undefined 
    },
    { id: "plan-simulate", label: "Plan & Simulate", icon: GitBranch },
  ];

  return (
    <header style={{
      backgroundColor: "#FFFFFF",
      borderBottom: "1px solid var(--border-subtle)",
      position: "sticky",
      top: 0,
      zIndex: 1000,
      boxShadow: "0 1px 4px rgba(48, 45, 42, 0.05)"
    }}>
      {/* Top Banner */}
      <div style={{
        padding: "0.75rem 1.75rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid var(--border-subtle)",
        flexWrap: "wrap",
        gap: "1rem"
      }}>
        {/* Brand identity without stage numbers */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            backgroundColor: "var(--primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#FFFFFF",
            boxShadow: "0 2px 6px rgba(201, 111, 61, 0.3)"
          }}>
            <Compass size={20} strokeWidth={2.2} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem" }}>
              <span style={{
                fontSize: "1.3rem",
                fontWeight: 800,
                color: "var(--primary)",
                letterSpacing: "-0.01em",
                fontFamily: "var(--font-sans)"
              }}>
                GATIVYUH
              </span>
              <span style={{
                fontSize: "0.725rem",
                fontWeight: 600,
                color: "var(--text-muted)",
                letterSpacing: "0.02em"
              }}>
                Logistics Intelligence &amp; Decision Support
              </span>
            </div>
            <p style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              marginTop: "-2px"
            }}>
              Pune – Lonavala Strategic Supply Corridor &bull; Multi-Echelon Forward Planning
            </p>
          </div>
        </div>

        {/* Operational status badges & utilities */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>

          {onReturnToMission && (
            <button onClick={onReturnToMission} className="btn btn-outline btn-sm" title="Return to the GatiVyuh mission introduction">
              <Compass size={13} />
              <span>GatiVyuh / Mission</span>
            </button>
          )}
          
          {/* Solver telemetry pill */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            padding: "0.3rem 0.6rem",
            backgroundColor: "var(--bg-card-light)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "6px",
            fontSize: "0.725rem",
            fontWeight: 600,
            color: "var(--text-main)"
          }}>
            <Activity size={13} color="var(--primary)" />
            <span>SOLVER: HiGHS (LP/MILP)</span>
          </div>

          {/* Database pill */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            padding: "0.3rem 0.6rem",
            backgroundColor: "var(--status-stable-bg)",
            border: "1px solid var(--status-stable-border)",
            borderRadius: "6px",
            fontSize: "0.725rem",
            fontWeight: 600,
            color: "var(--status-stable)"
          }}>
            <ShieldCheck size={13} />
            <span>DB CONNECTED</span>
          </div>

          {/* Data Management Tools Modal Trigger */}
          <button
            onClick={onOpenDataTools}
            className="btn btn-secondary btn-sm"
            title="Import/Export CSV datasets and view data provenance"
          >
            <Database size={13} />
            <span>Data Management</span>
          </button>

          {/* Demo Reset Button */}
          <button
            onClick={onRefreshDemo}
            disabled={isRefreshing}
            className="btn btn-secondary btn-sm"
            title="Reset to reproducible synthetic demo state (Seed 42)"
          >
            <RefreshCw size={13} className={isRefreshing ? "spin-animation" : ""} />
            <span>{isRefreshing ? "Resetting..." : "Reset Demo (Seed 42)"}</span>
          </button>
        </div>
      </div>

      {/* Primary 4-Tab Navigation */}
      <nav style={{
        display: "flex",
        padding: "0 1.75rem",
        gap: "0.5rem",
        backgroundColor: "var(--bg-card-light)"
      }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.75rem 1.25rem",
                fontSize: "0.875rem",
                fontWeight: isActive ? 700 : 600,
                color: isActive ? "var(--primary)" : "var(--text-muted)",
                backgroundColor: isActive ? "#FFFFFF" : "transparent",
                border: "none",
                borderBottom: isActive ? "3px solid var(--primary)" : "3px solid transparent",
                cursor: "pointer",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
                fontFamily: "var(--font-sans)",
                borderRadius: isActive ? "6px 6px 0 0" : "0",
              }}
            >
              <Icon size={16} color={isActive ? "var(--primary)" : "var(--text-light)"} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span style={{
                  padding: "0.1rem 0.45rem",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  backgroundColor: "var(--status-critical)",
                  color: "#FFFFFF",
                  borderRadius: "10px",
                  marginLeft: "0.25rem"
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
};

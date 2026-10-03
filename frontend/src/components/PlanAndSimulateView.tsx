import React, { useState } from "react";
import { 
  GitBranch, Cpu, Navigation, Truck, SlidersHorizontal
} from "lucide-react";
import { Location } from "../api/client";
import { ScenarioSimulatorView } from "./ScenarioSimulatorView";
import { DigitalTwinView } from "./DigitalTwinView";
import { RouteAnalysisView } from "./RouteAnalysisView";
import { FleetManagementView } from "./FleetManagementView";

interface PlanAndSimulateViewProps {
  locations: Location[];
  initialSubTab?: string;
  initialScenarioData?: any;
}

export const PlanAndSimulateView: React.FC<PlanAndSimulateViewProps> = ({
  locations,
  initialSubTab = "scenarios",
  initialScenarioData
}) => {
  const [activeSubTab, setActiveSubTab] = useState<string>(initialSubTab);
  const [scenarioData, setScenarioData] = useState<any>(initialScenarioData);

  const subTabs = [
    { id: "scenarios", label: "What-If Scenarios & Simulation", icon: GitBranch },
    { id: "digital-twin", label: "Digital Twin & Solvers", icon: Cpu },
    { id: "routes", label: "Route & Terrain Analysis", icon: Navigation },
    { id: "fleet", label: "Transport Fleet", icon: Truck },
  ];

  const handleNavigateSubTab = (tabId: string, state?: any) => {
    if (state) {
      setScenarioData(state);
    }
    setActiveSubTab(tabId);
  };

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
            <GitBranch size={16} />
          </div>
          <div>
            <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-main)", margin: 0 }}>
              Plan &amp; Simulate Workspace
            </h2>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>
              Create hypothetical scenarios, simulate road closures and demand surges, optimize multi-depot allocations, and evaluate human reviewer approvals.
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
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-view Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {activeSubTab === "scenarios" && (
          <ScenarioSimulatorView
            locations={locations}
            initialScenarioData={scenarioData}
          />
        )}

        {activeSubTab === "digital-twin" && (
          <DigitalTwinView
            locations={locations}
            onNavigateTab={handleNavigateSubTab}
          />
        )}

        {activeSubTab === "routes" && (
          <RouteAnalysisView
            locations={locations}
          />
        )}

        {activeSubTab === "fleet" && (
          <FleetManagementView
            locations={locations}
          />
        )}
      </div>
    </div>
  );
};

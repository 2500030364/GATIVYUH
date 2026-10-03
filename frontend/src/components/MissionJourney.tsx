import React from "react";
import { Activity, Boxes, CloudSun, Map, Route, ShieldAlert, Truck } from "lucide-react";

interface MissionJourneyProps {
  activeTab: string;
  mapSubTab: string;
  predictSubTab: string;
  planSubTab: string;
  onNavigate: (tab: string, subTab?: string) => void;
}

const checkpoints = [
  { id: "mission", number: "01", title: "MISSION BRIEF", subtitle: "Overview & readiness", icon: Activity, tab: "overview" },
  { id: "demand", number: "02", title: "DEMAND", subtitle: "Forward requirement", icon: Activity, tab: "forecast", subTab: "forecast" },
  { id: "inventory", number: "03", title: "SUPPLY ALLOCATION", subtitle: "Cargo & stock", icon: Boxes, tab: "inventory", subTab: "inventory" },
  { id: "routes", number: "04", title: "ROUTE", subtitle: "Path & constraints", icon: Route, tab: "routes", subTab: "routes" },
  { id: "terrain", number: "05", title: "TERRAIN & WEATHER", subtitle: "Live conditions", icon: CloudSun, tab: "map", subTab: "map" },
  { id: "risk", number: "06", title: "RISK", subtitle: "Threats & mitigation", icon: ShieldAlert, tab: "priority-queue", subTab: "priority" },
  { id: "planning", number: "07", title: "SIMULATE & PLAN", subtitle: "Optimize & dispatch", icon: Truck, tab: "scenarios", subTab: "scenarios" },
  { id: "destination", number: "08", title: "FORWARD FORMATION", subtitle: "Destination readiness", icon: Map, tab: "locations", subTab: "locations" },
];

function currentCheckpoint(activeTab: string, mapSubTab: string, predictSubTab: string, planSubTab: string) {
  if (activeTab === "overview") return 0;
  if (activeTab === "map-locations") return mapSubTab === "inventory" ? 2 : mapSubTab === "locations" ? 7 : mapSubTab === "events" ? 3 : 4;
  if (activeTab === "predictions-alerts") return predictSubTab === "forecast" ? 1 : 5;
  if (activeTab === "plan-simulate") return planSubTab === "routes" ? 3 : 6;
  return 0;
}

export const MissionJourney: React.FC<MissionJourneyProps> = ({ activeTab, mapSubTab, predictSubTab, planSubTab, onNavigate }) => {
  const activeIndex = currentCheckpoint(activeTab, mapSubTab, predictSubTab, planSubTab);

  return (
    <aside className="mission-journey" aria-label="Operational journey">
      <div className="journey-heading">
        <span className="journey-kicker">OPERATIONAL FLOW</span>
        <strong>Supply journey</strong>
      </div>
      <div className="journey-track">
        <span className="journey-rail" aria-hidden="true" />
        <span className="journey-progress" aria-hidden="true" style={{ height: `calc(${(activeIndex / (checkpoints.length - 1)) * 100}% - ${(activeIndex / (checkpoints.length - 1)) * 48}px)` }} />
        <span className="convoy-marker" aria-hidden="true" style={{ top: `calc(24px + ${(activeIndex / (checkpoints.length - 1)) * 100}% - ${(activeIndex / (checkpoints.length - 1)) * 48}px)` }}><Truck size={18} /><b>SUPPLY</b></span>
        {checkpoints.map((point, index) => {
          const Icon = point.icon;
          const state = index === activeIndex ? "active" : index < activeIndex ? "passed" : "";
          return (
            <button
              type="button"
              key={point.id}
              className={`journey-checkpoint ${state}`}
              aria-current={index === activeIndex ? "step" : undefined}
              onClick={() => onNavigate(point.tab, point.subTab)}
            >
              <span className="checkpoint-node"><Icon size={15} /></span>
              <span className="checkpoint-copy">
                <span className="checkpoint-number">{point.number}</span>
                <span className="checkpoint-title">{point.title}</span>
                <span className="checkpoint-subtitle">{point.subtitle}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="journey-inventory-link"><span className="journey-live-dot" /> ROUTE POSITION TRACKED FROM ACTIVE WORKSPACE</div>
    </aside>
  );
};

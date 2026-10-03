import React from "react";
import { ArrowRight, Package, Route, ShieldAlert } from "lucide-react";
import { ScenarioResponse, SupplyAllocationItem } from "../api/client";

interface Props { scenario: ScenarioResponse; }

const FlowLane: React.FC<{ title: string; items: SupplyAllocationItem[]; variant: "baseline" | "simulated" }> = ({ title, items, variant }) => (
  <div className={`scenario-flow-lane ${variant}`}>
    <div className="scenario-flow-heading"><span>{variant === "baseline" ? "CURRENT PLAN" : "SCENARIO PLAN"}</span><strong>{title}</strong></div>
    {items.length ? <div className="scenario-flow-list">
      {items.slice(0, 4).map((item, index) => (
        <div className="scenario-flow-item" key={`${item.source_location_id}-${item.destination_location_id}-${item.category}-${index}`}>
          <div className="scenario-flow-route">
            <span className="scenario-flow-node">{item.source_location_name}</span>
            <span className="scenario-flow-line"><i /></span>
            <span className="scenario-flow-node destination">{item.destination_location_name}</span>
          </div>
          <div className="scenario-flow-meta"><span><Package size={12} /> {item.category.replaceAll("_", " ")}</span><strong>{item.quantity_allocated.toLocaleString()} units</strong><small>{item.route_name} · {item.distance_km} km</small></div>
        </div>
      ))}
      {items.length > 4 && <span className="scenario-flow-more">+ {items.length - 4} additional allocations in the plan</span>}
    </div> : <div className="scenario-flow-empty">Run the scenario to generate its allocation route.</div>}
  </div>
);

export const ScenarioRouteComparison: React.FC<Props> = ({ scenario }) => {
  const baseline = (scenario.baseline_results?.allocations || []) as SupplyAllocationItem[];
  const simulated = (scenario.simulation_results?.allocations || scenario.allocation_plan || []) as SupplyAllocationItem[];
  const closedRoutes = scenario.scenario_inputs.road_closures || [];

  return (
    <section className="scenario-route-comparison" aria-label="Baseline and scenario supply route comparison">
      <div className="scenario-route-title"><div><span className="route-eyebrow">OPERATIONAL DECISION LAYER</span><h3><Route size={17} /> Current movement → simulated allocation</h3></div><span className="scenario-route-code">{scenario.scenario_code}</span></div>
      {closedRoutes.length > 0 && <div className="scenario-closure-note"><ShieldAlert size={14} /> Configured corridor closures: {closedRoutes.join(", ")}</div>}
      <div className="scenario-flow-columns">
        <FlowLane title="Existing allocation" items={baseline} variant="baseline" />
        <div className="scenario-flow-transition"><ArrowRight size={19} /></div>
        <FlowLane title="Solver result" items={simulated} variant="simulated" />
      </div>
    </section>
  );
};

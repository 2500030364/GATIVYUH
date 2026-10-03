import React from "react";
import { ArrowDownRight, ArrowUpRight, Boxes, MapPinned, Package, Truck } from "lucide-react";
import { DashboardSummary, InventoryItem, Location } from "../api/client";

interface Props {
  summary: DashboardSummary;
  locations: Location[];
  inventory: InventoryItem[];
  onNavigate: (tab: string, subTab?: string, locationId?: string) => void;
}

const pointColor = (status: string) => status === "CRITICAL" ? "#B71C1C" : status === "AT_RISK" ? "#B96B3E" : status === "WATCH" ? "#A47729" : "#536B4F";

export const MissionBriefPanel: React.FC<Props> = ({ summary, locations, inventory, onNavigate }) => {
  const orderedLocations = [...locations].sort((a, b) => a.longitude - b.longitude || a.latitude - b.latitude);
  const coords = orderedLocations.map(loc => [loc.longitude, loc.latitude] as const);
  const minX = coords.length ? Math.min(...coords.map(p => p[0])) : 0;
  const maxX = coords.length ? Math.max(...coords.map(p => p[0])) : 1;
  const minY = coords.length ? Math.min(...coords.map(p => p[1])) : 0;
  const maxY = coords.length ? Math.max(...coords.map(p => p[1])) : 1;
  const width = maxX - minX || 1;
  const height = maxY - minY || 1;
  const positions = orderedLocations.map((location, index) => ({
    location,
    x: 60 + ((location.longitude - minX) / width) * 720,
    y: 68 + (1 - (location.latitude - minY) / height) * 245,
    index,
  }));
  const route = positions.map(p => `${p.index === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const categories = summary.categories;
  const activeMovements = summary.flows.in_transit_count;
  const activeEvent = summary.recent_events.find(event => event.status === "IN_TRANSIT" && event.destination_id);
  const eventOrigin = activeEvent ? positions.find(point => point.location.id === activeEvent.location_id) : undefined;
  const eventDestination = activeEvent?.destination_id ? positions.find(point => point.location.id === activeEvent.destination_id) : undefined;
  const transitPoint = eventOrigin && eventDestination ? {
    x: (eventOrigin.x + eventDestination.x) / 2,
    y: (eventOrigin.y + eventDestination.y) / 2,
  } : positions[Math.max(0, Math.floor((positions.length - 1) * 0.48))];
  const activeDispatchPath = eventOrigin && eventDestination ? `M ${eventOrigin.x} ${eventOrigin.y} L ${eventDestination.x} ${eventDestination.y}` : "";
  const startPoint = positions[0];
  const convoyPoint = activeMovements > 0 ? transitPoint : startPoint;

  return (
    <section className="mission-brief-panel" aria-labelledby="mission-title">
      <div className="mission-brief-copy">
        <div className="mission-status-line"><span className="mission-live-dot" /> MISSION IN PROGRESS <span className="mission-sector">PUNE — LONAVALA CORRIDOR</span></div>
        <h1 id="mission-title">Supply movement,<br /><em>seen as one operation.</em></h1>
        <p>Demand, forward stock, route conditions and operational risk converge along the corridor.</p>
        <div className="mission-metrics">
          <button onClick={() => onNavigate("events")}><span>IN TRANSIT</span><strong>{activeMovements}</strong><small>active movements</small></button>
          <button onClick={() => onNavigate("locations")}><span>FORMATIONS</span><strong>{summary.total_locations}</strong><small>tracked locations</small></button>
          <button onClick={() => onNavigate("priority-queue")}><span>ATTENTION</span><strong>{summary.active_alerts_count}</strong><small>open alerts</small></button>
        </div>
        <div className="mission-actions">
          <button className="btn btn-primary" onClick={() => onNavigate("map-locations", "map")}><MapPinned size={15} /> Open live corridor</button>
          <button className="mission-text-link" onClick={() => onNavigate("forecast", "forecast")}>Review forward demand <ArrowUpRight size={15} /></button>
        </div>
      </div>

      <div className="route-theater">
        <div className="route-theater-heading">
          <div><span className="route-eyebrow">OPERATIONAL CORRIDOR · LOCATION COORDINATE SCHEMATIC</span><strong>{activeEvent && eventOrigin && eventDestination ? `${eventOrigin.location.name} → ${eventDestination.location.name}` : "Tracked formations across the corridor"}</strong></div>
          <span className={`route-status ${activeMovements > 0 ? "moving" : "ready"}`}><i />{activeMovements > 0 ? `${activeMovements} MOVING` : "ROUTE READY"}</span>
        </div>
        <div className="route-map-frame">
          {positions.length > 0 ? (
            <svg className="route-map-svg" viewBox="0 0 840 380" role="img" aria-label="Supply route connecting real tracked locations; risk-colored nodes reflect current location status">
              <path className="route-path-shadow" d={route} />
              <path className="route-path-base" d={route} />
              {activeMovements > 0 && activeDispatchPath && <path className="route-path-active" d={activeDispatchPath} />}
              {positions.map(({ location, x, y, index }) => (
                <g key={location.id} className="route-location" role="button" tabIndex={0} aria-label={`Open ${location.name} on map`} onClick={() => onNavigate("map-locations", "map", location.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") onNavigate("map-locations", "map", location.id); }}>
                  <circle cx={x} cy={y} r={location.status === "CRITICAL" || location.status === "AT_RISK" ? 12 : 8} fill={pointColor(location.status)} className="route-point" />
                  <circle cx={x} cy={y} r="3" fill="white" />
                  <title>{location.name}</title>
                  <text x={x} y={y + (index % 2 === 0 ? 26 : -17)} textAnchor={index === 0 ? "start" : index === positions.length - 1 ? "end" : "middle"} className="route-map-label">{location.name.split(" ").slice(0, 2).join(" ")}</text>
                  {(location.status === "CRITICAL" || location.status === "AT_RISK") && <text x={x} y={y - 19} textAnchor="middle" className="route-hazard-label">{location.status.replace("_", " ")}</text>}
                </g>
              ))}
              {convoyPoint && <g className={activeMovements > 0 ? "route-convoy is-moving" : "route-convoy"} transform={`translate(${convoyPoint.x - 28} ${convoyPoint.y - 43})`} aria-label={activeMovements > 0 ? "Active supply convoy" : "Convoy staged at depot"}>
                <rect x="0" y="9" width="39" height="23" rx="5" className="convoy-cab" />
                <path d="M39 16h12l10 9v7H39z" className="convoy-trailer" />
                <path d="M43 18h7l6 6H43z" className="convoy-window" />
                <circle cx="13" cy="34" r="5" className="convoy-wheel" /><circle cx="48" cy="34" r="5" className="convoy-wheel" />
                <text x="30" y="3" textAnchor="middle" className="convoy-caption">{activeMovements > 0 ? "IN TRANSIT · SCHEMATIC" : "STAGED"}</text>
              </g>}
              {!positions.length && <text x="420" y="190" textAnchor="middle" className="route-empty-label">Location telemetry is unavailable</text>}
            </svg>
          ) : <div className="route-empty">Waiting for location telemetry…</div>}
          <div className="route-map-key"><span><i className="key-depot" /> Origin</span><span><i className="key-route" /> Location sequence</span><span><i className="key-risk" /> Location at risk</span></div>
        </div>

        <div className="cargo-manifest">
          <div className="cargo-manifest-title"><span><Boxes size={15} /> FORWARD CARGO</span><button onClick={() => onNavigate("inventory")}><Package size={13} /> Stock ledgers</button></div>
          <div className="cargo-modules">
            {categories.map(category => {
              const total = category.total_available + category.total_reserved;
              const availablePct = total > 0 ? (category.total_available / total) * 100 : 0;
              return <button className="cargo-module" key={category.category} onClick={() => onNavigate("inventory")}>
                <span className="cargo-module-top"><span>{category.category.replaceAll("_", " ")}</span><strong>{category.total_available.toLocaleString()} <small>{category.unit}</small></strong></span>
                <span className="cargo-load-track"><i style={{ width: `${availablePct}%` }} /></span>
                <span className="cargo-module-foot"><span>{category.items_count} SKUs</span><span>{category.total_reserved.toLocaleString()} reserved</span></span>
              </button>;
            })}
            {categories.length === 0 && inventory.length === 0 && <div className="cargo-empty"><Package size={16} /> No inventory telemetry available</div>}
          </div>
        </div>
        <div className="route-theater-footer"><span><Truck size={14} /> {activeMovements} active convoy{activeMovements === 1 ? "" : "s"}</span><span><ArrowDownRight size={14} /> Location connectors are schematic; open the live map for roads and terrain</span></div>
      </div>
    </section>
  );
};

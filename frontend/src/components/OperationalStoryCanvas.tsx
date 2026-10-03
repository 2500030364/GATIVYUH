import React from "react";
import { Activity, Boxes, CloudSun, Gauge, MapPinned, Package, Radio, Route, ShieldAlert, Truck, Waypoints } from "lucide-react";
import { CorridorRouteSegment, DashboardSummary, GISOverview, InventoryItem, Location, WeatherObservation } from "../api/client";

interface Props {
  stage: number;
  summary: DashboardSummary | null;
  locations: Location[];
  inventory: InventoryItem[];
  corridors: CorridorRouteSegment[];
  gis: GISOverview | null;
  weather: WeatherObservation | null;
}

const extractLines = (geometry: any): number[][][] => {
  if (!geometry) return [];
  if (geometry.type === "LineString" && Array.isArray(geometry.coordinates)) return [geometry.coordinates];
  if (geometry.type === "MultiLineString" && Array.isArray(geometry.coordinates)) return geometry.coordinates;
  return [];
};

const signalPositions = [
  { x: 130, y: 84, name: "DEMAND", icon: Activity },
  { x: 420, y: 68, name: "INVENTORY", icon: Boxes },
  { x: 735, y: 104, name: "WEATHER", icon: CloudSun },
  { x: 225, y: 246, name: "TERRAIN", icon: MapPinned },
  { x: 565, y: 272, name: "TRANSPORT", icon: Truck },
  { x: 805, y: 216, name: "RISK", icon: ShieldAlert },
];

export const OperationalStoryCanvas: React.FC<Props> = ({ stage, summary, locations, inventory, corridors, gis, weather }) => {
  const actualCorridors = corridors.flatMap(corridor => extractLines(corridor.geometry_geojson).map(line => ({ corridor, line })));
  const locationCoords = locations.map(location => [location.longitude, location.latitude]);
  const routeCoords = actualCorridors.flatMap(({ line }) => line);
  const allCoords = [...locationCoords, ...routeCoords].filter(point => Number.isFinite(point[0]) && Number.isFinite(point[1]));
  const minLon = allCoords.length ? Math.min(...allCoords.map(point => point[0])) : 0;
  const maxLon = allCoords.length ? Math.max(...allCoords.map(point => point[0])) : 1;
  const minLat = allCoords.length ? Math.min(...allCoords.map(point => point[1])) : 0;
  const maxLat = allCoords.length ? Math.max(...allCoords.map(point => point[1])) : 1;
  const project = (lon: number, lat: number) => ({
    x: 70 + ((lon - minLon) / (maxLon - minLon || 1)) * 770,
    y: 50 + (1 - (lat - minLat) / (maxLat - minLat || 1)) * 330,
  });
  const fallbackPoints = [...locations].sort((a, b) => a.longitude - b.longitude).map(location => project(location.longitude, location.latitude));
  const fallbackPath = fallbackPoints.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
  const openCorridors = corridors.filter(corridor => !corridor.is_blocked);
  const blockedCorridors = corridors.filter(corridor => corridor.is_blocked);
  const selectedLine = actualCorridors.find(item => !item.corridor.is_blocked) || actualCorridors[0];
  const movementCount = summary?.flows.in_transit_count || 0;
  const cargo = summary?.categories || [];
  const activeLocation = locations.find(location => location.status === "CRITICAL" || location.status === "AT_RISK") || locations[0];
  const convoyVisible = stage >= 4;
  const journeyProgress = Math.max(0, Math.min(1, (stage - 4) / 4));
  const convoyCoordinate = selectedLine?.line.length
    ? selectedLine.line[Math.min(selectedLine.line.length - 1, Math.floor(journeyProgress * (selectedLine.line.length - 1)))]
    : null;
  const convoyXY = convoyCoordinate ? project(convoyCoordinate[0], convoyCoordinate[1]) : fallbackPoints[0];
  const activeRisk = locations.find(location => location.status === "CRITICAL") || locations.find(location => location.status === "AT_RISK");
  const totalStock = inventory.reduce((sum, item) => sum + item.available_stock, 0);
  const firstDemand = summary?.recent_alerts.find(alert => !alert.is_acknowledged);

  return (
    <div className={`story-canvas story-stage-${stage}`}>
      <div className="canvas-topline"><span><i /> OPERATIONAL PICTURE</span><span>{gis?.region_name || "PUNE — LONAVALA CORRIDOR"}</span></div>
      <svg className="story-map" viewBox="0 0 900 440" role="img" aria-label="Operational network composed from existing location and corridor data">
        <defs>
          <linearGradient id="storyRouteGradient" x1="0" x2="1"><stop offset="0" stopColor="#687e60" /><stop offset="1" stopColor="#9aaa8f" /></linearGradient>
          <filter id="storySoftShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#263a28" floodOpacity=".16" /></filter>
        </defs>
        <path className="story-contour contour-one" d="M-20 103 C120 18 270 145 392 79S640 3 930 98" />
        <path className="story-contour contour-two" d="M-15 139 C120 50 276 173 411 111S664 44 925 132" />
        <path className="story-contour contour-three" d="M-30 319 C116 233 290 363 432 292S694 205 931 305" />
        <path className="story-contour contour-four" d="M-28 353 C127 266 283 390 442 326S713 247 930 345" />
        <g className={`story-network-lines ${stage >= 3 ? "connected" : "fragmented"}`}>
          {signalPositions.map((signal, index) => {
            const next = signalPositions[index + 1];
            if (!next) return null;
            return <path key={`signal-link-${signal.name}`} d={`M ${signal.x} ${signal.y} C ${(signal.x + next.x) / 2} ${signal.y}, ${(signal.x + next.x) / 2} ${next.y}, ${next.x} ${next.y}`} />;
          })}
        </g>
        {actualCorridors.map(({ corridor, line }, index) => {
          const d = line.map((coordinate, pointIndex) => {
            const xy = project(coordinate[0], coordinate[1]);
            return `${pointIndex ? "L" : "M"} ${xy.x} ${xy.y}`;
          }).join(" ");
          return <path key={`${corridor.id}-${index}`} className={`gis-road ${corridor.is_blocked ? "blocked" : "open"} ${stage >= 3 ? "revealed" : "quiet"} ${stage >= 6 && !corridor.is_blocked ? "alternate" : ""}`} d={d} />;
        })}
        {!actualCorridors.length && fallbackPath && <path className="location-schematic-line" d={fallbackPath} />}
        {locations.map(location => {
          const xy = project(location.longitude, location.latitude);
          const risk = location.status === "CRITICAL" || location.status === "AT_RISK";
          return <g key={location.id} className={`story-location ${risk ? "risk" : ""}`} transform={`translate(${xy.x} ${xy.y})`}>
            <circle r={risk ? 8 : 5} />
            <circle className="location-core" r="2.2" />
            <text x="9" y="-8">{location.name.split(" ").slice(0, 2).join(" ")}</text>
            <title>{location.name} · {location.status}</title>
          </g>;
        })}
        {signalPositions.map((signal, index) => {
          const Icon = signal.icon;
          return <g key={signal.name} className={`signal-fragment ${stage >= 2 ? "visible" : "hidden"} ${stage >= 3 ? "linked" : ""}`} transform={`translate(${signal.x} ${signal.y})`} style={{ transitionDelay: `${index * 55}ms` }}>
            <rect x="-68" y="-22" width="136" height="44" rx="9" />
            <foreignObject x="-57" y="-14" width="118" height="30"><div className="signal-content"><Icon size={13} /><span>{signal.name}</span></div></foreignObject>
          </g>;
        })}
        {stage >= 1 && firstDemand && <g className="requirement-panel" transform="translate(45 43)">
          <rect width="205" height="86" rx="10" />
          <text x="14" y="21" className="panel-eyebrow">SUPPLY REQUIREMENT · LIVE ALERT</text>
          <text x="14" y="44" className="panel-main">{firstDemand.location_name || "Forward formation"}</text>
          <text x="14" y="65" className="panel-detail">{firstDemand.category} · {firstDemand.severity}</text>
        </g>}
        {stage >= 2 && cargo.slice(0, 3).map((category, index) => (
          <g key={category.category} className="cargo-float" transform={`translate(${295 + index * 174} 375)`} style={{ transitionDelay: `${index * 90}ms` }}>
            <rect width="158" height="41" rx="8" />
            <text x="12" y="16" className="cargo-label">{category.category.replaceAll("_", " ")}</text>
            <text x="12" y="32" className="cargo-value">{category.total_available.toLocaleString()} {category.unit}</text>
          </g>
        ))}
        {stage >= 5 && blockedCorridors.map((corridor, index) => {
          const geomLine = extractLines(corridor.geometry_geojson)[0];
          if (!geomLine?.length) return null;
          const xy = project(geomLine[Math.floor(geomLine.length / 2)][0], geomLine[Math.floor(geomLine.length / 2)][1]);
          return <g key={corridor.id} className="story-hazard" transform={`translate(${xy.x} ${xy.y})`} style={{ transitionDelay: `${index * 100}ms` }}>
            <circle r="18" /><text y="5" textAnchor="middle">!</text><text className="hazard-caption" y="31" textAnchor="middle">{corridor.name}</text>
          </g>;
        })}
        {convoyVisible && convoyXY && <g className={`story-convoy ${movementCount ? "reported-moving" : "staged"}`} transform={`translate(${convoyXY.x - 24} ${convoyXY.y - 31})`} filter="url(#storySoftShadow)">
          <rect className="convoy-load" x="0" y="7" width="31" height="19" rx="4" /><path className="convoy-front" d="M31 12h12l8 8v6H31z" />
          <path className="convoy-glass" d="M34 14h8l5 5H34z" /><circle className="convoy-tire" cx="10" cy="28" r="4" /><circle className="convoy-tire" cx="40" cy="28" r="4" />
          <text x="24" y="0" textAnchor="middle">{movementCount ? "CONVOY · IN TRANSIT" : "CONVOY · STAGED"}</text>
        </g>}
      </svg>
      <div className="canvas-footnote"><span><Waypoints size={13} /> GIS corridor &amp; location state</span><span><Radio size={13} /> {movementCount ? `${movementCount} movement${movementCount === 1 ? "" : "s"} reported` : "No in-transit movement reported"}</span></div>
      <div className="canvas-data-rail">
        <span><Gauge size={12} /> {gis?.terrain.min_elevation !== undefined && gis?.terrain.max_elevation !== undefined ? `${gis.terrain.min_elevation}–${gis.terrain.max_elevation} m elevation range` : gis?.terrain.status_message || "Terrain telemetry"}</span>
        <span><CloudSun size={12} /> {weather?.status === "UNAVAILABLE" ? "Weather unavailable" : weather ? `${weather.temp_c ?? "—"}°C · ${weather.precipitation_mm ?? "—"} mm` : "Weather loads from selected formation"}</span>
        <span><Package size={12} /> {inventory.length ? `${totalStock.toLocaleString()} available units` : "Inventory telemetry loading"}</span>
        <span><Route size={12} /> {openCorridors.length} available · {blockedCorridors.length} blocked segments</span>
        {activeLocation && <span className="canvas-risk-state"><ShieldAlert size={12} /> {activeRisk ? `${activeRisk.name} · ${activeRisk.status}` : "No critical location status"}</span>}
      </div>
    </div>
  );
};

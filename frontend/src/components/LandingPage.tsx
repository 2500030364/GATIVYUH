import React, { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Compass, GitBranch, Layers3, MoveRight, ShieldCheck, Sparkles } from "lucide-react";
import { api, CorridorRouteSegment, DashboardSummary, ForecastResponse, GISOverview, InventoryItem, Location, WeatherObservation } from "../api/client";
import { OperationalStoryCanvas } from "./OperationalStoryCanvas";

interface Props { onEnter: () => void; }
type StoryData = { summary: DashboardSummary | null; locations: Location[]; inventory: InventoryItem[]; corridors: CorridorRouteSegment[]; gis: GISOverview | null; forecast: ForecastResponse | null; weather: WeatherObservation | null };

const chapters = [
  { id: "quiet", label: "Arrival", title: "A promise, made across distance.", body: "Assured supply. In uncertain terrain.", eyebrow: "01 · THE QUIET BEGINNING", stage: 0 },
  { id: "requirement", label: "Requirement", title: "A requirement reaches forward.", body: "A formation reports what it needs. Time, distance and conditions shape what can reach it.", eyebrow: "02 · THE REQUIREMENT", stage: 1 },
  { id: "fragments", label: "Fragments", title: "The signals already exist.", body: "Demand. Stock. Weather. Terrain. Transport. Road status. Consumption. Risk. Each tells part of the story.", eyebrow: "03 · FRAGMENTED INFORMATION", stage: 2 },
  { id: "connection", label: "Connection", title: "Intelligence connects the pieces.", body: "Forecasts meet inventory. Allocation meets transport. Route conditions meet operational risk. One picture begins to form.", eyebrow: "04 · THE CONNECTION", stage: 3 },
  { id: "convoy", label: "Movement", title: "Information becomes movement.", body: "A decision leaves the depot. The route, cargo and formation now belong to one operation.", eyebrow: "05 · THE CONVOY", stage: 4 },
  { id: "journey", label: "Journey", title: "Every stage changes the decision.", body: "Demand shapes the load. Terrain and weather inform the route. Risk prompts a review. Planning prepares the next move.", eyebrow: "06 · THE JOURNEY", stage: 5 },
  { id: "whatif", label: "What if?", title: "Conditions change. The plan responds.", body: "When a corridor is constrained, GatiVyuh brings route analysis and scenario planning into the same operational picture.", eyebrow: "07 · THE WHAT-IF", stage: 6 },
  { id: "network", label: "Network", title: "One movement belongs to a network.", body: "Depots, transit points and forward formations connect through shared supply, routes and decisions.", eyebrow: "08 · THE NETWORK REVEAL", stage: 7 },
  { id: "system", label: "The system", title: "Step into the operation.", body: "Explore live location status, inventory, forecasts, terrain, weather and planning in the GatiVyuh workspace.", eyebrow: "09 · THE SYSTEM", stage: 8 },
];

export const LandingPage: React.FC<Props> = ({ onEnter }) => {
  const [data, setData] = useState<StoryData>({ summary: null, locations: [], inventory: [], corridors: [], gis: null, forecast: null, weather: null });
  const [activeChapter, setActiveChapter] = useState(0);
  const chapterRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([api.getDashboardSummary(), api.getLocations(), api.getInventory(), api.getCorridors(), api.getGISOverview()]).then(results => {
      if (cancelled) return;
      const [summary, locations, inventory, corridors, gis] = results;
      const resolvedLocations = locations.status === "fulfilled" ? locations.value : [];
      setData(current => ({
        ...current,
        summary: summary.status === "fulfilled" ? summary.value : null,
        locations: resolvedLocations,
        inventory: inventory.status === "fulfilled" ? inventory.value : [],
        corridors: corridors.status === "fulfilled" ? corridors.value : [],
        gis: gis.status === "fulfilled" ? gis.value : null,
      }));

      const location = resolvedLocations.find(item => item.is_active) || resolvedLocations[0];
      if (location) {
        api.getWeather(location.id, location.latitude, location.longitude).then(weather => {
          if (!cancelled) setData(current => ({ ...current, weather }));
        }).catch(() => undefined);
        api.getDemandForecast(location.id, "FUEL", 14).then(forecast => {
          if (!cancelled) setData(current => ({ ...current, forecast }));
        }).catch(() => undefined);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      const index = visible ? Number((visible.target as HTMLElement).dataset.chapterIndex) : NaN;
      if (Number.isFinite(index)) setActiveChapter(index);
    }, { threshold: [0.22, 0.42, 0.62], rootMargin: "-12% 0px -26% 0px" });
    chapterRefs.current.forEach(section => section && observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const jumpToChapter = (index: number) => chapterRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
  const actualDemand = data.forecast?.forecast_series[0]?.predicted_demand;
  const firstAlert = data.summary?.recent_alerts.find(alert => !alert.is_acknowledged);
  const blockedCount = data.corridors.filter(corridor => corridor.is_blocked).length;

  return (
    <div className="landing-world" style={{ "--story-progress": `${(activeChapter / (chapters.length - 1)) * 100}%` } as React.CSSProperties}>
      <header className="landing-header">
        <a className="landing-brand" href="#arrival" onClick={event => { event.preventDefault(); jumpToChapter(0); }} aria-label="GatiVyuh home">
          <span className="landing-brand-mark"><Compass size={20} /></span>
          <span><strong>GATIVYUH</strong><small>Logistics Intelligence &amp; Decision Support</small></span>
        </a>
        <div className="landing-header-right"><span className="landing-header-note"><i /> FORWARD SUPPLY · OPERATIONAL INTELLIGENCE</span><button className="landing-enter-button" onClick={onEnter}>Enter GatiVyuh <ArrowUpRight size={15} /></button></div>
      </header>

      <div className="landing-progress-rail" aria-label="Story chapters">
        <span className="landing-progress-line" />
        <span className="landing-progress-fill" />
        {chapters.map((chapter, index) => <button key={chapter.id} className={activeChapter === index ? "active" : activeChapter > index ? "passed" : ""} onClick={() => jumpToChapter(index)} aria-label={`Go to ${chapter.label}`} title={chapter.label}><i /><span>{String(index + 1).padStart(2, "0")} · {chapter.label}</span></button>)}
      </div>

      <div className="landing-story-layout">
        <main className="landing-chapters">
          {chapters.map((chapter, index) => (
            <section
              key={chapter.id}
              id={chapter.id === "quiet" ? "arrival" : chapter.id}
              ref={element => { chapterRefs.current[index] = element; }}
              data-chapter-index={index}
              className={`landing-chapter ${activeChapter === index ? "chapter-active" : ""}`}
            >
              <span className="chapter-eyebrow">{chapter.eyebrow}</span>
              <h1 className={index === 0 ? "landing-title" : "chapter-title"}>{index === 0 ? <>Assured supply.<br /><em>In uncertain terrain.</em></> : chapter.title}</h1>
              <p className="chapter-body">{chapter.body}</p>
              {index === 0 && <div className="quiet-data-stamp"><span>FIELD NETWORK</span><b>{data.gis?.region_name || "PUNE — LONAVALA"}</b><small>{data.gis?.roads.feature_count?.toLocaleString() || "—"} mapped road segments · {data.locations.length || "—"} tracked locations</small></div>}
              {index === 1 && <div className="requirement-glass">
                <div className="glass-corner-mark"><Sparkles size={14} /> INCOMING REQUIREMENT</div>
                {firstAlert ? <><strong>{firstAlert.location_name || "Forward formation"}</strong><span>{firstAlert.category} · {firstAlert.severity}</span><small>{firstAlert.reason}</small></> : <><strong>Forward formation</strong><span>{data.summary ? "No open supply alert in current summary" : "Requirement telemetry loading"}</span><small>Live requirement context appears here when the backend reports an open alert.</small></>}
              </div>}
              {index === 2 && <div className="fragment-note"><Layers3 size={16} /><span>Signals become useful when they can be read together.</span></div>}
              {index === 3 && <div className="connection-sequence"><span>DEMAND</span><MoveRight /><span>INVENTORY</span><MoveRight /><span>ALLOCATION</span><MoveRight /><span>ROUTE</span></div>}
              {index === 4 && <div className="movement-note"><span className="movement-dot" /> {data.summary ? `${data.summary.flows.in_transit_count} movement${data.summary.flows.in_transit_count === 1 ? "" : "s"} currently reported in transit` : "Connecting to current movement records"}</div>}
              {index === 5 && <div className="stage-stops">{["DEMAND", "SUPPLY", "ROUTE", "TERRAIN", "RISK", "PLAN", "FORMATION"].map((label, stop) => <button key={label} className={activeChapter >= Math.floor(stop / 6 * (chapters.length - 1)) ? "complete" : ""} onClick={() => jumpToChapter(Math.min(chapters.length - 1, stop + 1))}><b>{String(stop + 1).padStart(2, "0")}</b>{label}</button>)}</div>}
              {index === 6 && <div className="whatif-signal">
                <span className={blockedCount ? "whatif-state constrained" : "whatif-state clear"}>{blockedCount ? `${blockedCount} CONSTRAINED CORRIDOR${blockedCount === 1 ? "" : "S"} REPORTED` : data.corridors.length ? "NO BLOCKED CORRIDOR REPORTED" : "ROUTE STATUS LOADING"}</span>
                <p>{blockedCount ? "The route layer carries the backend corridor constraint into the network view." : "When route analysis reports a constraint, inspect candidates and scenario alternatives in the planning workspace."}</p>
              </div>}
              {index === 7 && <div className="network-facts"><span><b>{data.locations.length || "—"}</b> locations</span><span><b>{data.corridors.length || "—"}</b> corridor segments</span><span><b>{data.summary?.categories.length || "—"}</b> supply categories</span></div>}
              {index === 8 && <button className="landing-enter-cta" onClick={onEnter}>Enter the operational system <ArrowRight size={17} /></button>}
              <div className="chapter-index">{String(index + 1).padStart(2, "0")} <span>/</span> {String(chapters.length).padStart(2, "0")}</div>
            </section>
          ))}
          <footer className="landing-footer"><a href="#arrival" onClick={event => { event.preventDefault(); jumpToChapter(0); }}>GATIVYUH</a><span>Logistics Intelligence &amp; Decision Support</span><button onClick={onEnter}>Open mission workspace <ArrowUpRight size={13} /></button></footer>
        </main>

        <aside className="landing-visual-column" aria-label="Live operational network visualization">
          <div className="landing-visual-sticky">
            <OperationalStoryCanvas stage={chapters[activeChapter].stage} summary={data.summary} locations={data.locations} inventory={data.inventory} corridors={data.corridors} gis={data.gis} weather={data.weather} />
            <div className="visual-stage-caption"><span>THE OPERATIONAL PICTURE</span><strong>{chapters[activeChapter].label}</strong><span className="visual-stage-readout">{data.forecast ? `Forecast · ${actualDemand?.toLocaleString() ?? "—"} ${data.forecast.item_name} / day` : "Demand forecast connects to forward stock"}</span></div>
          </div>
          <div className="landing-scroll-prompt"><ArrowDown size={14} /> SCROLL TO FOLLOW THE JOURNEY</div>
        </aside>
      </div>
    </div>
  );
};

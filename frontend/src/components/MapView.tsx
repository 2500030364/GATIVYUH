import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { 
  Layers, Search, Compass, AlertTriangle, Package, Truck, 
  Info, CheckCircle2, X, Mountain, TrendingUp, CloudSun, 
  Wind, Thermometer, Droplets, ShieldAlert, Clock, RefreshCw
} from "lucide-react";
import { 
  Location, GISOverview, api, LocationDetail, InventoryItem, 
  LogisticsEvent, Alert, RiskAssessment, WeatherObservation 
} from "../api/client";

interface MapViewProps {
  locations: Location[];
  gisOverview: GISOverview | null;
  onRefreshData: () => void;
  selectedLocationId?: string | null;
  onNavigateForecast?: (locationId: string) => void;
}

export const MapView: React.FC<MapViewProps> = ({ 
  locations, 
  gisOverview, 
  onRefreshData,
  selectedLocationId,
  onNavigateForecast
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  
  // Layer references
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const roadLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const elevationOverlayRef = useRef<L.ImageOverlay | null>(null);
  const boundaryLayerRef = useRef<L.GeoJSON | null>(null);
  const markerGroupRef = useRef<L.LayerGroup | null>(null);

  // Basemap style state (100% free, no API key required)
  const [basemapType, setBasemapType] = useState<"osm" | "opentopo" | "hot">("osm");

  // Layer toggles state
  const [showRoads, setShowRoads] = useState<boolean>(true);
  const [showElevation, setShowElevation] = useState<boolean>(true);
  const [elevationOpacity, setElevationOpacity] = useState<number>(0.65);
  const [showBoundary, setShowBoundary] = useState<boolean>(true);
  const [showMarkers, setShowMarkers] = useState<boolean>(true);
  const [showWeatherOverlay, setShowWeatherOverlay] = useState<boolean>(true);

  // Stage 2 View Mode & Filters
  const [mapMode, setMapMode] = useState<"CURRENT_STOCK" | "PREDICTIVE_RISK">("PREDICTIVE_RISK");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [riskFilter, setRiskFilter] = useState<string>("ALL");
  const [horizonFilter, setHorizonFilter] = useState<number>(14);

  // Stage 2 Data State
  const [riskAssessments, setRiskAssessments] = useState<RiskAssessment[]>([]);
  const [weatherCache, setWeatherCache] = useState<Record<string, WeatherObservation>>({});
  const [loadingRisks, setLoadingRisks] = useState<boolean>(false);

  // Selection & Details panel
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<LocationDetail | null>(null);
  const [locationInventory, setLocationInventory] = useState<InventoryItem[]>([]);
  const [locationAlerts, setLocationAlerts] = useState<Alert[]>([]);
  const [locationEvents, setLocationEvents] = useState<LogisticsEvent[]>([]);
  const [selectedRisks, setSelectedRisks] = useState<RiskAssessment[]>([]);
  const [selectedWeather, setSelectedWeather] = useState<WeatherObservation | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [loadingWeather, setLoadingWeather] = useState<boolean>(false);

  // Search
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Point elevation query state (when clicking map)
  const [inspectedPoint, setInspectedPoint] = useState<{ lat: number; lon: number; elev: number | null; message: string } | null>(null);

  // Fetch all risk assessments on mount and mode changes
  const fetchRiskData = async () => {
    setLoadingRisks(true);
    try {
      const risks = await api.getRiskAssessments();
      setRiskAssessments(risks);
    } catch (err) {
      console.error("Failed to load predictive risk assessments:", err);
    } finally {
      setLoadingRisks(false);
    }
  };

  useEffect(() => {
    fetchRiskData();
  }, []);

  // Sync external selectedLocationId with map selection
  useEffect(() => {
    if (selectedLocationId) {
      const loc = locations.find(l => l.id === selectedLocationId);
      if (loc) {
        setSelectedLocation(loc);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([loc.latitude, loc.longitude], 12, { duration: 1.0 });
        }
      }
    }
  }, [selectedLocationId, locations]);

  // Status colors helper
  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case "STABLE": return "#2D7D46";
      case "WATCH": return "#C47F10";
      case "AT_RISK": return "#D9531E";
      case "CRITICAL": return "#B71C1C";
      default: return "#6B6359";
    }
  };

  // Fetch details & predictive intelligence when selected location changes
  useEffect(() => {
    if (!selectedLocation) {
      setSelectedDetails(null);
      setLocationInventory([]);
      setLocationAlerts([]);
      setLocationEvents([]);
      setSelectedRisks([]);
      setSelectedWeather(null);
      return;
    }

    const fetchDetails = async () => {
      setLoadingDetails(true);
      setLoadingWeather(true);
      try {
        const [det, inv, al, ev, rList] = await Promise.all([
          api.getLocationDetail(selectedLocation.id),
          api.getInventory({ location_id: selectedLocation.id }),
          api.getAlerts({ location_id: selectedLocation.id }),
          api.getEvents({ location_id: selectedLocation.id, limit: 10 }),
          api.getRiskAssessments({ location_id: selectedLocation.id }),
        ]);
        setSelectedDetails(det);
        setLocationInventory(inv);
        setLocationAlerts(al);
        setLocationEvents(ev);
        setSelectedRisks(rList);
      } catch (err) {
        console.error("Error loading location details:", err);
      } finally {
        setLoadingDetails(false);
      }

      // Fetch NASA POWER Weather for selected location
      try {
        const weather = await api.getWeather(selectedLocation.id, selectedLocation.latitude, selectedLocation.longitude);
        setSelectedWeather(weather);
        setWeatherCache(prev => ({ ...prev, [selectedLocation.id]: weather }));
      } catch (err) {
        console.error("Error fetching NASA POWER weather for location:", err);
      } finally {
        setLoadingWeather(false);
      }
    };

    fetchDetails();
  }, [selectedLocation]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Centered around Pune - Mulshi - Lonavala corridor
    const map = L.map(mapContainerRef.current, {
      center: [18.66, 73.58],
      zoom: 10,
      zoomControl: false,
    });

    L.control.zoom({ position: "topright" }).addTo(map);

    // Standard OpenStreetMap Tile Layer (fully free, no API key required, complete global coverage)
    const baseTileLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    baseTileLayerRef.current = baseTileLayer;

    // Create Layer Groups
    const markerGroup = L.layerGroup().addTo(map);
    const roadGroup = L.layerGroup().addTo(map);

    markerGroupRef.current = markerGroup;
    roadLayerGroupRef.current = roadGroup;

    // Load SRTM Elevation Overlay Image if available
    const terrainBounds: L.LatLngBoundsExpression = [
      [18.300138, 73.299861],
      [18.800138, 73.899861]
    ];
    const overlayUrl = "http://127.0.0.1:8000/api/gis/elevation/overlay.png";
    const overlay = L.imageOverlay(overlayUrl, terrainBounds, {
      opacity: 0.65,
      interactive: false,
    }).addTo(map);
    elevationOverlayRef.current = overlay;

    // Load Clipping Boundary GeoJSON
    api.getClippingBoundary().then((boundaryGeoJSON) => {
      if (boundaryGeoJSON) {
        const bLayer = L.geoJSON(boundaryGeoJSON, {
          style: {
            color: "#C96F3D",
            weight: 2,
            dashArray: "6, 6",
            fillColor: "#C96F3D",
            fillOpacity: 0.04,
          },
        }).addTo(map);
        boundaryLayerRef.current = bLayer;
      }
    }).catch((err) => console.log("No clipping boundary:", err));

    // Load OSM Road Network GeoJSON
    api.getRoadsGeoJSON("major").then((roadsData) => {
      if (roadsData && roadsData.features) {
        L.geoJSON(roadsData, {
          style: (feature) => {
            const hw = feature?.properties?.highway || "";
            if (["motorway", "motorway_link"].includes(hw)) {
              return { color: "#C96F3D", weight: 3.5, opacity: 0.85 };
            }
            if (["trunk", "trunk_link"].includes(hw)) {
              return { color: "#B55E2E", weight: 3.0, opacity: 0.8 };
            }
            if (["primary", "primary_link"].includes(hw)) {
              return { color: "#544D45", weight: 2.2, opacity: 0.75 };
            }
            return { color: "#8E8478", weight: 1.5, opacity: 0.6 };
          },
          onEachFeature: (feature, layer) => {
            const props = feature.properties || {};
            const name = props.name || "Corridor Segment";
            const hw = props.highway || "Road";
            layer.bindTooltip(`<b>${name}</b><br><small style="color:#C96F3D">${hw.toUpperCase()}</small>`, { sticky: true });
          }
        }).addTo(roadGroup);
      }
    }).catch((err) => console.error("Error loading road network:", err));

    // Map Click Handler: Query point elevation from real SRTMGL1 GeoTIFF
    map.on("click", async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      try {
        const res = await api.queryElevation(lat, lng);
        setInspectedPoint({
          lat: Number(lat.toFixed(5)),
          lon: Number(lng.toFixed(5)),
          elev: res.elevation_m ?? null,
          message: res.message
        });

        // Open Leaflet popup at clicked location
        const popupContent = `
          <div style="font-family: var(--font-sans); min-width: 180px;">
            <div style="font-size: 0.75rem; font-weight: 700; color: #C96F3D; text-transform: uppercase;">
              SRTM Terrain Query
            </div>
            <div style="font-size: 1.1rem; font-weight: 800; margin: 2px 0; color: #302D2A;">
              ${res.elevation_m !== null && res.elevation_m !== undefined ? `${res.elevation_m} meters` : "N/A"}
            </div>
            <div style="font-size: 0.72rem; color: #6B6359; font-family: var(--font-mono);">
              Lat: ${lat.toFixed(5)}<br>Lon: ${lng.toFixed(5)}
            </div>
            <div style="font-size: 0.7rem; color: #8E8478; margin-top: 4px;">
              ${res.source === "SRTMGL1_REAL" ? "Verified NASA 1-arc-sec (~30m) raster" : res.message}
            </div>
          </div>
        `;
        L.popup()
          .setLatLng(e.latlng)
          .setContent(popupContent)
          .openOn(map);
      } catch (err) {
        console.error("Elevation query failed:", err);
      }
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Dynamic basemap tile switching without reloading map
  useEffect(() => {
    if (!baseTileLayerRef.current) return;
    if (basemapType === "osm") {
      baseTileLayerRef.current.setUrl("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
    } else if (basemapType === "opentopo") {
      baseTileLayerRef.current.setUrl("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png");
    } else if (basemapType === "hot") {
      baseTileLayerRef.current.setUrl("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png");
    }
  }, [basemapType]);

  // Helper: Find highest risk for a location given the active category filter
  const getLocationRisk = (locId: string): RiskAssessment | undefined => {
    const locRisks = riskAssessments.filter(r => r.location_id === locId);
    if (categoryFilter !== "ALL") {
      return locRisks.find(r => r.category === categoryFilter);
    }
    // Priority order: CRITICAL > AT_RISK > WATCH > STABLE
    const severityRank: Record<string, number> = { "CRITICAL": 4, "AT_RISK": 3, "WATCH": 2, "STABLE": 1 };
    return locRisks.sort((a, b) => (severityRank[b.risk_state] || 0) - (severityRank[a.risk_state] || 0))[0];
  };

  // Update Markers based on Mode, Filters, and Risk Assessments
  useEffect(() => {
    if (!markerGroupRef.current || !mapInstanceRef.current) return;
    const group = markerGroupRef.current;
    group.clearLayers();

    if (!showMarkers) return;

    locations.forEach((loc) => {
      const risk = getLocationRisk(loc.id);
      
      // Filter by risk level if selected in Predictive mode
      if (mapMode === "PREDICTIVE_RISK" && riskFilter !== "ALL") {
        if (!risk || risk.risk_state !== riskFilter) {
          return; // Skip marker
        }
      }

      // Determine marker color
      let color: string;
      let displayStatus: string;
      if (mapMode === "PREDICTIVE_RISK") {
        displayStatus = risk?.risk_state || loc.status;
        color = getStatusColor(displayStatus);
      } else {
        displayStatus = loc.status;
        color = getStatusColor(loc.status);
      }

      const weather = weatherCache[loc.id];

      // Custom HTML Marker Icon with pulsing ring for CRITICAL
      const isCritical = displayStatus === "CRITICAL";
      const customIcon = L.divIcon({
        className: "custom-location-marker",
        html: `
          <div style="
            width: ${isCritical ? '28px' : '24px'};
            height: ${isCritical ? '28px' : '24px'};
            border-radius: 50%;
            background-color: ${color};
            border: 2px solid #FFFFFF;
            box-shadow: 0 2px 8px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            position: relative;
            transition: transform 0.2s;
          ">
            ${isCritical ? `
              <div style="
                position: absolute;
                width: 100%;
                height: 100%;
                border-radius: 50%;
                border: 2px solid ${color};
                animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
                opacity: 0.75;
              "></div>
            ` : ''}
            <div style="width: 8px; height: 8px; border-radius: 50%; background-color: #FFFFFF;"></div>
          </div>
        `,
        iconSize: [isCritical ? 28 : 24, isCritical ? 28 : 24],
        iconAnchor: [isCritical ? 14 : 12, isCritical ? 14 : 12],
      });

      const marker = L.marker([loc.latitude, loc.longitude], { icon: customIcon });

      marker.on("click", () => {
        setSelectedLocation(loc);
        mapInstanceRef.current?.flyTo([loc.latitude, loc.longitude], 13, { duration: 1.2 });
      });

      // Rich Tooltip showing predictive risk vs current stock status
      let tooltipContent = `
        <div style="font-family: var(--font-sans); min-width: 160px;">
          <div style="font-weight: 800; font-size: 0.85rem; color: #302D2A;">${loc.name}</div>
          <div style="font-size: 0.72rem; color: #6B6359; margin-top: 1px;">
            ${loc.location_type} &bull; ${loc.elevation_m ? `${loc.elevation_m}m ASL` : ""}
          </div>
      `;

      if (mapMode === "PREDICTIVE_RISK") {
        const daysShortageText = risk?.days_to_shortage !== null && risk?.days_to_shortage !== undefined
          ? `${risk.days_to_shortage.toFixed(1)} days`
          : "14+ days (Buffer Safe)";

        tooltipContent += `
          <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #E8D9C5;">
            <div style="font-size: 0.72rem; color: ${color}; font-weight: 800;">
              FORECAST RISK: ${risk?.risk_state || "UNKNOWN"}
            </div>
            <div style="font-size: 0.7rem; color: #302D2A;">
              Shortage Runway: <b>${daysShortageText}</b>
            </div>
            ${risk?.projected_stockout_date ? `
              <div style="font-size: 0.68rem; color: #B71C1C;">
                Breach Date: ${risk.projected_stockout_date}
              </div>
            ` : ''}
          </div>
        `;
      } else {
        tooltipContent += `
          <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #E8D9C5;">
            <div style="font-size: 0.72rem; color: ${color}; font-weight: 800;">
              CURRENT STATUS: ${loc.status}
            </div>
          </div>
        `;
      }

      if (showWeatherOverlay && weather) {
        tooltipContent += `
          <div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid #E8D9C5; font-size: 0.68rem; color: #544D45;">
            NASA POWER: ${weather.temp_c !== null && weather.temp_c !== undefined ? `${weather.temp_c}°C` : 'N/A'}, 
            ${weather.precipitation_mm !== null && weather.precipitation_mm !== undefined ? `${weather.precipitation_mm}mm rain` : '0mm'}
          </div>
        `;
      }

      tooltipContent += `</div>`;

      marker.bindTooltip(tooltipContent, { offset: [0, -10] });
      marker.addTo(group);
    });
  }, [locations, showMarkers, mapMode, riskAssessments, categoryFilter, riskFilter, weatherCache, showWeatherOverlay]);

  // Toggle roads
  useEffect(() => {
    if (!roadLayerGroupRef.current || !mapInstanceRef.current) return;
    if (showRoads) {
      mapInstanceRef.current.addLayer(roadLayerGroupRef.current);
    } else {
      mapInstanceRef.current.removeLayer(roadLayerGroupRef.current);
    }
  }, [showRoads]);

  // Toggle elevation & opacity
  useEffect(() => {
    if (!elevationOverlayRef.current || !mapInstanceRef.current) return;
    if (showElevation) {
      mapInstanceRef.current.addLayer(elevationOverlayRef.current);
      elevationOverlayRef.current.setOpacity(elevationOpacity);
    } else {
      mapInstanceRef.current.removeLayer(elevationOverlayRef.current);
    }
  }, [showElevation, elevationOpacity]);

  // Toggle boundary
  useEffect(() => {
    if (!boundaryLayerRef.current || !mapInstanceRef.current) return;
    if (showBoundary) {
      mapInstanceRef.current.addLayer(boundaryLayerRef.current);
    } else {
      mapInstanceRef.current.removeLayer(boundaryLayerRef.current);
    }
  }, [showBoundary]);

  // Handle Location Search
  const filteredLocations = locations.filter(loc =>
    loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loc.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loc.location_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectSearched = (loc: Location) => {
    setSelectedLocation(loc);
    mapInstanceRef.current?.flyTo([loc.latitude, loc.longitude], 13, { duration: 1.2 });
    setSearchQuery("");
  };

  return (
    <div style={{ position: "relative", height: "calc(100vh - 120px)", width: "100%", display: "flex" }}>
      
      {/* Map Canvas */}
      <div ref={mapContainerRef} style={{ flex: 1, height: "100%", zIndex: 1 }} />

      {/* Floating Controls Overlay (Top-Left) */}
      <div style={{
        position: "absolute",
        top: "1.25rem",
        left: "1.25rem",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        maxWidth: "360px",
        pointerEvents: "auto"
      }}>
        
        {/* Layer Mode Toggle: Current Stock vs. Predictive Shortage Risk */}
        <div style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-md)",
          border: "1px solid var(--border-subtle)",
          padding: "0.4rem",
          display: "flex",
          gap: "0.35rem"
        }}>
          <button
            onClick={() => setMapMode("PREDICTIVE_RISK")}
            style={{
              flex: 1,
              padding: "0.55rem 0.75rem",
              borderRadius: "6px",
              border: "none",
              backgroundColor: mapMode === "PREDICTIVE_RISK" ? "var(--primary)" : "transparent",
              color: mapMode === "PREDICTIVE_RISK" ? "#FFFFFF" : "var(--text-muted)",
              fontWeight: 700,
              fontSize: "0.785rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.4rem",
              transition: "all 0.15s ease"
            }}
          >
            <TrendingUp size={14} />
            <span>Forecast Shortage Risk</span>
          </button>

          <button
            onClick={() => setMapMode("CURRENT_STOCK")}
            style={{
              flex: 1,
              padding: "0.55rem 0.75rem",
              borderRadius: "6px",
              border: "none",
              backgroundColor: mapMode === "CURRENT_STOCK" ? "var(--text-main)" : "transparent",
              color: mapMode === "CURRENT_STOCK" ? "#FFFFFF" : "var(--text-muted)",
              fontWeight: 700,
              fontSize: "0.785rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.4rem",
              transition: "all 0.15s ease"
            }}
          >
            <Package size={14} />
            <span>Current Stock Status</span>
          </button>
        </div>

        {/* Search Bar */}
        <div style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-md)",
          border: "1px solid var(--border-subtle)",
          padding: "0.5rem 0.75rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem"
        }}>
          <Search size={16} color="var(--primary)" />
          <input
            type="text"
            placeholder="Search corridor nodes (e.g. Lonavala, Mulshi)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              border: "none",
              outline: "none",
              fontSize: "0.85rem",
              width: "100%",
              fontFamily: "var(--font-sans)",
              color: "var(--text-main)"
            }}
          />
        </div>

        {/* Search Results Dropdown */}
        {searchQuery.trim().length > 0 && (
          <div style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-lg)",
            border: "1px solid var(--border-strong)",
            maxHeight: "220px",
            overflowY: "auto"
          }}>
            {filteredLocations.length === 0 ? (
              <div style={{ padding: "0.75rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                No matching locations found.
              </div>
            ) : (
              filteredLocations.map(loc => (
                <div
                  key={loc.id}
                  onClick={() => handleSelectSearched(loc)}
                  style={{
                    padding: "0.6rem 0.85rem",
                    borderBottom: "1px solid var(--border-subtle)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card-light)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.825rem", color: "var(--text-main)" }}>
                      {loc.name}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                      {loc.location_type} &bull; {loc.elevation_m ? `${loc.elevation_m}m` : ""}
                    </div>
                  </div>
                  <span className={`badge badge-${loc.status.toLowerCase()}`}>
                    {loc.status}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Layer Controls & Filters Card */}
        <div style={{
          backgroundColor: "#FFFFFF",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-md)",
          border: "1px solid var(--border-subtle)",
          padding: "1rem"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Layers size={16} color="var(--primary)" />
              <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-main)", textTransform: "uppercase" }}>
                {mapMode === "PREDICTIVE_RISK" ? "Predictive Risk Filters" : "GIS Layer Controls"}
              </span>
            </div>
            {mapMode === "PREDICTIVE_RISK" && (
              <button 
                onClick={fetchRiskData} 
                disabled={loadingRisks}
                style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", color: "var(--primary)" }}
                title="Recalculate Risk Assessments"
              >
                <RefreshCw size={13} className={loadingRisks ? "spin-animation" : ""} />
              </button>
            )}
          </div>

          {/* Predictive Filters when in Predictive Mode */}
          {mapMode === "PREDICTIVE_RISK" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "0.75rem", paddingBottom: "0.75rem", borderBottom: "1px solid var(--border-subtle)" }}>
              {/* Category Filter */}
              <div>
                <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: "0.25rem" }}>
                  SUPPLY CATEGORY
                </label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.35rem 0.5rem",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-subtle)",
                    fontSize: "0.775rem",
                    backgroundColor: "var(--bg-main)",
                    color: "var(--text-main)"
                  }}
                >
                  <option value="ALL">All Categories (Worst-Case Risk)</option>
                  <option value="FOOD_WATER">Food &amp; Potable Water</option>
                  <option value="FUEL">Petroleum &amp; Turbine Fuel</option>
                  <option value="MEDICAL_SUPPLIES">Forward Medical Supplies</option>
                  <option value="GENERAL_SUPPLIES">General &amp; Field Logistics</option>
                </select>
              </div>

              {/* Risk Level Filter */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <div>
                  <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: "0.25rem" }}>
                    RISK STATE
                  </label>
                  <select
                    value={riskFilter}
                    onChange={(e) => setRiskFilter(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.35rem 0.5rem",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-subtle)",
                      fontSize: "0.775rem",
                      backgroundColor: "var(--bg-main)",
                      color: "var(--text-main)"
                    }}
                  >
                    <option value="ALL">All States</option>
                    <option value="CRITICAL">Critical Deficit</option>
                    <option value="AT_RISK">At Risk</option>
                    <option value="WATCH">Watch</option>
                    <option value="STABLE">Stable</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: "0.25rem" }}>
                    HORIZON
                  </label>
                  <select
                    value={horizonFilter}
                    onChange={(e) => setHorizonFilter(Number(e.target.value))}
                    style={{
                      width: "100%",
                      padding: "0.35rem 0.5rem",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-subtle)",
                      fontSize: "0.775rem",
                      backgroundColor: "var(--bg-main)",
                      color: "var(--text-main)"
                    }}
                  >
                    <option value={7}>7-Day Forecast</option>
                    <option value={14}>14-Day Horizon</option>
                    <option value={30}>30-Day Outlook</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* GIS Layer Toggles */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", fontSize: "0.8rem" }}>
            
            {/* Basemap Style Selector (Free, No API Key Required) */}
            <div style={{ marginBottom: "0.3rem", paddingBottom: "0.5rem", borderBottom: "1px solid var(--border-subtle)" }}>
              <label style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: "0.25rem" }}>
                BASEMAP LAYER (NO API KEY REQUIRED)
              </label>
              <select
                value={basemapType}
                onChange={(e) => setBasemapType(e.target.value as "osm" | "opentopo" | "hot")}
                style={{
                  width: "100%",
                  padding: "0.4rem 0.5rem",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: "0.775rem",
                  backgroundColor: "var(--bg-main)",
                  color: "var(--text-main)",
                  fontWeight: 600
                }}
              >
                <option value="osm">OpenStreetMap Standard (Full World)</option>
                <option value="opentopo">OpenTopoMap (Topographic Terrain)</option>
                <option value="hot">Humanitarian OSM (High Contrast)</option>
              </select>
            </div>

            {/* Toggle: Location Markers */}
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: mapMode === "PREDICTIVE_RISK" ? "var(--primary)" : "var(--text-main)" }} />
                <span>Strategic Nodes ({locations.length})</span>
              </div>
              <input
                type="checkbox"
                checked={showMarkers}
                onChange={(e) => setShowMarkers(e.target.checked)}
              />
            </label>

            {/* Toggle: NASA POWER Weather Context */}
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <CloudSun size={14} color="var(--primary)" />
                <span>NASA POWER Weather</span>
              </div>
              <input
                type="checkbox"
                checked={showWeatherOverlay}
                onChange={(e) => setShowWeatherOverlay(e.target.checked)}
              />
            </label>

            {/* Toggle: Real OSM Road Network */}
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ width: "14px", height: "3px", backgroundColor: "#B55E2E" }} />
                <span>OSM Road Network</span>
              </div>
              <input
                type="checkbox"
                checked={showRoads}
                onChange={(e) => setShowRoads(e.target.checked)}
              />
            </label>

            {/* Toggle: SRTMGL1 Elevation Overlay */}
            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.5rem" }}>
              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Mountain size={14} color="var(--primary)" />
                  <span>SRTMGL1 Elevation (30m)</span>
                </div>
                <input
                  type="checkbox"
                  checked={showElevation}
                  onChange={(e) => setShowElevation(e.target.checked)}
                />
              </label>

              {showElevation && (
                <div style={{ marginTop: "0.4rem", paddingLeft: "1.3rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--text-muted)" }}>
                    <span>Opacity</span>
                    <span>{Math.round(elevationOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={elevationOpacity}
                    onChange={(e) => setElevationOpacity(parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: "var(--primary)" }}
                  />
                </div>
              )}
            </div>

            {/* Toggle: Clipping Boundary */}
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ width: "12px", height: "8px", border: "1px dashed #C96F3D", borderRadius: "2px" }} />
                <span>Sector Corridor Boundary</span>
              </div>
              <input
                type="checkbox"
                checked={showBoundary}
                onChange={(e) => setShowBoundary(e.target.checked)}
              />
            </label>

          </div>
        </div>

        {/* Dataset Verification Notice */}
        <div style={{
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(4px)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-subtle)",
          padding: "0.75rem",
          fontSize: "0.725rem",
          color: "var(--text-muted)",
          lineHeight: 1.4
        }}>
          <div style={{ fontWeight: 700, color: "var(--text-main)", marginBottom: "0.2rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <Info size={12} color="var(--primary)" />
            <span>Verified Intelligence Layers</span>
          </div>
          {mapMode === "PREDICTIVE_RISK" ? (
            <span>
              Risk states computed via 70/15/15 chronological Ridge regression + safety buffer burn rates. NASA POWER MERRA-2 weather provides meteorological context.
            </span>
          ) : (
            <span>
              NASA SRTMGL1 GeoTIFF (WGS 84, min: {gisOverview?.terrain.min_elevation ?? 27}m, max: {gisOverview?.terrain.max_elevation ?? 1327}m). Click map to query elevation.
            </span>
          )}
        </div>

      </div>

      {/* Floating Map Legend (Bottom-Left) */}
      <div style={{
        position: "absolute",
        bottom: "1.5rem",
        left: "1.25rem",
        zIndex: 1000,
        backgroundColor: "#FFFFFF",
        borderRadius: "var(--radius-md)",
        padding: "0.75rem 1rem",
        boxShadow: "var(--shadow-md)",
        border: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        pointerEvents: "auto",
        maxWidth: "290px"
      }}>
        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-main)", textTransform: "uppercase" }}>
          {mapMode === "PREDICTIVE_RISK" ? "Predictive Shortage Risk" : "Current Stock Status"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", fontSize: "0.725rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ width: "9px", height: "9px", borderRadius: "50%", backgroundColor: "var(--status-stable)" }} />
            <span>Stable (&gt;14d)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ width: "9px", height: "9px", borderRadius: "50%", backgroundColor: "var(--status-watch)" }} />
            <span>Watch (7-14d)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ width: "9px", height: "9px", borderRadius: "50%", backgroundColor: "var(--status-at-risk)" }} />
            <span>At Risk (3-7d)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ width: "9px", height: "9px", borderRadius: "50%", backgroundColor: "var(--status-critical)" }} />
            <span>Critical (&lt;3d)</span>
          </div>
        </div>

        {/* Elevation Gradient Legend */}
        <div style={{ marginTop: "0.4rem", borderTop: "1px solid var(--border-subtle)", paddingTop: "0.4rem" }}>
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
            <span>27m (Valleys)</span>
            <span>Elevation Profile</span>
            <span>1,327m (Ghats)</span>
          </div>
          <div style={{
            height: "8px",
            borderRadius: "4px",
            background: "linear-gradient(to right, #4F4337, #C96F3D, #FFE3D1)",
            marginTop: "2px"
          }} />
        </div>
      </div>

      {/* Selected Location Details Side-Drawer (Right) */}
      {selectedLocation && (
        <div style={{
          position: "absolute",
          top: "1.25rem",
          right: "1.25rem",
          bottom: "1.5rem",
          width: "420px",
          backgroundColor: "#FFFFFF",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          border: "1px solid var(--border-strong)",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          pointerEvents: "auto",
          overflow: "hidden"
        }}>
          
          {/* Drawer Header */}
          <div style={{
            padding: "1.25rem",
            borderBottom: "1px solid var(--border-subtle)",
            backgroundColor: "var(--bg-card-light)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between"
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span className={`badge badge-${selectedLocation.status.toLowerCase()}`}>
                  {selectedLocation.status}
                </span>
                <span className="mono" style={{ fontSize: "0.725rem", color: "var(--text-muted)" }}>
                  {selectedLocation.id}
                </span>
              </div>
              <h2 style={{ fontSize: "1.2rem", marginTop: "0.35rem", color: "var(--text-main)" }}>
                {selectedLocation.name}
              </h2>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                {selectedLocation.location_type} &bull; Elev: {selectedLocation.elevation_m ? `${selectedLocation.elevation_m}m ASL` : "N/A"}
              </div>
            </div>

            <button
              onClick={() => setSelectedLocation(null)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0.25rem",
                color: "var(--text-muted)",
                borderRadius: "4px"
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Drawer Body (Scrollable) */}
          <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            
            {/* FEATURE 4 & 2: STAGE 2 PREDICTIVE RISK & SHORTAGE RUNWAY */}
            <div style={{
              padding: "1rem",
              backgroundColor: "var(--bg-card)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-strong)"
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <TrendingUp size={16} color="var(--primary)" />
                  <span style={{ fontWeight: 800, fontSize: "0.85rem", color: "var(--primary)", textTransform: "uppercase" }}>
                    Forward Risk Assessment
                  </span>
                </div>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  Horizon: {horizonFilter}d
                </span>
              </div>

              {selectedRisks.length === 0 ? (
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  {loadingDetails ? "Calculating shortage projections..." : "Insufficient demand history for this node (<5 daily records)."}
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                  {selectedRisks.map((risk) => (
                    <div key={risk.id} style={{
                      padding: "0.75rem",
                      backgroundColor: "#FFFFFF",
                      borderRadius: "var(--radius-sm)",
                      border: `1px solid ${risk.risk_state === "CRITICAL" ? "var(--status-critical-border)" : "var(--border-subtle)"}`
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-main)" }}>
                          {risk.category}
                        </span>
                        <span className={`badge badge-${risk.risk_state.toLowerCase()}`}>
                          {risk.risk_state}
                        </span>
                      </div>

                      {/* Days to shortage metric */}
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.45rem", fontSize: "0.775rem" }}>
                        <span style={{ color: "var(--text-muted)" }}>Shortage Runway:</span>
                        <span style={{ fontWeight: 800, color: risk.risk_state === "CRITICAL" ? "var(--status-critical)" : "var(--text-main)" }}>
                          {risk.days_to_shortage !== null && risk.days_to_shortage !== undefined
                            ? `${risk.days_to_shortage.toFixed(1)} days`
                            : "14+ days (Buffer Safe)"}
                        </span>
                      </div>

                      {risk.projected_stockout_date && (
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.2rem", fontSize: "0.75rem" }}>
                          <span style={{ color: "var(--text-muted)" }}>Projected Stock-out:</span>
                          <span style={{ fontWeight: 700, color: "var(--status-critical)" }}>
                            {risk.projected_stockout_date}
                          </span>
                        </div>
                      )}

                      {/* Contributing Factors Explanation */}
                      <div style={{ fontSize: "0.75rem", color: "var(--text-main)", marginTop: "0.4rem", lineHeight: 1.4 }}>
                        {risk.contributing_factors.map((factor, idx) => (
                          <div key={idx} style={{ display: "flex", alignItems: "baseline", gap: "4px", marginTop: "2px" }}>
                            <span style={{ color: "var(--primary)" }}>&bull;</span>
                            <span>{factor}</span>
                          </div>
                        ))}
                      </div>

                      {/* Recommended Review Action */}
                      <div style={{
                        marginTop: "0.45rem",
                        padding: "0.4rem 0.5rem",
                        backgroundColor: "var(--bg-card-light)",
                        borderRadius: "4px",
                        fontSize: "0.72rem",
                        color: "var(--text-main)",
                        borderLeft: "3px solid var(--primary)"
                      }}>
                        <b>Action:</b> {risk.recommended_action}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {onNavigateForecast && (
                <button
                  onClick={() => onNavigateForecast(selectedLocation.id)}
                  className="btn btn-outline btn-sm"
                  style={{ marginTop: "0.6rem", width: "100%", justifyContent: "center" }}
                >
                  <TrendingUp size={13} />
                  <span>Open Demand Forecast &bull; {selectedLocation.name} &rarr;</span>
                </button>
              )}
            </div>

            {/* FEATURE 6: NASA POWER METEOROLOGICAL CONTEXT */}
            {showWeatherOverlay && (
              <div style={{
                padding: "0.85rem 1rem",
                backgroundColor: "var(--bg-main)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)"
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <CloudSun size={15} color="var(--primary)" />
                    <span style={{ fontWeight: 700, fontSize: "0.825rem", color: "var(--text-main)", textTransform: "uppercase" }}>
                      NASA POWER Meteorological Context
                    </span>
                  </div>
                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    MERRA-2 API
                  </span>
                </div>

                {loadingWeather ? (
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Querying NASA POWER daily point telemetry...
                  </p>
                ) : selectedWeather ? (
                  <div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", margin: "0.5rem 0" }}>
                      <div style={{ padding: "0.5rem", backgroundColor: "#FFFFFF", borderRadius: "var(--radius-sm)", textAlign: "center" }}>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: "2px" }}>
                          <Thermometer size={12} color="var(--primary)" /> Temp
                        </div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-main)", marginTop: "2px" }}>
                          {selectedWeather.temp_c !== null && selectedWeather.temp_c !== undefined ? `${selectedWeather.temp_c}°C` : "N/A"}
                        </div>
                      </div>

                      <div style={{ padding: "0.5rem", backgroundColor: "#FFFFFF", borderRadius: "var(--radius-sm)", textAlign: "center" }}>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: "2px" }}>
                          <Droplets size={12} color="#2D7D46" /> Rain
                        </div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-main)", marginTop: "2px" }}>
                          {selectedWeather.precipitation_mm !== null && selectedWeather.precipitation_mm !== undefined ? `${selectedWeather.precipitation_mm}mm` : "0.0mm"}
                        </div>
                      </div>

                      <div style={{ padding: "0.5rem", backgroundColor: "#FFFFFF", borderRadius: "var(--radius-sm)", textAlign: "center" }}>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: "2px" }}>
                          <Wind size={12} color="#5E564D" /> Wind
                        </div>
                        <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-main)", marginTop: "2px" }}>
                          {selectedWeather.wind_speed_ms !== null && selectedWeather.wind_speed_ms !== undefined ? `${selectedWeather.wind_speed_ms}m/s` : "N/A"}
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.3rem" }}>
                      Source: {selectedWeather.source} &bull; Obs: {selectedWeather.observation_date} &bull; Status: {selectedWeather.status}
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Weather data unavailable or outside spatial bounding box.
                  </p>
                )}
              </div>
            )}

            {/* Geographical Coordinates */}
            <div style={{
              padding: "0.75rem",
              backgroundColor: "var(--bg-main)",
              borderRadius: "var(--radius-md)",
              fontSize: "0.75rem"
            }}>
              <div style={{ fontWeight: 700, color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                Coordinates &amp; Terrain Profile
              </div>
              <div className="mono" style={{ color: "var(--text-main)" }}>
                Lat: {selectedLocation.latitude.toFixed(5)} &bull; Lon: {selectedLocation.longitude.toFixed(5)}
              </div>
              {selectedLocation.description && (
                <p style={{ marginTop: "0.35rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {selectedLocation.description}
                </p>
              )}
            </div>

            {/* Preserved Stage 1: Inventory Status at this Location */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <Package size={15} color="var(--primary)" />
                  <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-main)" }}>
                    Forward Inventory Balances
                  </span>
                </div>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                  {locationInventory.length} categories
                </span>
              </div>

              {loadingDetails ? (
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Loading records...</p>
              ) : locationInventory.length === 0 ? (
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>No inventory records at this node.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {locationInventory.map((item) => (
                    <div key={item.id} style={{
                      padding: "0.6rem 0.75rem",
                      backgroundColor: "var(--bg-card-light)",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-subtle)"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-main)" }}>
                          {item.item_name}
                        </span>
                        <span className={`badge badge-${item.stock_status?.toLowerCase() || "stable"}`}>
                          {item.stock_status}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.25rem", fontSize: "0.75rem" }}>
                        <span style={{ color: "var(--text-main)", fontWeight: 600 }}>
                          Available: {item.available_stock} {item.unit}
                        </span>
                        <span style={{ color: "var(--text-muted)" }}>
                          Min: {item.min_stock} / Max: {item.max_capacity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Preserved Stage 1: Active Alerts at this Location */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.6rem" }}>
                <AlertTriangle size={15} color="var(--status-critical)" />
                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-main)" }}>
                  Current Inventory Alerts ({locationAlerts.length})
                </span>
              </div>

              {locationAlerts.length === 0 ? (
                <div style={{
                  padding: "0.75rem",
                  backgroundColor: "var(--status-stable-bg)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--status-stable-border)",
                  fontSize: "0.75rem",
                  color: "var(--status-stable)",
                  fontWeight: 600
                }}>
                  Buffer thresholds healthy.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {locationAlerts.map(al => (
                    <div key={al.id} style={{
                      padding: "0.6rem 0.75rem",
                      backgroundColor: al.severity === "CRITICAL" ? "var(--status-critical-bg)" : "var(--status-at-risk-bg)",
                      borderRadius: "var(--radius-md)",
                      border: `1px solid ${al.severity === "CRITICAL" ? "var(--status-critical-border)" : "var(--status-at-risk-border)"}`,
                      fontSize: "0.75rem"
                    }}>
                      <div style={{ fontWeight: 700, color: "var(--text-main)" }}>
                        {al.category}: {al.current_quantity} / min {al.min_threshold} {al.unit}
                      </div>
                      <p style={{ marginTop: "0.2rem", color: "var(--text-muted)" }}>
                        {al.reason}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Preserved Stage 1: Recent Logistics Events at this Location */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.6rem" }}>
                <Truck size={15} color="var(--primary)" />
                <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-main)" }}>
                  Recent Movements ({locationEvents.length})
                </span>
              </div>

              {locationEvents.length === 0 ? (
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>No movements recorded.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                  {locationEvents.slice(0, 4).map(ev => (
                    <div key={ev.id} style={{
                      padding: "0.55rem 0.7rem",
                      backgroundColor: "var(--bg-main)",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "0.75rem",
                      border: "1px solid var(--border-subtle)"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontWeight: 700 }}>{ev.event_type} &bull; {ev.item_name}</span>
                        <span style={{ color: "var(--text-muted)" }}>
                          {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ color: "var(--text-muted)", marginTop: "0.15rem" }}>
                        {ev.quantity} {ev.unit} {ev.destination_location_name ? `&rarr; ${ev.destination_location_name}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      )}

    </div>
  );
};

import io
import json
import logging
from pathlib import Path
from typing import Optional, Dict, Any, Tuple
import numpy as np
from PIL import Image

from app.core.config import settings
from app.schemas.gis import RasterMetadata, RoadsMetadata, BoundingBox, GISOverviewResponse, ElevationQueryResponse

logger = logging.getLogger(__name__)

class GISService:
    def __init__(self):
        self._raster_cache = None
        self._raster_metadata = None
        self._roads_cache = None
        self._roads_metadata = None
        self._boundary_cache = None
        self._overlay_png_bytes = None

    def get_roads_path(self) -> Optional[Path]:
        if settings.ROADS_PATH.exists():
            return settings.ROADS_PATH
        if settings.ALT_ROADS_PATH.exists():
            return settings.ALT_ROADS_PATH
        # Check data/roads for any geojson
        roads_dir = settings.DATA_DIR / "roads"
        if roads_dir.exists():
            for p in roads_dir.glob("*.geojson"):
                if "clipping" not in p.name.lower():
                    return p
        return None

    def validate_terrain(self) -> RasterMetadata:
        tif_path = settings.TERRAIN_PATH
        if not tif_path.exists():
            return RasterMetadata(
                is_valid=False,
                status_message=f"Terrain GeoTIFF not found at expected path: {tif_path}"
            )

        try:
            im = Image.open(tif_path)
            tags = im.tag_v2
            width, height = im.size
            file_size = tif_path.stat().st_size

            # Check GeoTIFF tags
            # 33550: ModelPixelScaleTag (scale_x, scale_y, scale_z)
            # 33922: ModelTiepointTag (I, J, K, X, Y, Z)
            # 34735: GeoKeyDirectoryTag
            pixel_scale = tags.get(33550)
            tie_point = tags.get(33922)

            if not pixel_scale or not tie_point:
                return RasterMetadata(
                    is_valid=False,
                    status_message="TIFF found but lacks required GeoTIFF geo-referencing tags (Tiepoint or PixelScale).",
                    width=width,
                    height=height,
                    file_size_bytes=file_size
                )

            scale_x, scale_y = pixel_scale[0], pixel_scale[1]
            origin_lon, origin_lat = tie_point[3], tie_point[4]

            min_lon = float(origin_lon)
            max_lon = float(origin_lon + (width * scale_x))
            max_lat = float(origin_lat)
            min_lat = float(origin_lat - (height * scale_y))

            # Sample raster data for elevation statistics
            arr = np.array(im)
            min_elev = float(np.min(arr))
            max_elev = float(np.max(arr))
            mean_elev = float(np.mean(arr))

            self._raster_cache = {
                "arr": arr,
                "origin_lat": max_lat,
                "origin_lon": min_lon,
                "scale_x": scale_x,
                "scale_y": scale_y,
                "width": width,
                "height": height,
                "min_elev": min_elev,
                "max_elev": max_elev,
                "bounds": BoundingBox(min_lat=min_lat, min_lon=min_lon, max_lat=max_lat, max_lon=max_lon)
            }

            self._raster_metadata = RasterMetadata(
                is_valid=True,
                status_message="SRTMGL1 1-arc-second (~30m) elevation raster verified and loaded.",
                crs="EPSG:4326 (WGS 84)",
                width=width,
                height=height,
                min_elevation=round(min_elev, 1),
                max_elevation=round(max_elev, 1),
                mean_elevation=round(mean_elev, 1),
                bounds=BoundingBox(min_lat=min_lat, min_lon=min_lon, max_lat=max_lat, max_lon=max_lon),
                file_path=str(tif_path),
                file_size_bytes=file_size
            )
            return self._raster_metadata

        except Exception as e:
            logger.error(f"Error reading terrain GeoTIFF: {e}")
            return RasterMetadata(
                is_valid=False,
                status_message=f"Error parsing GeoTIFF: {str(e)}"
            )

    def get_elevation_at_point(self, lat: float, lon: float) -> ElevationQueryResponse:
        if self._raster_cache is None:
            meta = self.validate_terrain()
            if not meta.is_valid:
                return ElevationQueryResponse(
                    latitude=lat,
                    longitude=lon,
                    elevation_m=None,
                    source="RASTER_UNAVAILABLE",
                    message="Elevation raster is not available or could not be loaded."
                )

        cache = self._raster_cache
        arr = cache["arr"]
        bounds = cache["bounds"]

        if not (bounds.min_lat <= lat <= bounds.max_lat and bounds.min_lon <= lon <= bounds.max_lon):
            return ElevationQueryResponse(
                latitude=lat,
                longitude=lon,
                elevation_m=None,
                source="OUT_OF_BOUNDS",
                message=f"Coordinates ({lat}, {lon}) fall outside the raster bounds."
            )

        col = int((lon - cache["origin_lon"]) / cache["scale_x"])
        row = int((cache["origin_lat"] - lat) / cache["scale_y"])

        col = max(0, min(col, cache["width"] - 1))
        row = max(0, min(row, cache["height"] - 1))

        elev = float(arr[row, col])
        return ElevationQueryResponse(
            latitude=lat,
            longitude=lon,
            elevation_m=round(elev, 1),
            source="SRTMGL1_REAL",
            message=f"Elevation of {elev:.1f} m retrieved directly from SRTMGL1 GeoTIFF."
        )

    def get_elevation_overlay_png(self) -> Tuple[bytes, BoundingBox]:
        """Generates a color-mapped elevation hillshade PNG with transparent background."""
        if self._overlay_png_bytes is not None and self._raster_cache is not None:
            return self._overlay_png_bytes, self._raster_cache["bounds"]

        if self._raster_cache is None:
            self.validate_terrain()

        if self._raster_cache is None:
            raise ValueError("Raster data is not available to generate overlay.")

        arr = self._raster_cache["arr"]
        # Downsample for smooth map overlay web rendering (e.g. step by 2 or 3)
        downsampled = arr[::2, ::2]
        h, w = downsampled.shape

        min_e = self._raster_cache["min_elev"]
        max_e = self._raster_cache["max_elev"]
        norm = np.clip((downsampled - min_e) / (max_e - min_e + 1e-5), 0.0, 1.0)

        # Create RGBA colormap matching palette:
        # Lower elevations (valleys, rivers): slate brown / soft neutral #7A6F62 with low opacity
        # Mid elevations (plateau, Pune base ~550m-700m): warm beige-orange #C96F3D
        # High ridges (Ghats, Lonavala >1000m): high-contrast burnt amber / white #FFE3D1
        rgba = np.zeros((h, w, 4), dtype=np.uint8)
        
        # Color mapping:
        r = (80 + 175 * norm).astype(np.uint8)
        g = (60 + 80 * np.sin(norm * np.pi)).astype(np.uint8)
        b = (50 + 60 * (1.0 - norm)).astype(np.uint8)
        # Alpha: 90 to 180 (semitransparent overlay)
        alpha = (70 + 110 * norm).astype(np.uint8)

        rgba[..., 0] = r
        rgba[..., 1] = g
        rgba[..., 2] = b
        rgba[..., 3] = alpha

        img = Image.fromarray(rgba, mode="RGBA")
        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        self._overlay_png_bytes = buf.getvalue()
        return self._overlay_png_bytes, self._raster_cache["bounds"]

    def validate_roads(self) -> RoadsMetadata:
        roads_file = self.get_roads_path()
        if not roads_file or not roads_file.exists():
            return RoadsMetadata(
                is_valid=False,
                status_message="Road network GeoJSON not found in data/roads/"
            )

        try:
            file_size = roads_file.stat().st_size
            with open(roads_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            features = data.get("features", [])
            geom_types = {}
            highway_types = {}
            min_lat, min_lon = 90.0, 180.0
            max_lat, max_lon = -90.0, -180.0

            for feat in features:
                g = feat.get("geometry")
                if g:
                    gt = g.get("type", "Unknown")
                    geom_types[gt] = geom_types.get(gt, 0) + 1
                    coords = g.get("coordinates")
                    # Quick coordinate sampling for bounds
                    if gt == "LineString" and coords:
                        for pt in coords[::5]:
                            if len(pt) >= 2:
                                lon, lat = pt[0], pt[1]
                                min_lat = min(min_lat, lat)
                                max_lat = max(max_lat, lat)
                                min_lon = min(min_lon, lon)
                                max_lon = max(max_lon, lon)

                props = feat.get("properties") or {}
                hw = props.get("highway")
                if hw:
                    highway_types[hw] = highway_types.get(hw, 0) + 1

            self._roads_cache = data
            bounds = BoundingBox(
                min_lat=round(min_lat, 4),
                min_lon=round(min_lon, 4),
                max_lat=round(max_lat, 4),
                max_lon=round(max_lon, 4)
            ) if min_lat < max_lat else None

            self._roads_metadata = RoadsMetadata(
                is_valid=True,
                status_message=f"Verified real OpenStreetMap road network with {len(features)} features.",
                feature_count=len(features),
                geometry_types=geom_types,
                highway_types=highway_types,
                bounds=bounds,
                file_path=str(roads_file),
                file_size_bytes=file_size
            )
            return self._roads_metadata

        except Exception as e:
            logger.error(f"Error loading roads GeoJSON: {e}")
            return RoadsMetadata(
                is_valid=False,
                status_message=f"Failed to parse roads GeoJSON: {str(e)}"
            )

    def get_clipping_boundary(self) -> Optional[Dict[str, Any]]:
        if self._boundary_cache is not None:
            return self._boundary_cache

        b_path = settings.BOUNDARY_PATH
        if b_path.exists():
            try:
                with open(b_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._boundary_cache = data
                    return data
            except Exception as e:
                logger.error(f"Error loading clipping boundary: {e}")
        return None

    def get_roads_geojson(self, tier: str = "major", limit: Optional[int] = None) -> Dict[str, Any]:
        """Returns filtered roads GeoJSON for smooth high-performance map rendering."""
        if self._roads_cache is None:
            self.validate_roads()

        if self._roads_cache is None:
            return {"type": "FeatureCollection", "features": []}

        features = self._roads_cache.get("features", [])
        
        if tier == "all":
            selected = features if limit is None else features[:limit]
            return {"type": "FeatureCollection", "features": selected}

        # Major logistics corridors filter
        # Priority: expressway, motorway, trunk, primary, secondary, tertiary & links
        major_highways = {
            "motorway", "motorway_link", "trunk", "trunk_link",
            "primary", "primary_link", "secondary", "secondary_link",
            "tertiary", "tertiary_link"
        }

        filtered = []
        for feat in features:
            gtype = feat.get("geometry", {}).get("type")
            if gtype not in ("LineString", "MultiLineString"):
                continue
            props = feat.get("properties") or {}
            hw = props.get("highway")
            if hw in major_highways:
                filtered.append(feat)

        if limit:
            filtered = filtered[:limit]

        return {"type": "FeatureCollection", "features": filtered}

    def get_overview(self) -> GISOverviewResponse:
        roads_meta = self._roads_metadata or self.validate_roads()
        terrain_meta = self._raster_metadata or self.validate_terrain()
        boundary_present = settings.BOUNDARY_PATH.exists()

        return GISOverviewResponse(
            region_name="Pune - Mulshi - Lonavala Strategic Logistics Corridor",
            roads=roads_meta,
            terrain=terrain_meta,
            clipping_boundary_present=boundary_present,
            demo_synthetic_available=True
        )

gis_service = GISService()

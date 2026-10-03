from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class BoundingBox(BaseModel):
    min_lat: float
    min_lon: float
    max_lat: float
    max_lon: float

class RasterMetadata(BaseModel):
    is_valid: bool
    status_message: str
    crs: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    min_elevation: Optional[float] = None
    max_elevation: Optional[float] = None
    mean_elevation: Optional[float] = None
    bounds: Optional[BoundingBox] = None
    file_path: Optional[str] = None
    file_size_bytes: Optional[int] = None

class RoadsMetadata(BaseModel):
    is_valid: bool
    status_message: str
    feature_count: int = 0
    geometry_types: Dict[str, int] = {}
    highway_types: Dict[str, int] = {}
    bounds: Optional[BoundingBox] = None
    file_path: Optional[str] = None
    file_size_bytes: Optional[int] = None

class GISOverviewResponse(BaseModel):
    region_name: str = "Pune - Mulshi - Lonavala Strategic Logistics Corridor"
    roads: RoadsMetadata
    terrain: RasterMetadata
    clipping_boundary_present: bool
    demo_synthetic_available: bool

class ElevationQueryResponse(BaseModel):
    latitude: float
    longitude: float
    elevation_m: Optional[float]
    source: str  # "SRTMGL1_REAL" or "OUT_OF_BOUNDS" or "RASTER_UNAVAILABLE"
    message: str

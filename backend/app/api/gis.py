from typing import Optional
from fastapi import APIRouter, Query, Response, HTTPException
from app.services.gis_service import gis_service
from app.schemas.gis import GISOverviewResponse, ElevationQueryResponse

router = APIRouter(prefix="/gis", tags=["GIS & Terrain"])

@router.get("/overview", response_model=GISOverviewResponse)
def get_gis_overview():
    return gis_service.get_overview()

@router.get("/roads")
def get_roads_geojson(tier: str = Query("major", description="major or all"), limit: Optional[int] = Query(None)):
    data = gis_service.get_roads_geojson(tier=tier, limit=limit)
    return data

@router.get("/boundary")
def get_clipping_boundary():
    boundary = gis_service.get_clipping_boundary()
    if not boundary:
        raise HTTPException(status_code=404, detail="Clipping boundary GeoJSON not found.")
    return boundary

@router.get("/elevation", response_model=ElevationQueryResponse)
def query_elevation(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180)):
    return gis_service.get_elevation_at_point(lat=lat, lon=lon)

@router.get("/elevation/overlay.png")
def get_elevation_overlay():
    try:
        png_bytes, bounds = gis_service.get_elevation_overlay_png()
        headers = {
            "X-Raster-Min-Lat": str(bounds.min_lat),
            "X-Raster-Min-Lon": str(bounds.min_lon),
            "X-Raster-Max-Lat": str(bounds.max_lat),
            "X-Raster-Max-Lon": str(bounds.max_lon),
            "Cache-Control": "public, max-age=3600"
        }
        return Response(content=png_bytes, media_type="image/png", headers=headers)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate elevation overlay: {str(e)}")

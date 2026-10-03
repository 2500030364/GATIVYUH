from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import get_db
from app.services.gis_service import gis_service

router = APIRouter(prefix="/health", tags=["Health"])

@router.get("")
def health_check(db: Session = Depends(get_db)):
    db_healthy = True
    db_error = None
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_healthy = False
        db_error = str(e)

    roads_meta = gis_service.validate_roads()
    terrain_meta = gis_service.validate_terrain()

    return {
        "status": "HEALTHY" if db_healthy else "DEGRADED",
        "timestamp": datetime.utcnow(),
        "database": {
            "connected": db_healthy,
            "error": db_error
        },
        "gis": {
            "roads_valid": roads_meta.is_valid,
            "roads_message": roads_meta.status_message,
            "terrain_valid": terrain_meta.is_valid,
            "terrain_message": terrain_meta.status_message
        }
    }

import os
from pathlib import Path
# pyrefly: ignore [missing-import]
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent.parent
PROJECT_ROOT = BASE_DIR.parent
DEFAULT_DATA_DIR = PROJECT_ROOT / "data"

class Settings(BaseModel):
    PROJECT_NAME: str = "GATIVYUH"
    TAGLINE: str = "Predict the flow. Anticipate the need. Plan ahead."
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'gativyuh.db'}")
    
    # Data Paths
    DATA_DIR: Path = Path(os.getenv("DATA_DIR", str(DEFAULT_DATA_DIR)))
    TERRAIN_PATH: Path = DATA_DIR / "terrain" / "output_SRTMGL1.tif"
    ROADS_PATH: Path = DATA_DIR / "roads" / "GATIVYUH_Pune_Roads.geojson"
    ALT_ROADS_PATH: Path = DATA_DIR / "roads" / "road_network.geojson"
    BOUNDARY_PATH: Path = DATA_DIR / "roads" / "clipping_boundary.geojson"
    
    # CORS
    CORS_ORIGINS: list[str] = ["*"]
    
    # Demo Seed
    DEFAULT_SEED: int = 42

settings = Settings()

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.models.location import Location
from app.services.synthetic_service import synthetic_service
from app.services.gis_service import gis_service

from app.api.health import router as health_router
from app.api.dashboard import router as dashboard_router
from app.api.locations import router as locations_router
from app.api.inventory import router as inventory_router
from app.api.events import router as events_router
from app.api.alerts import router as alerts_router
from app.api.gis import router as gis_router
from app.api.data_manager import router as data_manager_router
from app.api.synthetic import router as synthetic_router
from app.api.predictive import router as predictive_router
from app.api.optimization import router as optimization_router
from app.services.transport_resource_service import transport_resource_service
from app.services.road_network_service import road_network_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("gativyuh")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables
    logger.info("Initializing database schema...")
    Base.metadata.create_all(bind=engine)

    # Inspect GIS data files
    logger.info("Verifying GIS data assets...")
    r_meta = gis_service.validate_roads()
    logger.info(f"Roads: {r_meta.status_message}")
    t_meta = gis_service.validate_terrain()
    logger.info(f"Terrain: {t_meta.status_message}")

    # Check if DB has any locations; if empty, seed synthetic demonstration data
    db = SessionLocal()
    try:
        count = db.query(Location).count()
        if count == 0:
            logger.info("Database is empty. Seeding initial reproducible demonstration dataset (Seed 42)...")
            synthetic_service.generate_demo_dataset(db, seed=settings.DEFAULT_SEED, reset_existing=False)
            logger.info("Demonstration dataset seeded successfully.")
        else:
            # Ensure fleet and corridor route segments are seeded
            transport_resource_service.seed_initial_fleet(db)
            road_network_service.seed_initial_corridors(db)
    except Exception as e:
        logger.error(f"Error checking or seeding database: {e}")
    finally:
        db.close()

    yield

    logger.info("Shutting down GATIVYUH backend service.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    summary=settings.TAGLINE,
    description=(
        "**GATIVYUH — Predictive Logistics & Forward Supply Chain Intelligence Platform**.\n\n"
        "Stage 1 Foundation: Enterprise GIS Mapping, Inventory Ledger, Transactional Event Management, "
        "NASA SRTMGL1 Elevation Querying, OpenStreetMap Road Networks, and Demonstration Pipelines.\n"
        "Stage 2: Machine Learning Demand Forecasting, Rolling Anomaly Detection, and Explainable Risk Engine.\n"
        "Stage 3: Multi-Constraint Logistics Optimization (SciPy HiGHS), Route Analysis with Elevation Profiles, "
        "Logistics Digital Twin, What-If Scenario Simulation Sandbox, and Human-in-the-Loop Review & Approval Workflow."
    ),
    version=settings.VERSION,
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(health_router, prefix=settings.API_PREFIX)
app.include_router(dashboard_router, prefix=settings.API_PREFIX)
app.include_router(locations_router, prefix=settings.API_PREFIX)
app.include_router(inventory_router, prefix=settings.API_PREFIX)
app.include_router(events_router, prefix=settings.API_PREFIX)
app.include_router(alerts_router, prefix=settings.API_PREFIX)
app.include_router(gis_router, prefix=settings.API_PREFIX)
app.include_router(data_manager_router, prefix=settings.API_PREFIX)
app.include_router(synthetic_router, prefix=settings.API_PREFIX)
app.include_router(predictive_router, prefix=settings.API_PREFIX)
app.include_router(optimization_router, prefix=settings.API_PREFIX)

@app.get("/")
def root():
    return {
        "platform": settings.PROJECT_NAME,
        "tagline": settings.TAGLINE,
        "version": settings.VERSION,
        "docs_url": "/docs",
        "api_prefix": settings.API_PREFIX
    }

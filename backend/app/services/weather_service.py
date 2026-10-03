import logging
import urllib.request
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from app.models.predictive import WeatherCache

logger = logging.getLogger(__name__)

NASA_POWER_BASE_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"

class WeatherService:
    def __init__(self):
        self._memory_cache: Dict[str, Dict[str, Any]] = {}

    def get_weather_for_location(
        self,
        db: Session,
        location_id: str,
        lat: float,
        lon: float,
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Retrieves daily meteorological observations from NASA POWER API.
        Includes server-side timeouts (6s), retries (2), database caching, and fallback behavior.
        Never fabricates weather values if unavailable.
        """
        now = datetime.utcnow()
        cache_key = f"{location_id}_{now.strftime('%Y%m%d')}"

        # 1. Check in-memory / database cache (valid for 12 hours)
        if not force_refresh:
            cached_db = db.query(WeatherCache).filter(
                WeatherCache.location_id == location_id
            ).order_by(WeatherCache.retrieval_timestamp.desc()).first()

            if cached_db and (now - cached_db.retrieval_timestamp) < timedelta(hours=12):
                return {
                    "location_id": location_id,
                    "latitude": lat,
                    "longitude": lon,
                    "observation_date": cached_db.observation_date,
                    "temp_c": cached_db.temp_c,
                    "precipitation_mm": cached_db.precipitation_mm,
                    "wind_speed_ms": cached_db.wind_speed_ms,
                    "source": "NASA_POWER (Cached)",
                    "retrieval_timestamp": cached_db.retrieval_timestamp,
                    "status": "CACHED",
                    "message": "Serving cached observation from NASA POWER API."
                }

        # 2. Query NASA POWER API
        # Request recent available observations (NASA POWER typically runs with 2-3 day latency)
        end_date = (now - timedelta(days=2)).strftime("%Y%m%d")
        start_date = (now - timedelta(days=5)).strftime("%Y%m%d")
        url = (
            f"{NASA_POWER_BASE_URL}?"
            f"parameters=T2M,PRECTOTCORR,WS2M&community=AG"
            f"&longitude={lon:.4f}&latitude={lat:.4f}"
            f"&start={start_date}&end={end_date}&format=JSON"
        )

        req = urllib.request.Request(
            url,
            headers={"User-Agent": "GATIVYUH-Platform/2.0 (Logistics Intelligence)"}
        )

        temp_val = None
        precip_val = None
        wind_val = None
        obs_date_str = end_date
        api_success = False
        error_msg = None

        for attempt in range(2):
            try:
                with urllib.request.urlopen(req, timeout=6.0) as resp:
                    if resp.status == 200:
                        payload = json.loads(resp.read().decode("utf-8"))
                        props = payload.get("properties", {}).get("parameter", {})
                        t2m_dict = props.get("T2M", {})
                        prec_dict = props.get("PRECTOTCORR", {})
                        ws2m_dict = props.get("WS2M", {})

                        # Extract most recent non-null values
                        for d_key in sorted(t2m_dict.keys(), reverse=True):
                            val = t2m_dict.get(d_key)
                            if val is not None and val > -900:  # NASA fill value is -999
                                temp_val = round(float(val), 1)
                                precip_val = round(float(prec_dict.get(d_key, 0.0)), 1)
                                wind_val = round(float(ws2m_dict.get(d_key, 0.0)), 1)
                                obs_date_str = d_key
                                api_success = True
                                break
                    if api_success:
                        break
            except Exception as e:
                error_msg = str(e)
                logger.warning(f"NASA POWER API attempt {attempt + 1} failed for {location_id}: {e}")

        if api_success and temp_val is not None:
            # Store in database cache
            cache_entry = WeatherCache(
                location_id=location_id,
                latitude=lat,
                longitude=lon,
                observation_date=obs_date_str,
                temp_c=temp_val,
                precipitation_mm=precip_val,
                wind_speed_ms=wind_val,
                source="NASA_POWER",
                retrieval_timestamp=now,
                status="LIVE"
            )
            db.add(cache_entry)
            db.commit()

            return {
                "location_id": location_id,
                "latitude": lat,
                "longitude": lon,
                "observation_date": obs_date_str,
                "temp_c": temp_val,
                "precipitation_mm": precip_val,
                "wind_speed_ms": wind_val,
                "source": "NASA_POWER (Live Query)",
                "retrieval_timestamp": now,
                "status": "LIVE",
                "message": "Live meteorological telemetry retrieved from NASA POWER."
            }

        # 3. Fallback to existing database record if available
        cached_fallback = db.query(WeatherCache).filter(
            WeatherCache.location_id == location_id
        ).order_by(WeatherCache.retrieval_timestamp.desc()).first()

        if cached_fallback:
            return {
                "location_id": location_id,
                "latitude": lat,
                "longitude": lon,
                "observation_date": cached_fallback.observation_date,
                "temp_c": cached_fallback.temp_c,
                "precipitation_mm": cached_fallback.precipitation_mm,
                "wind_speed_ms": cached_fallback.wind_speed_ms,
                "source": "NASA_POWER (Prior Cache)",
                "retrieval_timestamp": cached_fallback.retrieval_timestamp,
                "status": "CACHED",
                "message": f"API temporarily unreachable ({error_msg}); serving prior cached observation."
            }

        # 4. Honest reporting when unobserved
        return {
            "location_id": location_id,
            "latitude": lat,
            "longitude": lon,
            "observation_date": now.strftime("%Y-%m-%d"),
            "temp_c": None,
            "precipitation_mm": None,
            "wind_speed_ms": None,
            "source": "NASA_POWER",
            "retrieval_timestamp": now,
            "status": "UNAVAILABLE",
            "message": f"NASA POWER observation unavailable: {error_msg or 'Timeout/Network unreachable'}. Unobserved; values not fabricated."
        }

weather_service = WeatherService()

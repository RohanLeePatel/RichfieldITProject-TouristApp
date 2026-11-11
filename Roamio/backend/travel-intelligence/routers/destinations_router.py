import logging
import time

from fastapi import APIRouter, Depends, HTTPException

import landmarks.landmarks as landmarks_module
from config.auth import verify_secretKey
from engine.enrich import EnrichmentError, enrich_city_raw, find_cover_image
from schemas.destinations import EnrichRequest, EnrichResponse, GeocodeRequest, GeocodeResponse

logger = logging.getLogger(__name__)

router = APIRouter()

# categories are fetched side by side so one city finishes well inside a
# serverless time limit; the shared Geoapify quota is protected by the route's
# rate limit instead (rate_limit.py)
ENRICH_WORKERS = 6


# Lets an administrator add a city by name instead of typing coordinates
@router.post("/destinations/geocode", response_model=GeocodeResponse, dependencies=[Depends(verify_secretKey)])
def geocode_destination(body: GeocodeRequest) -> GeocodeResponse:
    if not landmarks_module.GEOAPIFY_API_KEY:
        raise HTTPException(status_code=503, detail="Destination data is not configured.")
    found = landmarks_module.geocode_destination(f"{body.name}, {body.country}", 0)
    if not found:
        raise HTTPException(status_code=404, detail=f"Could not find {body.name}, {body.country} on the map.")
    return GeocodeResponse(lat=found[0], lon=found[1])


# Reached through the Core API's admin routes, never from the browser. Reads
# the provider numbers for one city; the Core API stores them. This service
# still never touches the database.
@router.post("/destinations/enrich", response_model=EnrichResponse, dependencies=[Depends(verify_secretKey)])
def enrich_destination(body: EnrichRequest) -> EnrichResponse:
    api_key = landmarks_module.GEOAPIFY_API_KEY
    if not api_key:
        raise HTTPException(status_code=503, detail="Destination data is not configured.")

    started = time.perf_counter()
    try:
        raw = enrich_city_raw(api_key, body.lat, body.lon, body.radius_m, workers=ENRICH_WORKERS)
    except EnrichmentError as error:
        logger.warning("Enrichment failed for %s: %s", body.name, error)
        raise HTTPException(status_code=502, detail=str(error))

    logger.info("Enriched %s in %.1f s", body.name, time.perf_counter() - started)
    return EnrichResponse(**raw, image_url=find_cover_image(body.name, body.country))

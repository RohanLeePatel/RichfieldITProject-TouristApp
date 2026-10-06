import logging
import time
import uuid
from dotenv import load_dotenv

# Load environment variables from .env
# This must happen before importing the routers.
load_dotenv()
from fastapi import Depends, FastAPI, Request
from config.auth import verify_secretKey
from routers.translation_router import router as translation_router
from routers.recommendations_router import router as recommendations_router
from routers.weather_router import router as weather_router
from routers.landmarks_router import router as landmarks_router
from routers.rates_router import router as rates_router

import engine.currency
import landmarks.landmarks
import ocr.ocr
import translation.live_translation
import weather.weather

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("roamio.access")

# No CORS middleware: only the Core API calls this service, and server-to-server
# requests are not subject to CORS. The browser reaches these features through
# the Core API's proxies instead.
#
# The hosted docs pages are off because they would have to fetch the schema from
# the browser, which cannot hold the service key. The schema itself is served
# below behind the key, for Postman or a local Swagger UI (NFR-23).
app = FastAPI(
    title="Roamio Expert & Integration Service",
    description="Recommendation engine, landmarks, translation, weather and exchange rates.",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


# One access line per request, with the id the Core API sent so a problem can be
# followed across both services (NFR-29). Path only - no query string, headers or
# body, so nothing a traveller typed is logged.
@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    started = time.perf_counter()
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    logger.info(
        "%s %s -> %s in %.0f ms [%s]",
        request.method,
        request.url.path,
        response.status_code,
        (time.perf_counter() - started) * 1000,
        request_id,
    )
    return response


app.include_router(translation_router)
app.include_router(recommendations_router)
app.include_router(weather_router)
app.include_router(landmarks_router)
app.include_router(rates_router)

# which module holds each provider's key, so /health reports the values the
# service is actually running with rather than re-reading the environment
PROVIDER_KEYS = {
    "weather": (weather.weather, "OPENWEATHER_API_KEY"),
    "ocr": (ocr.ocr, "OCR_SPACE_API_KEY"),
    "translation": (translation.live_translation, "DEEPL_API_KEY"),
    "landmarks": (landmarks.landmarks, "GEOAPIFY_API_KEY"),
    "exchange_rates": (engine.currency, "EXCHANGE_RATE_API_KEY"),
}


@app.get("/")
def health_check():
    """Public uptime check - no detail."""
    return {"status": "ok"}


@app.get("/health", dependencies=[Depends(verify_secretKey)])
def health_detail():
    """Which features this instance can actually serve, for the administrator
    health view (FR-25). Reports whether each key is set, never its value."""
    return {
        "status": "ok",
        "version": app.version,
        "providers": {
            name: bool(getattr(module, attribute))
            for name, (module, attribute) in PROVIDER_KEYS.items()
        },
    }


@app.get("/openapi.json", include_in_schema=False, dependencies=[Depends(verify_secretKey)])
def openapi_schema():
    return app.openapi()

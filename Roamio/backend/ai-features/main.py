import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from routers.translation_router import router as translation_router
from routers.recommendations_router import router as recommendations_router
from routers.weather_router import router as weather_router
from routers.landmarks_router import router as landmarks_router
from routers.rates_router import router as rates_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("roamio.access")

app = FastAPI(
    title="Roamio Expert & Integration Service",
    description="Recommendation engine, landmarks, translation, weather and exchange rates.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://roamiio.live",
        "https://www.roamiio.live",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.get("/")
def health_check():
    return {"status": "ok"}

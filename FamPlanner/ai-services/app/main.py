"""FastAPI entry point — internal-only, never reachable outside the Docker network.

Week 1 scope: health check only. Recommendation/itinerary routers land Week 6,
OCR/translation routers land Week 7, per the Team Implementation Guide.
"""
from fastapi import FastAPI

app = FastAPI(
    title="FamPlanner AI Service",
    description="Internal-only AI/OCR microservice. Called only by the Node backend's gateway.",
    docs_url="/docs",
    redoc_url="/redoc",
)


@app.get("/health")
def health():
    return {"success": True, "data": {"status": "ok", "service": "ai-services"}}

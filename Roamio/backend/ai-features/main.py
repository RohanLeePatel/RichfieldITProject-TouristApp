from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.translation_router import router as translation_router
from routers.recommendations_router import router as recommendations_router
from routers.weather_router import router as weather_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(translation_router)
app.include_router(recommendations_router)
app.include_router(weather_router)


@app.get("/")
def health_check():
    return {"status": "ok"}

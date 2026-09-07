from fastapi import FastAPI
from routers.translation_router import router as translation_router
from routers.recommendations_router import router as recommendations_router

app = FastAPI()

app.include_router(translation_router)
app.include_router(recommendations_router)


@app.get("/")
def health_check():
    return {"status": "ok"}

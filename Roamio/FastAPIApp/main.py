from fastapi import FastAPI
from routers.translation_router import router as translation_router

app = FastAPI()

app.include_router(translation_router)


@app.get("/")
def health_check():
    return {"status": "ok"}

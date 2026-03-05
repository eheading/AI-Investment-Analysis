from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from scheduler import start_scheduler, stop_scheduler
from routers.market import router as market_router
from routers.news import router as news_router
from routers.summary import router as summary_router
from routers.settings import router as settings_router
from routers.active_stocks import router as active_stocks_router
from routers.top_gainers import router as top_gainers_router
from routers.translate import router as translate_router
from routers.stories import router as stories_router
from routers.premarket import router as premarket_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="AI Investment Agent", version="0.1.0", lifespan=lifespan)

# CORS — allow all origins during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Include routers ---
app.include_router(market_router, prefix="/api")
app.include_router(news_router, prefix="/api")
app.include_router(summary_router, prefix="/api")
app.include_router(settings_router, prefix="/api")
app.include_router(active_stocks_router, prefix="/api")
app.include_router(top_gainers_router, prefix="/api")
app.include_router(translate_router, prefix="/api")
app.include_router(stories_router, prefix="/api")
app.include_router(premarket_router, prefix="/api")


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

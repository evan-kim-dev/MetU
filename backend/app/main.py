from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import ai, flights, hotels, trips

settings = get_settings()

app = FastAPI(
    title="BudgetTrip AI API",
    version="0.1.0",
    description="FastAPI backend for BudgetTrip AI (Supabase + OpenAI)",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list or ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai.router)
app.include_router(flights.router)
app.include_router(hotels.router)
app.include_router(trips.router)


@app.get("/health")
def health() -> dict[str, str]:
    """서비스 상태 및 주요 API 키 설정 여부."""
    return {
        "status": "ok",
        "env": settings.app_env,
        "openai": "configured" if settings.openai_api_key else "missing",
        "supabase": (
            "configured"
            if settings.supabase_url and settings.supabase_service_role_key
            else "missing"
        ),
        "google_flights": "fast-flights",
        "icn_airlines_api": (
            "configured" if settings.data_go_kr_service_key else "missing"
        ),
        "hotelbeds": (
            "configured"
            if settings.hotelbeds_api_key and settings.hotelbeds_api_secret
            else "missing"
        ),
    }

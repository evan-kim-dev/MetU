from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import ai, checklist, flights, hotels

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
app.include_router(checklist.router)
app.include_router(flights.router)
app.include_router(hotels.router)


@app.get("/health")
def health() -> dict[str, str]:
    """Liveness + whether critical integrations are configured (no secret values)."""
    openrouter_ready = bool(settings.openrouter_api_key or settings.openai_api_key)
    return {
        "status": "ok",
        "env": settings.app_env,
        "openrouter": "configured" if openrouter_ready else "missing",
        "supabase": (
            "configured"
            if settings.supabase_url and settings.supabase_service_role_key
            else "missing"
        ),
    }

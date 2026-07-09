from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.core.config import get_settings
from app.services.hotelbeds_service import HotelbedsError, search_hotels

router = APIRouter(prefix="/hotels", tags=["hotels"])
settings = get_settings()


@router.get("/search")
async def search_hotels_route(
    destination: str = Query(..., min_length=1, description="도시·지역명"),
    check_in: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    check_out: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    adults: int = Query(default=2, ge=1, le=9),
    rooms: int = Query(default=1, ge=1, le=4),
    children: int = Query(default=0, ge=0, le=8),
    sort_by: str = Query(default="best", pattern="^(best|price_high)$"),
    limit: int = Query(default=8, ge=1, le=20),
) -> dict[str, Any]:
    try:
        return await search_hotels(
            destination=destination,
            check_in=check_in,
            check_out=check_out,
            adults=adults,
            rooms=rooms,
            children=children,
            sort_by=sort_by,
            limit=limit,
            api_key=settings.hotelbeds_api_key,
            api_secret=settings.hotelbeds_api_secret,
            base_url=settings.hotelbeds_api_base,
        )
    except HotelbedsError as exc:
        raise HTTPException(status_code=400, detail=exc.detail) from exc

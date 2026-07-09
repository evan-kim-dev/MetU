from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.core.config import get_settings
from app.services.airport_codes import resolve_iata, suggest_nearby_airports
from app.services.fast_flights_service import FastFlightsError, search_google_flights
from app.services.naver_flights_service import NaverFlightsError, search_naver_flights
from app.services.icn_airlines_service import (
    IcnAirlinesError,
    fetch_icn_airline_info,
    list_local_airline_codes,
    resolve_airline_profile,
)
from app.services.kac_airport_code_service import (
    KacAirportCodeError,
    search_airport_codes,
)

router = APIRouter(prefix="/flights", tags=["flights"])
settings = get_settings()


def _handle_google_error(exc: FastFlightsError) -> HTTPException:
    return HTTPException(status_code=400, detail=exc.detail)


@router.get("/nearby")
async def get_nearby_airports(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
) -> dict[str, list[str]]:
    return {"airports": suggest_nearby_airports(lat=lat, lng=lng)}


@router.get("/airports")
async def search_airports(
    query: str = Query(..., min_length=1, description="도시명 또는 IATA 코드"),
) -> dict[str, Any]:
    code = resolve_iata(query)
    if not code:
        raise HTTPException(status_code=404, detail="airport-not-found")
    return {"code": code, "query": query.strip()}


def _handle_naver_error(exc: NaverFlightsError) -> HTTPException:
    return HTTPException(status_code=400, detail=exc.detail)


@router.get("/naver-search")
async def search_naver_flights_route(
    origin: str = Query(..., min_length=1, description="도시명 또는 IATA 코드"),
    destination: str = Query(..., min_length=1, description="도시명 또는 IATA 코드"),
    depart_date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    return_date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    adults: int = Query(default=1, ge=1, le=9),
    cabin_class: str = Query(
        default="economy",
        pattern="^(economy|premium_economy|business|first)$",
    ),
    sort_by: str = Query(
        default="best",
        pattern="^(best|price_high|fastest)$",
    ),
    limit: int = Query(default=8, ge=1, le=20),
) -> Any:
    try:
        return await search_naver_flights(
            origin=origin,
            destination=destination,
            depart_date=depart_date,
            return_date=return_date,
            adults=adults,
            seat=cabin_class,
            sort_by=sort_by,
            limit=limit,
        )
    except NaverFlightsError as exc:
        raise _handle_naver_error(exc) from exc


@router.get("/google-search")
async def search_google_flights_route(
    origin: str = Query(..., min_length=1, description="도시명 또는 IATA 코드"),
    destination: str = Query(..., min_length=1, description="도시명 또는 IATA 코드"),
    depart_date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
    return_date: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    adults: int = Query(default=1, ge=1, le=9),
    cabin_class: str = Query(
        default="economy",
        pattern="^(economy|premium_economy|business|first)$",
    ),
    sort_by: str = Query(
        default="best",
        pattern="^(best|price_high|fastest)$",
    ),
    limit: int = Query(default=8, ge=1, le=20),
) -> Any:
    try:
        return await search_google_flights(
            origin=origin,
            destination=destination,
            depart_date=depart_date,
            return_date=return_date,
            adults=adults,
            seat=cabin_class,
            sort_by=sort_by,
            limit=limit,
        )
    except FastFlightsError as exc:
        raise _handle_google_error(exc) from exc


@router.get("/airport-codes/search")
async def search_kac_airport_codes(
    query: str | None = Query(default=None, description="공항명·도시명·IATA 코드"),
    limit: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    if not settings.data_go_kr_service_key:
        return {
            "airports": [],
            "source": "unavailable",
            "error": "data-go-kr-key-missing",
        }

    try:
        return await search_airport_codes(
            service_key=settings.data_go_kr_service_key,
            query=query,
            limit=limit,
        )
    except KacAirportCodeError as exc:
        raise HTTPException(status_code=400, detail=exc.detail) from exc


@router.get("/icn-airlines/codes")
async def get_icn_airline_codes(
    query: str | None = Query(default=None, description="항공사명·IATA·ICAO 검색"),
    limit: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    return {"airlines": list_local_airline_codes(query=query, limit=limit)}


@router.get("/icn-airlines")
async def get_icn_airlines(
    airline_iata: str | None = Query(default=None, min_length=2, max_length=3),
    airline_icao: str | None = Query(default=None, min_length=3, max_length=3),
    carrier: str | None = Query(default=None, description="Google Flights 등 항공사명"),
) -> Any:
    if not airline_iata and not airline_icao and not carrier:
        if not settings.data_go_kr_service_key:
            return {
                "airlines": list_local_airline_codes(limit=100),
                "source": "local-codes",
            }
        try:
            airlines = await fetch_icn_airline_info(
                service_key=settings.data_go_kr_service_key
            )
            return {"airlines": airlines, "source": "icn-openapi"}
        except IcnAirlinesError as exc:
            raise HTTPException(status_code=400, detail=exc.detail) from exc

    profile = await resolve_airline_profile(
        service_key=settings.data_go_kr_service_key,
        carrier=carrier,
        airline_iata=airline_iata,
        airline_icao=airline_icao,
    )
    if not profile:
        raise HTTPException(status_code=404, detail="airline-not-found")
    return profile

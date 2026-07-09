from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.repositories.trips import TripRepository

router = APIRouter(prefix="/trips", tags=["trips"])
repo = TripRepository()


@router.get("")
def list_trips(user_id: str = Query(..., min_length=1)) -> list[dict[str, Any]]:
    try:
        return repo.list_by_user(user_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/{trip_id}")
def get_trip(trip_id: str) -> dict[str, Any]:
    try:
        trip = repo.get(trip_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if not trip:
        raise HTTPException(status_code=404, detail="trip-not-found")
    return trip

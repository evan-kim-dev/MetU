from __future__ import annotations

import asyncio
import re
from typing import Any

from fast_flights import FlightData, Passengers, get_flights

from app.services.airport_codes import build_google_flights_url, resolve_iata

INCOMPLETE_STOP_LABELS = {"", "-", "unknown"}
INCOMPLETE_DURATION_LABELS = {"", "-", "unknown"}
CARGO_CARRIER_KEYWORDS = (
    "fedex",
    "federal express",
    "fedex항공",
    "ups",
    "cargo",
    "freight",
    "cargolux",
    "polar air",
    "airbridge",
    "aerologic",
    "화물",
    "택배",
)

SEAT_MAP = {
    "economy": "economy",
    "premium_economy": "premium-economy",
    "business": "business",
    "first": "first",
}


class FastFlightsError(Exception):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


def _parse_price_value(price_text: str) -> float:
    digits = re.sub(r"[^\d.]", "", price_text.replace(",", ""))
    try:
        return float(digits) if digits else float("inf")
    except ValueError:
        return float("inf")


def _normalize_price_to_krw(value: float) -> int:
    """Foreign amounts (USD etc.) often come back under 10_000 — convert ≈ KRW."""
    if value == float("inf") or value <= 0:
        return 0
    rounded = int(round(value))
    if rounded < 10_000:
        return rounded * 1500
    return rounded


def _format_price_krw(price_text: str) -> str:
    raw = (price_text or "").strip()
    value = _parse_price_value(raw)
    krw = _normalize_price_to_krw(value)
    if krw <= 0:
        return raw or "-"
    return f"₩{krw:,}"


def _parse_duration_minutes(duration_text: str) -> int:
    if not duration_text:
        return 0
    hours = 0
    minutes = 0
    hour_match = re.search(r"(\d+)\s*h", duration_text, flags=re.IGNORECASE)
    min_match = re.search(r"(\d+)\s*m", duration_text, flags=re.IGNORECASE)
    if hour_match:
        hours = int(hour_match.group(1))
    if min_match:
        minutes = int(min_match.group(1))
    return hours * 60 + minutes


def _format_stops(stops: int | str | None) -> str:
    if stops is None:
        return "-"
    if isinstance(stops, str):
        return stops
    if stops <= 0:
        return "직항"
    return f"{stops}회 경유"


def _is_cargo_carrier(name: str) -> bool:
    lowered = (name or "").strip().lower()
    if not lowered:
        return False
    return any(keyword in lowered for keyword in CARGO_CARRIER_KEYWORDS)


def _is_complete_flight(item: Any) -> bool:
    price = (item.price or "").strip()
    carrier = (item.name or "").strip()
    outbound = (item.departure or "").strip()
    inbound = (item.arrival or "").strip()
    duration = (item.duration or "").strip().lower()
    stops = _format_stops(item.stops).strip().lower()

    if _is_cargo_carrier(carrier):
        return False
    if not price or price == "-":
        return False
    if not carrier or carrier.lower() in {"unknown", "항공사 정보 없음"}:
        return False
    if not outbound or not inbound:
        return False
    if duration in INCOMPLETE_DURATION_LABELS:
        return False
    if stops in INCOMPLETE_STOP_LABELS:
        return False
    return True


def _search_sync(
    *,
    origin: str,
    destination: str,
    depart_date: str,
    return_date: str | None,
    adults: int,
    seat: str,
    sort_by: str,
    limit: int,
) -> dict[str, Any]:
    origin_code = resolve_iata(origin)
    destination_code = resolve_iata(destination)
    if not origin_code or not destination_code:
        raise FastFlightsError("airport-not-found")
    if origin_code == destination_code:
        raise FastFlightsError("same-origin-destination")

    flight_data = [
        FlightData(
            date=depart_date,
            from_airport=origin_code,
            to_airport=destination_code,
        )
    ]
    trip = "one-way"
    if return_date:
        flight_data.append(
            FlightData(
                date=return_date,
                from_airport=destination_code,
                to_airport=origin_code,
            )
        )
        trip = "round-trip"

    try:
        result = get_flights(
            flight_data=flight_data,
            trip=trip,
            seat=SEAT_MAP.get(seat, "economy"),
            passengers=Passengers(adults=adults),
            fetch_mode="common",
        )
    except Exception:
        try:
            result = get_flights(
                flight_data=flight_data,
                trip=trip,
                seat=SEAT_MAP.get(seat, "economy"),
                passengers=Passengers(adults=adults),
                fetch_mode="fallback",
            )
        except Exception:
            result = type("EmptyResult", (), {"flights": [], "current_price": None})()

    flights = [item for item in list(result.flights or []) if _is_complete_flight(item)]
    # 필터가 전부 걸러내면 원본에서 가격·항공사만 있는 항목이라도 살려 최저가 연동
    if not flights:
        raw = list(result.flights or [])
        flights = [
            item
            for item in raw
            if (item.price or "").strip() not in {"", "-"}
            and (item.name or "").strip()
            and not _is_cargo_carrier(item.name or "")
        ]
    if sort_by == "fastest":
        flights.sort(key=lambda item: _parse_duration_minutes(item.duration))
    elif sort_by == "price_high":
        flights.sort(
            key=lambda item: _normalize_price_to_krw(_parse_price_value(item.price)),
            reverse=True,
        )
    elif sort_by == "price":
        flights.sort(
            key=lambda item: _normalize_price_to_krw(_parse_price_value(item.price))
        )
    else:
        flights.sort(
            key=lambda item: (
                0 if getattr(item, "is_best", False) else 1,
                _normalize_price_to_krw(_parse_price_value(item.price)),
            )
        )

    booking_url = build_google_flights_url(
        origin=origin_code,
        destination=destination_code,
        depart_date=depart_date,
        return_date=return_date,
        adults=adults,
        seat=seat,
    )

    prices = [_normalize_price_to_krw(_parse_price_value(item.price)) for item in flights if item.price]
    finite_prices = [price for price in prices if price > 0]

    normalized = []
    for index, item in enumerate(flights[:limit]):
        normalized.append(
            {
                "id": f"gf-{index}",
                "price": _format_price_krw(item.price or "-"),
                "carrier": item.name or "항공사 정보 없음",
                "outbound": item.departure or "",
                "inbound": item.arrival or "",
                "route": f"{origin_code} → {destination_code}",
                "duration": item.duration or "-",
                "stops": _format_stops(item.stops),
                "bookingUrl": booking_url,
            }
        )

    return {
        "flights": normalized,
        "source": "google-flights",
        "meta": {
            "origin": origin_code,
            "destination": destination_code,
            "booking_search_url": booking_url,
            "price_band": getattr(result, "current_price", None),
            "stats": {
                "min_price": min(finite_prices) if finite_prices else None,
                "max_price": max(finite_prices) if finite_prices else None,
                "count": len(flights),
            },
        },
    }


async def search_google_flights(
    *,
    origin: str,
    destination: str,
    depart_date: str,
    return_date: str | None,
    adults: int = 1,
    seat: str = "economy",
    sort_by: str = "best",
    limit: int = 8,
) -> dict[str, Any]:
    try:
        return await asyncio.to_thread(
            _search_sync,
            origin=origin,
            destination=destination,
            depart_date=depart_date,
            return_date=return_date,
            adults=adults,
            seat=seat,
            sort_by=sort_by,
            limit=limit,
        )
    except FastFlightsError:
        raise
    except Exception:
        return {
            "flights": [],
            "source": "google-flights",
            "meta": {"error": "google-flights-failed"},
        }

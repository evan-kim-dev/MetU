from __future__ import annotations

import asyncio
import json
import time
from typing import Any

import httpx

from app.services.airport_codes import build_naver_flights_url, resolve_iata

NAVER_FLIGHT_API = (
    "https://flight-api.naver.com/flight/international/searchFlights"
)
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
)
MIN_SEARCH_INTERVAL_SECONDS = 3.0

_last_search_at = 0.0

SEAT_MAP = {
    "economy": "Y",
    "premium_economy": "W",
    "business": "C",
    "first": "F",
}


class NaverFlightsError(Exception):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


def _format_compact_date(date: str) -> str:
    return date.replace("-", "")


def _format_time(time_str: str) -> str:
    if len(time_str) == 4 and time_str.isdigit():
        return f"{time_str[:2]}:{time_str[2:]}"
    return time_str


def _format_datetime_label(date_str: str, time_str: str) -> str:
    compact = date_str.strip()
    if len(compact) == 8 and compact.isdigit():
        compact = f"{compact[:4]}-{compact[4:6]}-{compact[6:8]}"
    return f"{compact} {_format_time(time_str)}"


def _format_duration_label(seconds: int) -> str:
    minutes = max(seconds // 60, 0)
    if minutes < 60:
        return f"{minutes}분"
    hours, remain = divmod(minutes, 60)
    return f"{hours}시간 {remain}분" if remain else f"{hours}시간"


def _create_payload(
    *,
    origin: str,
    destination: str,
    depart_date: str,
    return_date: str,
    adults: int,
    seat: str,
    nonstop: bool = True,
) -> dict[str, Any]:
    return {
        "adultCount": max(adults, 1),
        "childCount": 0,
        "infantCount": 0,
        "device": "pc",
        "isNonstop": nonstop,
        "seatClass": SEAT_MAP.get(seat, "Y"),
        "tripType": "RT",
        "itineraries": [
            {
                "departureLocationCode": origin,
                "departureLocationType": "airport",
                "arrivalLocationCode": destination,
                "arrivalLocationType": "airport",
                "departureDate": _format_compact_date(depart_date),
            },
            {
                "departureLocationCode": destination,
                "departureLocationType": "airport",
                "arrivalLocationCode": origin,
                "arrivalLocationType": "airport",
                "departureDate": _format_compact_date(return_date),
            },
        ],
        "openReturnDays": 0,
        "flightFilter": {
            "filter": {
                "airlines": [],
                "departureAirports": [[origin], []],
                "arrivalAirports": [[], [origin]],
                "departureTime": [],
                "fareTypes": [],
                "flightDurationSeconds": [],
                "hasCardBenefit": True,
                "isIndividual": False,
                "isLowCarbonEmission": False,
                "isSameAirlines": False,
                "isSameDepArrAirport": True,
                "isTravelClub": False,
                "minFare": {},
                "viaCount": [],
                "selectedItineraries": [],
            },
            "limit": 200,
            "skip": 0,
            "sort": {"adultMinFare": 1},
        },
        "initialRequest": True,
    }


def _parse_sse_response(text: str) -> dict[str, Any] | None:
    last_valid: dict[str, Any] | None = None
    for line in text.splitlines():
        if not line.startswith("data: "):
            continue
        try:
            data = json.loads(line[6:])
        except json.JSONDecodeError:
            continue
        itineraries = data.get("itineraries") or []
        fare_mappings = data.get("fareMappings") or []
        if itineraries and fare_mappings:
            last_valid = data
    return last_valid


def _carrier_name(
    airline_code: str,
    airlines_map: dict[str, str],
) -> str:
    if airline_code in airlines_map:
        return airlines_map[airline_code]
    return airline_code


def _process_flight_data(
    api_response: dict[str, Any],
    *,
    origin: str,
    destination: str,
    booking_url: str,
    sort_by: str,
    limit: int,
) -> list[dict[str, Any]]:
    itineraries = api_response.get("itineraries") or []
    fare_mappings = api_response.get("fareMappings") or []
    status = api_response.get("status") or {}
    airlines_map = status.get("airlinesCodeMap") or {}

    if not itineraries or not fare_mappings:
        return []

    itinerary_by_id = {
        str(item.get("itineraryId")): item for item in itineraries if item.get("itineraryId")
    }

    fares: list[dict[str, Any]] = []
    for mapping in fare_mappings:
        itinerary_ids = str(mapping.get("itineraryIds", "")).split("-")
        for fare in mapping.get("fares") or []:
            adult = fare.get("adult") or {}
            total_fare = int(adult.get("totalFare") or 0)
            if total_fare <= 0 or len(itinerary_ids) < 2:
                continue
            fares.append(
                {
                    "itineraryIds": itinerary_ids,
                    "totalFare": total_fare,
                }
            )

    if not fares:
        return []

    fares.sort(key=lambda item: item["totalFare"], reverse=sort_by == "price_high")

    normalized: list[dict[str, Any]] = []
    seen_keys: set[str] = set()

    for fare in fares:
        outbound = itinerary_by_id.get(fare["itineraryIds"][0])
        inbound = itinerary_by_id.get(fare["itineraryIds"][1])
        if not outbound or not inbound:
            continue

        outbound_seg = (outbound.get("segments") or [None])[0]
        inbound_seg = (inbound.get("segments") or [None])[0]
        if not outbound_seg or not inbound_seg:
            continue

        outbound_carrier = outbound_seg.get("marketingCarrier") or {}
        inbound_carrier = inbound_seg.get("marketingCarrier") or {}
        outbound_code = str(outbound_carrier.get("airlineCode") or "")
        inbound_code = str(inbound_carrier.get("airlineCode") or "")
        outbound_flight = (
            f"{outbound_code}{outbound_carrier.get('flightNumber', '')}"
        )
        inbound_flight = f"{inbound_code}{inbound_carrier.get('flightNumber', '')}"

        dedupe_key = f"{outbound_flight}-{inbound_flight}-{fare['totalFare']}"
        if dedupe_key in seen_keys:
            continue
        seen_keys.add(dedupe_key)

        carrier_label = _carrier_name(outbound_code, airlines_map)
        if inbound_code and inbound_code != outbound_code:
            carrier_label = (
                f"{carrier_label} / {_carrier_name(inbound_code, airlines_map)}"
            )

        outbound_dep = outbound_seg.get("departure") or {}
        outbound_arr = outbound_seg.get("arrival") or {}
        inbound_dep = inbound_seg.get("departure") or {}
        inbound_arr = inbound_seg.get("arrival") or {}

        outbound_duration = int(outbound.get("duration") or 0)
        inbound_duration = int(inbound.get("duration") or 0)

        normalized.append(
            {
                "totalFare": fare["totalFare"],
                "totalDuration": outbound_duration + inbound_duration,
                "price": f"{fare['totalFare']:,}원",
                "carrier": carrier_label,
                "outbound": _format_datetime_label(
                    str(outbound_dep.get("date") or ""),
                    str(outbound_dep.get("time") or ""),
                ),
                "inbound": _format_datetime_label(
                    str(inbound_dep.get("date") or ""),
                    str(inbound_dep.get("time") or ""),
                ),
                "route": f"{origin} → {destination}",
                "duration": (
                    f"가는편 {_format_duration_label(outbound_duration)} · "
                    f"오는편 {_format_duration_label(inbound_duration)}"
                ),
                "stops": "직항",
                "outboundFlight": outbound_flight,
                "inboundFlight": inbound_flight,
                "bookingUrl": booking_url,
            }
        )

    if sort_by == "fastest":
        normalized.sort(key=lambda item: item["totalDuration"])
    elif sort_by == "price_high":
        normalized.sort(key=lambda item: item["totalFare"], reverse=True)

    results: list[dict[str, Any]] = []
    for index, item in enumerate(normalized[:limit]):
        payload = dict(item)
        payload.pop("totalFare", None)
        payload.pop("totalDuration", None)
        payload["id"] = f"nv-{index}"
        results.append(payload)
    return results


async def _request_naver_api(
    payload: dict[str, Any],
) -> tuple[dict[str, Any] | None, str | None]:
    headers = {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "User-Agent": USER_AGENT,
        "Referer": "https://flight.naver.com/",
        "Origin": "https://flight.naver.com",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    }

    last_error: str | None = None

    async with httpx.AsyncClient(timeout=15.0) as client:
        for attempt in range(1, 4):
            if attempt > 1:
                await asyncio.sleep(attempt * 2)

            try:
                response = await client.post(
                    NAVER_FLIGHT_API,
                    headers=headers,
                    json=payload,
                )
            except httpx.HTTPError:
                last_error = "naver-api-unavailable"
                continue

            if response.status_code == 429:
                last_error = "naver-api-rate-limited"
                await asyncio.sleep(attempt * 3)
                continue

            if response.status_code == 503:
                last_error = "naver-api-blocked"
                continue

            if response.status_code not in {200, 201}:
                last_error = f"naver-api-http-{response.status_code}"
                continue

            parsed = _parse_sse_response(response.text)
            if parsed and len(parsed.get("itineraries") or []) >= 3:
                return parsed, None

            await asyncio.sleep(2)
            retry = await client.post(
                NAVER_FLIGHT_API,
                headers=headers,
                json=payload,
            )
            if retry.status_code in {200, 201}:
                retry_parsed = _parse_sse_response(retry.text)
                if retry_parsed:
                    return retry_parsed, None

            if parsed:
                return parsed, None

            last_error = "naver-flights-empty"

    return None, last_error or "naver-api-unavailable"


async def search_naver_flights(
    *,
    origin: str,
    destination: str,
    depart_date: str,
    return_date: str | None,
    adults: int = 1,
    seat: str = "economy",
    sort_by: str = "best",
    limit: int = 8,
    nonstop: bool = True,
) -> dict[str, Any]:
    global _last_search_at

    if not return_date:
        raise NaverFlightsError("naver-requires-round-trip")

    origin_code = resolve_iata(origin)
    destination_code = resolve_iata(destination)
    if not origin_code or not destination_code:
        raise NaverFlightsError("airport-not-found")
    if origin_code == destination_code:
        raise NaverFlightsError("same-origin-destination")

    elapsed = time.time() - _last_search_at
    if elapsed < MIN_SEARCH_INTERVAL_SECONDS:
        await asyncio.sleep(MIN_SEARCH_INTERVAL_SECONDS - elapsed)
    _last_search_at = time.time()

    booking_url = build_naver_flights_url(
        origin=origin_code,
        destination=destination_code,
        depart_date=depart_date,
        return_date=return_date,
        adults=adults,
        seat=seat,
    )

    payload = _create_payload(
        origin=origin_code,
        destination=destination_code,
        depart_date=depart_date,
        return_date=return_date,
        adults=adults,
        seat=seat,
        nonstop=nonstop,
    )

    api_response, api_error = await _request_naver_api(payload)
    if not api_response:
        return {
            "flights": [],
            "source": "naver-flights",
            "meta": {
                "booking_search_url": booking_url,
                "error": api_error or "naver-flights-empty",
            },
        }

    flights = _process_flight_data(
        api_response,
        origin=origin_code,
        destination=destination_code,
        booking_url=booking_url,
        sort_by=sort_by,
        limit=limit,
    )

    if not flights:
        return {
            "flights": [],
            "source": "naver-flights",
            "meta": {
                "booking_search_url": booking_url,
                "error": "naver-flights-empty",
            },
        }

    return {
        "flights": flights,
        "source": "naver-flights",
        "meta": {
            "origin": origin_code,
            "destination": destination_code,
            "booking_search_url": booking_url,
            "lowest_fare": (api_response.get("status") or {}).get("lowestFare"),
            "count": len(flights),
        },
    }

from __future__ import annotations

import re
from typing import Literal
from urllib.parse import quote

CITY_TO_IATA: dict[str, str] = {
    "서울": "ICN",
    "인천": "ICN",
    "seoul": "ICN",
    "incheon": "ICN",
    "김포": "GMP",
    "gmp": "GMP",
    "부산": "PUS",
    "busan": "PUS",
    "제주": "CJU",
    "jeju": "CJU",
    "도쿄": "NRT",
    "tokyo": "NRT",
    "나리타": "NRT",
    "narita": "NRT",
    "하네다": "HND",
    "haneda": "HND",
    "오사카": "KIX",
    "osaka": "KIX",
    "후쿠오카": "FUK",
    "fukuoka": "FUK",
    "삿포로": "CTS",
    "sapporo": "CTS",
    "방콕": "BKK",
    "bangkok": "BKK",
    "다낭": "DAD",
    "da nang": "DAD",
    "danang": "DAD",
    "싱가포르": "SIN",
    "singapore": "SIN",
    "파리": "CDG",
    "paris": "CDG",
    "런던": "LHR",
    "london": "LHR",
    "뉴욕": "JFK",
    "new york": "JFK",
    "로스앤젤레스": "LAX",
    "los angeles": "LAX",
    "la": "LAX",
    "홍콩": "HKG",
    "hong kong": "HKG",
    "타이베이": "TPE",
    "taipei": "TPE",
    "상하이": "PVG",
    "shanghai": "PVG",
    "베이징": "PEK",
    "beijing": "PEK",
    "시드니": "SYD",
    "sydney": "SYD",
    "두바이": "DXB",
    "dubai": "DXB",
}


def resolve_iata(query: str) -> str | None:
    trimmed = query.strip()
    if not trimmed:
        return None

    paren_match = re.search(r"\(([A-Za-z]{3})\)\s*$", trimmed)
    if paren_match:
        return paren_match.group(1).upper()

    if len(trimmed) == 3 and trimmed.isalpha():
        return trimmed.upper()

    key = trimmed.lower()
    if key in CITY_TO_IATA:
        return CITY_TO_IATA[key]

    for label, code in CITY_TO_IATA.items():
        if label.lower() == key:
            return code

    return None


def suggest_nearby_airports(*, lat: float, lng: float) -> list[str]:
    """위치 기반 출발 공항 추천 (한국 위주, 외국은 기본값)."""
    if 33.0 <= lat <= 38.8 and 124.0 <= lng <= 132.0:
        if lat >= 37.0:
            return ["서울", "인천", "김포"]
        if lat >= 35.0:
            return ["부산", "대구"]
        return ["제주"]

    return ["서울", "인천"]


def build_google_flights_url(
    *,
    origin: str,
    destination: str,
    depart_date: str,
    return_date: str | None = None,
    adults: int = 1,
    seat: str = "economy",
) -> str:
    """Google Flights 검색 결과 페이지로 바로 이동하는 tfs 딥링크."""
    from fast_flights import FlightData, Passengers, create_filter

    seat_map: dict[str, Literal["economy", "premium-economy", "business", "first"]] = {
        "economy": "economy",
        "premium_economy": "premium-economy",
        "business": "business",
        "first": "first",
    }

    flight_data = [
        FlightData(date=depart_date, from_airport=origin, to_airport=destination)
    ]
    trip: Literal["round-trip", "one-way"] = "one-way"
    if return_date:
        flight_data.append(
            FlightData(
                date=return_date,
                from_airport=destination,
                to_airport=origin,
            )
        )
        trip = "round-trip"

    tfs = create_filter(
        flight_data=flight_data,
        trip=trip,
        passengers=Passengers(adults=max(adults, 1)),
        seat=seat_map.get(seat, "economy"),
    )
    tfs_param = quote(tfs.as_b64().decode("utf-8"), safe="")
    return (
        "https://www.google.com/travel/flights/search"
        f"?tfs={tfs_param}&hl=ko&gl=KR&curr=KRW&tfu=EgQIABABIgA"
    )


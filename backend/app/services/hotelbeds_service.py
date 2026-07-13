from __future__ import annotations

import hashlib
import time
from typing import Any
from urllib.parse import quote

import httpx

HOTELBEDS_TEST_BASE = "https://api.test.hotelbeds.com"

DESTINATION_CODES: dict[str, str] = {
    "도쿄": "TYO",
    "tokyo": "TYO",
    "시부야": "TYO",
    "shibuya": "TYO",
    "아사쿠사": "TYO",
    "나리타": "TYO",
    "오사카": "OSA",
    "osaka": "OSA",
    "교토": "KYO",
    "kyoto": "KYO",
    "후쿠오카": "FUK",
    "fukuoka": "FUK",
    "서울": "SEL",
    "seoul": "SEL",
    "부산": "PUS",
    "busan": "PUS",
    "제주": "CHJ",
    "jeju": "CHJ",
    "방콕": "BKK",
    "bangkok": "BKK",
    "싱가포르": "SIN",
    "singapore": "SIN",
    "파리": "PAR",
    "paris": "PAR",
    "런던": "LON",
    "london": "LON",
    "뉴욕": "NYC",
    "new york": "NYC",
    "다낭": "DAD",
    "da nang": "DAD",
    "홍콩": "HKG",
    "hong kong": "HKG",
    "타이베이": "TPE",
    "taipei": "TPE",
    "마드리드": "MAD",
    "madrid": "MAD",
    "바르셀로나": "BCN",
    "barcelona": "BCN",
    "발리": "DPS",
    "bali": "DPS",
    "세부": "CEB",
    "cebu": "CEB",
}


class HotelbedsError(Exception):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


def resolve_destination_code(query: str) -> str | None:
    trimmed = query.strip()
    if not trimmed:
        return None

    # "도쿄 · 일본", "Osaka, Japan" 등에서 도시만 추출
    primary = trimmed
    for sep in (",", "，", "·", "/", "("):
        if sep in trimmed:
            primary = trimmed.split(sep)[0].strip()
            break

    lowered = primary.lower()
    if lowered in DESTINATION_CODES:
        return DESTINATION_CODES[lowered]

    full_lower = trimmed.lower()
    for label, code in DESTINATION_CODES.items():
        if label in full_lower or label in lowered:
            return code

    if len(primary) == 3 and primary.isalpha():
        return primary.upper()

    return None


def build_google_hotels_url(
    *,
    destination: str,
    check_in: str,
    check_out: str,
    adults: int = 2,
    rooms: int = 1,
) -> str:
    query = quote(f"hotels in {destination.strip()}")
    return (
        "https://www.google.com/travel/hotels"
        f"?q={query}"
        f"&checkin={check_in}"
        f"&checkout={check_out}"
        f"&adults={max(adults, 1)}"
        f"&rooms={max(rooms, 1)}"
    )


def _build_auth_headers(api_key: str, api_secret: str) -> dict[str, str]:
    timestamp = str(int(time.time()))
    raw = f"{api_key}{api_secret}{timestamp}"
    signature = hashlib.sha256(raw.encode()).hexdigest()
    return {
        "Api-key": api_key,
        "X-Signature": signature,
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "Content-Type": "application/json",
    }


def _category_to_rating(category_code: str | None) -> float | None:
    if not category_code:
        return None
    digits = "".join(ch for ch in category_code if ch.isdigit())
    if not digits:
        return None
    try:
        return min(float(digits), 5.0)
    except ValueError:
        return None


def _format_price(amount: str | float | int | None, currency: str = "EUR") -> str:
    if amount is None:
        return "-"
    try:
        value = float(amount)
    except (TypeError, ValueError):
        return str(amount)

    # MetU UI는 KRW 기준 — Hotelbeds 테스트는 EUR을 많이 씀
    upper = currency.upper()
    if upper in {"EUR", "€"}:
        value = value * 1500.0
        upper = "KRW"
    elif upper in {"USD", "$"}:
        value = value * 1380.0
        upper = "KRW"

    if upper in {"KRW", "₩"}:
        return f"₩{int(round(value)):,}"
    return f"{upper} {value:,.0f}"


def _to_krw(amount: float, currency: str) -> int:
    upper = (currency or "EUR").upper()
    if upper in {"KRW", "₩"}:
        return int(round(amount))
    if upper in {"EUR", "€"}:
        return int(round(amount * 1500.0))
    if upper in {"USD", "$"}:
        return int(round(amount * 1380.0))
    return int(round(amount))


# Hotelbeds 테스트 샌드박스에 아시아 재고가 거의 없어, 도시별 1박 추정(KRW)
CITY_NIGHTLY_KRW: dict[str, tuple[int, int]] = {
    "TYO": (95_000, 210_000),
    "OSA": (75_000, 170_000),
    "KYO": (80_000, 180_000),
    "FUK": (65_000, 140_000),
    "SEL": (70_000, 160_000),
    "PUS": (55_000, 120_000),
    "CHJ": (60_000, 150_000),
    "BKK": (45_000, 110_000),
    "SIN": (120_000, 250_000),
    "DAD": (40_000, 95_000),
    "HKG": (110_000, 230_000),
    "TPE": (70_000, 150_000),
    "PAR": (140_000, 280_000),
    "LON": (150_000, 300_000),
    "NYC": (180_000, 350_000),
    "MAD": (90_000, 190_000),
    "BCN": (95_000, 200_000),
}


def _nights_between(check_in: str, check_out: str) -> int:
    from datetime import date

    start = date.fromisoformat(check_in)
    end = date.fromisoformat(check_out)
    return max(1, (end - start).days)


def _build_city_estimate_hotels(
    *,
    destination: str,
    destination_code: str,
    check_in: str,
    check_out: str,
    booking_url: str,
    limit: int,
) -> list[dict[str, Any]]:
    band = CITY_NIGHTLY_KRW.get(destination_code)
    if not band:
        return []
    low, high = band
    mid = (low + high) // 2
    nights = _nights_between(check_in, check_out)
    samples = [
        (f"{destination} 시내 스탠다드", mid, "도심"),
        (f"{destination} 비즈니스 호텔", int(mid * 1.15), "역세권"),
        (f"{destination} 가성비 호텔", int(mid * 0.85), "시내 외곽"),
    ]
    hotels: list[dict[str, Any]] = []
    for index, (name, nightly, area) in enumerate(samples[:limit]):
        total = nightly * nights
        hotels.append(
            {
                "id": f"est-{destination_code}-{index}",
                "name": name,
                "area": area,
                "rating": 3.5 + index * 0.3,
                "reviewCount": None,
                "price": f"₩{total:,}",
                "badge": f"도시 추정 · {nights}박",
                "bookingUrl": booking_url,
            }
        )
    return hotels


def _pick_badge(rate: dict[str, Any]) -> str:
    board = str(rate.get("boardName") or "").strip()
    policies = rate.get("cancellationPolicies") or []
    if policies:
        first = policies[0] if isinstance(policies, list) else {}
        amount = first.get("amount") if isinstance(first, dict) else None
        if amount in (0, "0", "0.00", None):
            return "무료 취소"
    if board:
        lowered = board.lower()
        if "breakfast" in lowered or "조식" in board:
            return "조식 포함"
        return board
    return "요금 확인"


def _build_availability_payload(
    *,
    hotel_codes: list[int],
    check_in: str,
    check_out: str,
    rooms: int,
    adults: int,
    children: int,
) -> dict[str, Any]:
    occupancy: dict[str, Any] = {
        "rooms": max(rooms, 1),
        "adults": max(adults, 1),
    }
    if children > 0:
        occupancy["children"] = children
    else:
        occupancy["children"] = 0

    return {
        "stay": {"checkIn": check_in, "checkOut": check_out},
        "occupancies": [occupancy],
        "hotels": {"hotel": hotel_codes},
    }


async def _request_hotelbeds(
    *,
    base_url: str,
    api_key: str,
    api_secret: str,
    method: str,
    path: str,
    params: dict[str, Any] | None = None,
    json_body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    headers = _build_auth_headers(api_key, api_secret)
    url = f"{base_url.rstrip('/')}{path}"

    async with httpx.AsyncClient(timeout=25.0) as client:
        response = await client.request(
            method,
            url,
            headers=headers,
            params=params,
            json=json_body,
        )

    if response.status_code == 401:
        raise HotelbedsError("hotelbeds-unauthorized")
    if response.status_code == 403:
        raise HotelbedsError("hotelbeds-forbidden")
    if response.status_code >= 400:
        raise HotelbedsError(f"hotelbeds-http-{response.status_code}")

    payload = response.json()
    if not isinstance(payload, dict):
        raise HotelbedsError("hotelbeds-invalid-response")
    return payload


async def fetch_hotel_codes(
    *,
    api_key: str,
    api_secret: str,
    base_url: str,
    destination_code: str,
    limit: int = 30,
) -> list[dict[str, Any]]:
    payload = await _request_hotelbeds(
        base_url=base_url,
        api_key=api_key,
        api_secret=api_secret,
        method="GET",
        path="/hotel-content-api/1.0/hotels",
        params={
            "destinationCode": destination_code,
            "fields": "code,name,categoryCode,zoneName,destinationCode",
            "language": "KOR",
            "from": 1,
            "to": limit,
        },
    )

    hotels = payload.get("hotels") or []
    if isinstance(hotels, dict):
        hotels = hotels.get("hotels") or hotels.get("hotel") or []
    if not isinstance(hotels, list):
        return []

    normalized: list[dict[str, Any]] = []
    for hotel in hotels:
        code = hotel.get("code")
        if code is None:
            continue
        normalized.append(
            {
                "code": int(code),
                "name": str(hotel.get("name") or "").strip(),
                "categoryCode": hotel.get("categoryCode"),
                "zoneName": str(hotel.get("zoneName") or "").strip(),
            }
        )
    return normalized


async def fetch_availability(
    *,
    api_key: str,
    api_secret: str,
    base_url: str,
    hotel_codes: list[int],
    check_in: str,
    check_out: str,
    rooms: int,
    adults: int,
    children: int,
) -> dict[str, Any]:
    body = _build_availability_payload(
        hotel_codes=hotel_codes,
        check_in=check_in,
        check_out=check_out,
        rooms=rooms,
        adults=adults,
        children=children,
    )
    return await _request_hotelbeds(
        base_url=base_url,
        api_key=api_key,
        api_secret=api_secret,
        method="POST",
        path="/hotel-api/1.0/hotels",
        json_body=body,
    )


def _normalize_availability(
    payload: dict[str, Any],
    *,
    content_by_code: dict[int, dict[str, Any]],
    booking_url: str,
    sort_by: str,
    limit: int,
) -> list[dict[str, Any]]:
    hotels_block = payload.get("hotels") or {}
    hotels = hotels_block.get("hotels") if isinstance(hotels_block, dict) else []
    if not isinstance(hotels, list):
        return []

    currency = str(hotels_block.get("currency") or "EUR")
    results: list[dict[str, Any]] = []

    for hotel in hotels:
        code = hotel.get("code")
        if code is None:
            continue
        code_int = int(code)
        content = content_by_code.get(code_int, {})
        name = str(hotel.get("name") or content.get("name") or f"Hotel {code_int}")
        zone = str(content.get("zoneName") or hotel.get("destinationName") or "").strip()
        rating = _category_to_rating(
            str(hotel.get("categoryCode") or content.get("categoryCode") or "")
        )

        best_rate: dict[str, Any] | None = None
        best_price = float("inf")
        best_room_name = ""
        best_badge = "요금 확인"

        for room in hotel.get("rooms") or []:
            room_name = str(room.get("name") or "").strip()
            for rate in room.get("rates") or []:
                price_raw = rate.get("sellingRate") or rate.get("net")
                try:
                    price_value = float(price_raw)
                except (TypeError, ValueError):
                    continue
                if price_value < best_price:
                    best_price = price_value
                    best_rate = rate
                    best_room_name = room_name
                    best_badge = _pick_badge(rate)

        if best_rate is None:
            continue

        results.append(
            {
                "id": f"hb-{code_int}",
                "code": code_int,
                "name": name,
                "area": zone or best_room_name or "-",
                "rating": rating,
                "reviewCount": None,
                "price": _format_price(best_price, currency),
                "priceValue": _to_krw(best_price, currency),
                "badge": best_badge,
                "currency": "KRW",
                "bookingUrl": booking_url,
            }
        )

    if sort_by == "price_high":
        results.sort(key=lambda item: item.get("priceValue", 0), reverse=True)
    else:
        results.sort(key=lambda item: item.get("priceValue", float("inf")))

    trimmed: list[dict[str, Any]] = []
    for item in results[:limit]:
        payload_item = dict(item)
        payload_item.pop("priceValue", None)
        trimmed.append(payload_item)
    return trimmed


async def fetch_availability_by_destination(
    *,
    api_key: str,
    api_secret: str,
    base_url: str,
    destination_code: str,
    check_in: str,
    check_out: str,
    rooms: int,
    adults: int,
    children: int,
) -> dict[str, Any]:
    occupancy: dict[str, Any] = {
        "rooms": max(rooms, 1),
        "adults": max(adults, 1),
        "children": max(children, 0),
    }
    body = {
        "stay": {"checkIn": check_in, "checkOut": check_out},
        "occupancies": [occupancy],
        "destination": {"code": destination_code},
    }
    return await _request_hotelbeds(
        base_url=base_url,
        api_key=api_key,
        api_secret=api_secret,
        method="POST",
        path="/hotel-api/1.0/hotels",
        json_body=body,
    )


async def search_hotels(
    *,
    destination: str,
    check_in: str,
    check_out: str,
    adults: int = 2,
    rooms: int = 1,
    children: int = 0,
    sort_by: str = "best",
    limit: int = 8,
    api_key: str = "",
    api_secret: str = "",
    base_url: str = HOTELBEDS_TEST_BASE,
) -> dict[str, Any]:
    destination_code = resolve_destination_code(destination)
    google_url = build_google_hotels_url(
        destination=destination,
        check_in=check_in,
        check_out=check_out,
        adults=adults,
        rooms=rooms,
    )

    if not api_key or not api_secret:
        estimates = _build_city_estimate_hotels(
            destination=destination,
            destination_code=destination_code or "",
            check_in=check_in,
            check_out=check_out,
            booking_url=google_url,
            limit=limit,
        )
        return {
            "hotels": estimates,
            "source": "city-estimate" if estimates else "google-hotels",
            "meta": {
                "booking_search_url": google_url,
                "error": "hotelbeds-key-missing",
                "destination_code": destination_code,
            },
        }

    if not destination_code:
        raise HotelbedsError("destination-not-found")

    hotels: list[dict[str, Any]] = []
    content_by_code: dict[int, dict[str, Any]] = {}

    # 1) 목적지 코드로 바로 가용성 조회 (콘텐츠 카탈로그 불필요)
    try:
        availability = await fetch_availability_by_destination(
            api_key=api_key,
            api_secret=api_secret,
            base_url=base_url,
            destination_code=destination_code,
            check_in=check_in,
            check_out=check_out,
            rooms=rooms,
            adults=adults,
            children=children,
        )
        hotels = _normalize_availability(
            availability,
            content_by_code={},
            booking_url=google_url,
            sort_by=sort_by,
            limit=limit,
        )
    except HotelbedsError:
        hotels = []

    # 2) 비면 호텔 코드 목록 → 가용성
    if not hotels:
        try:
            catalog = await fetch_hotel_codes(
                api_key=api_key,
                api_secret=api_secret,
                base_url=base_url,
                destination_code=destination_code,
                limit=30,
            )
            content_by_code = {item["code"]: item for item in catalog}
            hotel_codes = [item["code"] for item in catalog if item.get("code")]
            if hotel_codes:
                availability = await fetch_availability(
                    api_key=api_key,
                    api_secret=api_secret,
                    base_url=base_url,
                    hotel_codes=hotel_codes[:20],
                    check_in=check_in,
                    check_out=check_out,
                    rooms=rooms,
                    adults=adults,
                    children=children,
                )
                hotels = _normalize_availability(
                    availability,
                    content_by_code=content_by_code,
                    booking_url=google_url,
                    sort_by=sort_by,
                    limit=limit,
                )
        except HotelbedsError:
            hotels = []

    if hotels:
        return {
            "hotels": hotels,
            "source": "hotelbeds",
            "meta": {
                "booking_search_url": google_url,
                "destination_code": destination_code,
                "count": len(hotels),
            },
        }

    # 3) Hotelbeds 테스트에 아시아 재고가 없는 경우 — 도시 추정가
    estimates = _build_city_estimate_hotels(
        destination=destination,
        destination_code=destination_code,
        check_in=check_in,
        check_out=check_out,
        booking_url=google_url,
        limit=limit,
    )
    return {
        "hotels": estimates,
        "source": "city-estimate" if estimates else "google-hotels",
        "meta": {
            "booking_search_url": google_url,
            "error": "hotelbeds-no-rates",
            "destination_code": destination_code,
            "note": "Hotelbeds test sandbox has limited non-EU inventory",
        },
    }

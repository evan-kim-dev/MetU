from __future__ import annotations

import time
from typing import Any

import httpx

KAC_AIRPORT_CODE_API = "https://apis.data.go.kr/B551178/airport-code/info"
CACHE_TTL_SECONDS = 60 * 60 * 24

_cache: dict[str, Any] = {"expires_at": 0.0, "items": []}


class KacAirportCodeError(Exception):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


def _normalize_items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    body = payload.get("response", {}).get("body", {})
    items = body.get("items")
    if not items:
        return []

    if isinstance(items, list):
        raw_items = items
    elif isinstance(items, dict):
        raw = items.get("item")
        if raw is None:
            return []
        raw_items = raw if isinstance(raw, list) else [raw]
    else:
        return []

    normalized: list[dict[str, Any]] = []
    for item in raw_items:
        # B551178 실제 응답: cityCode, cityKorean, cityEnglish, cityJapan, cityChina
        code = str(
            item.get("cityCode")
            or item.get("airportCode")
            or item.get("airport_code")
            or ""
        ).strip().upper()
        name_ko = str(
            item.get("cityKorean")
            or item.get("airportKorean")
            or item.get("airportName")
            or ""
        ).strip()
        name_en = str(
            item.get("cityEnglish")
            or item.get("airportEnglish")
            or ""
        ).strip()
        name_ja = str(item.get("cityJapan") or "").strip()
        name_zh = str(item.get("cityChina") or "").strip()

        if not code and not name_ko:
            continue

        city = name_ko.split("/")[0].strip() if name_ko else name_en
        display = name_ko or name_en

        normalized.append(
            {
                "code": code,
                "name": display,
                "nameEn": name_en,
                "nameJa": name_ja,
                "nameZh": name_zh,
                "city": city,
                "country": "",
                "label": f"{display}({code})" if code else display,
            }
        )

    return normalized


async def fetch_airport_code_page(
    *,
    service_key: str,
    page_no: int = 1,
    num_of_rows: int = 100,
    airport_code: str | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if not service_key:
        raise KacAirportCodeError("data-go-kr-key-missing")

    params: dict[str, str | int] = {
        "serviceKey": service_key,
        "type": "json",
        "pageNo": page_no,
        "numOfRows": num_of_rows,
    }
    if airport_code:
        params["schAirportCode"] = airport_code.strip().upper()

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(KAC_AIRPORT_CODE_API, params=params)

    if response.status_code == 403:
        raise KacAirportCodeError("airport-code-api-forbidden")

    if response.status_code != 200:
        raise KacAirportCodeError(f"airport-code-api-http-{response.status_code}")

    payload = response.json()
    header = payload.get("response", {}).get("header", {})
    result_code = str(header.get("resultCode", ""))
    if result_code and result_code not in {"00", "0"}:
        raise KacAirportCodeError(header.get("resultMsg") or "airport-code-api-error")

    body = payload.get("response", {}).get("body", {})
    return _normalize_items(payload), {
        "totalCount": body.get("totalCount"),
        "pageNo": body.get("pageNo"),
        "numOfRows": body.get("numOfRows"),
    }


async def load_all_airport_codes(*, service_key: str) -> list[dict[str, Any]]:
    now = time.time()
    if _cache["items"] and _cache["expires_at"] > now:
        return _cache["items"]

    all_items: list[dict[str, Any]] = []
    page_no = 1

    while page_no <= 50:
        items, meta = await fetch_airport_code_page(
            service_key=service_key,
            page_no=page_no,
            num_of_rows=100,
        )
        if not items:
            break

        all_items.extend(items)
        total_count = int(meta.get("totalCount") or 0)
        if total_count and len(all_items) >= total_count:
            break
        if len(items) < 100:
            break
        page_no += 1

    deduped: dict[str, dict[str, Any]] = {}
    for item in all_items:
        key = item.get("code") or item.get("label")
        if key:
            deduped[str(key)] = item

    result = list(deduped.values())
    _cache["items"] = result
    _cache["expires_at"] = now + CACHE_TTL_SECONDS
    return result


def search_cached_airport_codes(
    items: list[dict[str, Any]],
    *,
    query: str | None = None,
    limit: int = 20,
) -> list[dict[str, Any]]:
    if not query:
        return items[:limit]

    q = query.strip().lower()
    if not q:
        return items[:limit]

    matched = []
    for item in items:
        hay = " ".join(
            [
                item.get("label", ""),
                item.get("name", ""),
                item.get("nameEn", ""),
                item.get("nameJa", ""),
                item.get("nameZh", ""),
                item.get("code", ""),
                item.get("city", ""),
                item.get("country", ""),
            ]
        ).lower()
        if q in hay:
            matched.append(item)

    return matched[:limit]


async def search_airport_codes(
    *,
    service_key: str,
    query: str | None = None,
    limit: int = 20,
) -> dict[str, Any]:
    try:
        items = await load_all_airport_codes(service_key=service_key)
        return {
            "airports": search_cached_airport_codes(items, query=query, limit=limit),
            "source": "kac-airport-code-api",
            "total": len(items),
        }
    except KacAirportCodeError as exc:
        if exc.detail == "airport-code-api-forbidden":
            return {
                "airports": [],
                "source": "unavailable",
                "error": "airport-code-api-forbidden",
            }
        raise

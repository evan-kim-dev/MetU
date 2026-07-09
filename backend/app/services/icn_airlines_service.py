from __future__ import annotations

from typing import Any

import httpx

from app.data.icn_airline_codes import (
    ICN_AIRLINE_CODES,
    find_airline_by_iata,
    find_airline_by_icao,
    resolve_carrier_to_iata,
)

CARGO_IATA_CODES = {"FX", "5X", "CV", "PO", "RU", "CK", "9S", "3S", "8Y"}
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

ICN_AIRLINES_API = (
    "http://apis.data.go.kr/B551177/StatusOfSrvAirlines/getServiceAirlineInfo"
)
ICN_AIRLINE_ICON_URL = (
    "https://odp.airport.kr/apiPortal/airlineIconDown?IATA_CODE={iata}"
)


def build_airline_icon_url(iata: str) -> str:
    return ICN_AIRLINE_ICON_URL.format(iata=iata.strip().upper())


class IcnAirlinesError(Exception):
    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


def _normalize_items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    body = payload.get("response", {}).get("body", {})
    items = body.get("items")
    if not items:
        return []

    if isinstance(items, list):
        return items

    if isinstance(items, dict):
        raw = items.get("item")
        if raw is None:
            return []
        if isinstance(raw, list):
            return raw
        return [raw]

    return []


def _normalize_airline(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "iata": item.get("airlineIata") or item.get("airline_iata") or "",
        "icao": item.get("airlineIcao") or item.get("airline_icao") or "",
        "name": item.get("airlineName") or "",
        "image": item.get("airlineImage") or "",
        "tel": item.get("airlineTel") or "",
        "icTel": item.get("airlineIcTel") or "",
    }


async def fetch_icn_airline_info(
    *,
    service_key: str,
    airline_iata: str | None = None,
    airline_icao: str | None = None,
) -> list[dict[str, Any]]:
    if not service_key:
        raise IcnAirlinesError("data-go-kr-key-missing")

    params: dict[str, str] = {
        "serviceKey": service_key,
        "type": "json",
    }
    if airline_iata:
        params["airline_iata"] = airline_iata.strip().upper()
    if airline_icao:
        params["airline_icao"] = airline_icao.strip().upper()

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(ICN_AIRLINES_API, params=params)
        response.raise_for_status()
        payload = response.json()

    header = payload.get("response", {}).get("header", {})
    result_code = str(header.get("resultCode", ""))
    if result_code and result_code not in {"00", "0"}:
        raise IcnAirlinesError(header.get("resultMsg") or "icn-airlines-api-error")

    return [_normalize_airline(item) for item in _normalize_items(payload)]


def list_local_airline_codes(
    *,
    query: str | None = None,
    limit: int = 20,
) -> list[dict[str, str]]:
    rows = ICN_AIRLINE_CODES
    if query:
        q = query.strip().lower()
        rows = [
            row
            for row in ICN_AIRLINE_CODES
            if q in row["iata"].lower()
            or q in row["icao"].lower()
            or q in row["name"].lower()
        ]
    return rows[:limit]


async def resolve_airline_profile(
    *,
    service_key: str,
    carrier: str | None = None,
    airline_iata: str | None = None,
    airline_icao: str | None = None,
) -> dict[str, Any] | None:
    if carrier:
        lowered = carrier.strip().lower()
        if any(keyword in lowered for keyword in CARGO_CARRIER_KEYWORDS):
            return None

    iata = airline_iata.strip().upper() if airline_iata else None
    icao = airline_icao.strip().upper() if airline_icao else None

    if not iata and not icao and carrier:
        iata = resolve_carrier_to_iata(carrier)

    if iata and iata in CARGO_IATA_CODES:
        return None

    local = None
    if iata:
        local = find_airline_by_iata(iata)
    elif icao:
        local = find_airline_by_icao(icao)

    if not service_key:
        if not local and not iata and not icao:
            return None
        resolved_iata = local["iata"] if local else (iata or "")
        return {
            "iata": resolved_iata,
            "icao": local["icao"] if local else (icao or ""),
            "name": local["name"] if local else (carrier or ""),
            "image": build_airline_icon_url(resolved_iata) if resolved_iata else "",
            "tel": "",
            "icTel": "",
            "source": "local-codes",
        }

    try:
        remote_items = await fetch_icn_airline_info(
            service_key=service_key,
            airline_iata=iata,
            airline_icao=icao,
        )
    except (IcnAirlinesError, httpx.HTTPError):
        remote_items = []

    if remote_items:
        item = remote_items[0]
        item["source"] = "icn-openapi"
        return item

    if local:
        return {
            "iata": local["iata"],
            "icao": local["icao"],
            "name": local["name"],
            "image": build_airline_icon_url(local["iata"]),
            "tel": "",
            "icTel": "",
            "source": "local-codes",
        }

    return None

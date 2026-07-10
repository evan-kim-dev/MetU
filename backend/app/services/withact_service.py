from __future__ import annotations

from typing import Any

import httpx

from app.core.config import get_settings

WITHACT_TIMEOUT_SECONDS = 15.0


class WithActError(Exception):
    def __init__(self, detail: str, status_code: int | None = None) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


def _base_url() -> str:
    return get_settings().withact_api_base.rstrip("/")


async def _request(
    method: str,
    path: str,
    *,
    json: dict[str, Any] | None = None,
) -> Any:
    url = f"{_base_url()}{path}"
    try:
        async with httpx.AsyncClient(timeout=WITHACT_TIMEOUT_SECONDS) as client:
            response = await client.request(method, url, json=json)
    except httpx.HTTPError as exc:
        raise WithActError("withact-unreachable") from exc

    if response.status_code >= 400:
        raise WithActError(
            f"withact-http-{response.status_code}",
            status_code=response.status_code,
        )

    if not response.content:
        return None
    return response.json()


async def list_required_items_by_guest(guest_id: str) -> list[dict[str, Any]]:
    data = await _request("GET", f"/api/required-items/guests/{guest_id}")
    return data if isinstance(data, list) else []


async def create_budget(guest_id: str, total_budget: int = 0) -> dict[str, Any]:
    data = await _request(
        "POST",
        "/api/budgets",
        json={"guestId": guest_id, "totalBudget": total_budget},
    )
    if not isinstance(data, dict) or data.get("id") is None:
        raise WithActError("withact-budget-create-failed")
    return data


async def create_required_item(
    guest_id: str,
    budget_id: int,
) -> dict[str, Any]:
    data = await _request(
        "POST",
        "/api/required-items",
        json={"guestId": guest_id, "budgetId": budget_id},
    )
    if not isinstance(data, dict) or data.get("id") is None:
        raise WithActError("withact-required-item-create-failed")
    return data


async def ensure_checklist_session(
    guest_id: str,
    total_budget: int = 0,
) -> dict[str, Any]:
    bundles = await list_required_items_by_guest(guest_id)
    if bundles:
        latest = bundles[-1]
        budget_id = latest.get("budgetId")
        required_item_id = latest.get("id")
        if budget_id is not None and required_item_id is not None:
            return {
                "guestId": guest_id,
                "budgetId": int(budget_id),
                "requiredItemId": int(required_item_id),
            }

    budget = await create_budget(guest_id, total_budget)
    bundle = await create_required_item(guest_id, int(budget["id"]))
    return {
        "guestId": guest_id,
        "budgetId": int(budget["id"]),
        "requiredItemId": int(bundle["id"]),
    }


async def save_required_item_icon(payload: dict[str, Any]) -> dict[str, Any]:
    data = await _request("POST", "/api/required-items/icon", json=payload)
    if not isinstance(data, dict):
        raise WithActError("withact-icon-save-failed")
    return data


async def list_required_item_details(required_item_id: int) -> list[dict[str, Any]]:
    data = await _request("GET", f"/api/required-items/{required_item_id}/details")
    return data if isinstance(data, list) else []

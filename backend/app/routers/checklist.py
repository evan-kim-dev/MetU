from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from app.services.withact_service import (
    WithActError,
    ensure_checklist_session,
    list_required_item_details,
    save_required_item_icon,
)

router = APIRouter(prefix="/checklist", tags=["checklist"])

ItemType = Literal["FLIGHT", "HOTEL", "DOCUMENT", "EXTRA"]
ItemStatus = Literal["NOT_STARTED", "SEARCHED", "SELECTED", "COMPLETED"]


class ChecklistSessionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    guest_id: str = Field(..., alias="guestId", min_length=1, max_length=128)
    total_budget: int = Field(default=0, ge=0, alias="totalBudget")


class ChecklistSessionResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    guest_id: str = Field(alias="guestId")
    budget_id: int = Field(alias="budgetId")
    required_item_id: int = Field(alias="requiredItemId")
    source: str = "withact"


class ChecklistItemRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    guest_id: str = Field(..., alias="guestId", min_length=1, max_length=128)
    budget_id: int = Field(..., alias="budgetId", ge=1)
    required_item_id: int = Field(..., alias="requiredItemId", ge=1)
    item_type: ItemType = Field(..., alias="itemType")
    item_status: ItemStatus = Field(..., alias="itemStatus")
    item_name: str = Field(..., alias="itemName", min_length=1, max_length=200)
    item_summary: str | None = Field(default=None, alias="itemSummary", max_length=2000)
    external_provider: str | None = Field(default=None, alias="externalProvider", max_length=64)
    external_item_id: str | None = Field(default=None, alias="externalItemId", max_length=128)
    external_url: str | None = Field(default=None, alias="externalUrl", max_length=500)
    selected: bool = False


def _handle_withact_error(exc: WithActError) -> HTTPException:
    status = exc.status_code if exc.status_code and exc.status_code < 500 else 502
    if status < 400:
        status = 502
    return HTTPException(status_code=status, detail=exc.detail)


@router.post(
    "/withact/session",
    response_model=ChecklistSessionResponse,
    response_model_by_alias=True,
)
async def create_withact_checklist_session(
    body: ChecklistSessionRequest,
) -> ChecklistSessionResponse:
    try:
        session = await ensure_checklist_session(
            guest_id=body.guest_id,
            total_budget=body.total_budget,
        )
    except WithActError as exc:
        raise _handle_withact_error(exc) from exc

    return ChecklistSessionResponse.model_validate(session)


@router.get("/withact/details")
async def get_withact_checklist_details(
    required_item_id: int = Query(..., alias="requiredItemId", ge=1),
) -> dict[str, Any]:
    try:
        details = await list_required_item_details(required_item_id)
    except WithActError as exc:
        raise _handle_withact_error(exc) from exc

    return {"details": details, "source": "withact"}


@router.post("/withact/items")
async def save_withact_checklist_item(body: ChecklistItemRequest) -> dict[str, Any]:
    payload = {
        "guestId": body.guest_id,
        "budgetId": body.budget_id,
        "requireditemId": body.required_item_id,
        "itemType": body.item_type,
        "itemStatus": body.item_status,
        "itemName": body.item_name,
        "itemSummary": body.item_summary,
        "externalProvider": body.external_provider,
        "externalItemId": body.external_item_id,
        "externalUrl": body.external_url,
        "selected": body.selected,
    }

    try:
        saved = await save_required_item_icon(payload)
    except WithActError as exc:
        raise _handle_withact_error(exc) from exc

    return {"item": saved, "source": "withact"}

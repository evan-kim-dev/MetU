"""Pydantic schemas for AI structured outputs (OpenRouter JSON / json_schema).

These mirror the contracts expected by Next.js BFF parsers
(lib/ai/generate-plan.ts, trip-tips, weather-insight, deals).
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def json_schema_for_openai(model: type[BaseModel], *, name: str) -> dict[str, Any]:
    """Build a JSON Schema payload for OpenRouter/OpenAI structured outputs."""
    schema = model.model_json_schema()
    # OpenAI strict schemas prefer additionalProperties: false on objects
    _force_additional_properties_false(schema)
    return {
        "name": name,
        "strict": True,
        "schema": schema,
    }


def _force_additional_properties_false(node: Any) -> None:
    if not isinstance(node, dict):
        return
    if node.get("type") == "object" or "properties" in node:
        node.setdefault("additionalProperties", False)
    for key in ("properties", "$defs", "definitions"):
        child = node.get(key)
        if isinstance(child, dict):
            for value in child.values():
                _force_additional_properties_false(value)
    for key in ("items", "anyOf", "oneOf", "allOf"):
        child = node.get(key)
        if isinstance(child, list):
            for value in child:
                _force_additional_properties_false(value)
        else:
            _force_additional_properties_false(child)


# ---------------------------------------------------------------------------
# Plan itinerary (mode=plan)
# ---------------------------------------------------------------------------


class PlanScheduleItem(BaseModel):
    time: str = Field(..., min_length=4, max_length=8, description="HH:MM")
    title: str = Field(..., min_length=2, max_length=120)
    detail: str = Field(..., min_length=8, max_length=400)

    @field_validator("time")
    @classmethod
    def normalize_time(cls, value: str) -> str:
        v = value.strip()
        if len(v) == 4 and v[1] == ":":
            v = f"0{v}"
        return v


class PlanDaySchedule(BaseModel):
    day: int = Field(..., ge=1, le=31)
    label: str = Field(..., min_length=2, max_length=80)
    items: list[PlanScheduleItem] = Field(..., min_length=3, max_length=12)


class PlanFlightOut(BaseModel):
    airline: str = Field(..., min_length=2, max_length=80)
    schedule: str = Field(..., min_length=4, max_length=120)
    note: str = Field(..., min_length=8, max_length=400)


class PlanHotelOut(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    area: str = Field(..., min_length=2, max_length=120)
    note: str = Field(..., min_length=8, max_length=400)


class PlanItineraryOut(BaseModel):
    """Structured trip plan JSON returned for mode=plan."""

    summary: str = Field(..., min_length=40, max_length=1200)
    flight: PlanFlightOut
    hotel: PlanHotelOut
    dailySchedule: list[PlanDaySchedule] = Field(..., min_length=1, max_length=21)
    tips: list[str] = Field(..., min_length=4, max_length=10)


# ---------------------------------------------------------------------------
# Tips (mode=tips) — lib/ai/trip-tips.ts
# ---------------------------------------------------------------------------


class TipItemOut(BaseModel):
    emoji: str = Field(..., min_length=1, max_length=8)
    title: str = Field(..., min_length=2, max_length=80)
    description: str = Field(..., min_length=12, max_length=400)


class TipsOut(BaseModel):
    tips: list[TipItemOut] = Field(..., min_length=6, max_length=10)


# ---------------------------------------------------------------------------
# Weather (mode=weather) — lib/ai/weather-insight.ts
# ---------------------------------------------------------------------------


class WeatherOut(BaseModel):
    summary: str = Field(..., min_length=20, max_length=800)
    preparation: list[str] = Field(..., min_length=1, max_length=8)


# ---------------------------------------------------------------------------
# Deals curate (mode=deals) — lib/deals/recommend-deals.ts
# ---------------------------------------------------------------------------


class DealRowOut(BaseModel):
    id: str = Field(..., min_length=1, max_length=64)
    highlight: str = Field(..., min_length=4, max_length=200)


class DealsOut(BaseModel):
    deals: list[DealRowOut] = Field(..., min_length=1, max_length=20)


# ---------------------------------------------------------------------------
# Deal enrich (mode=deal) — app/api/deals/[id]/route.ts
# ---------------------------------------------------------------------------


class DealEnrichOut(BaseModel):
    summary: str = Field(..., min_length=40, max_length=1200)
    whyCheap: list[str] = Field(..., min_length=2, max_length=8)
    budgetTips: list[str] = Field(..., min_length=3, max_length=8)
    mustTry: list[str] = Field(..., min_length=3, max_length=8)
    caution: str = Field(..., min_length=12, max_length=400)


# ---------------------------------------------------------------------------
# Prose insights wrapped for validation (text modes)
# ---------------------------------------------------------------------------


class InsightTextOut(BaseModel):
    """Wrapper so even prose modes are schema-validated."""

    text: str = Field(..., min_length=12, max_length=4000)


AiMode = Literal[
    "budget",
    "party",
    "deal",
    "weather",
    "factbomb",
    "tips",
    "style",
    "schedule",
    "plan",
    "deals",
    "summary",
    "buddy",
]

# Modes that already speak JSON to the frontend
JSON_MODES: set[str] = {"plan", "tips", "weather", "deals", "deal"}

MODE_RESPONSE_MODEL: dict[str, type[BaseModel]] = {
    "plan": PlanItineraryOut,
    "tips": TipsOut,
    "weather": WeatherOut,
    "deals": DealsOut,
    "deal": DealEnrichOut,
    "budget": InsightTextOut,
    "party": InsightTextOut,
    "factbomb": InsightTextOut,
    "style": InsightTextOut,
    "schedule": InsightTextOut,
    "summary": InsightTextOut,
    "buddy": InsightTextOut,
}

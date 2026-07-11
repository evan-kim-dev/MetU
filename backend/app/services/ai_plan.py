from __future__ import annotations

from app.services.openai_service import OpenAIService


class InsightService:
    """AI insight generation used by Next BFF.

    품질 최우선: OpenRouter 예산을 활용해 모드별 max_tokens·타임아웃을 넉넉히 둔다.
    """

    def __init__(self) -> None:
        self.openai = OpenAIService()

    async def budget_insight(self, *, prompt: str, system: str) -> str | None:
        return await self.openai.chat(
            system=system,
            user=prompt,
            temperature=0.45,
            max_tokens=4000,
            timeout=120.0,
        )

    async def party_insight(self, *, prompt: str, system: str) -> str | None:
        return await self.openai.chat(
            system=system,
            user=prompt,
            temperature=0.45,
            max_tokens=4000,
            timeout=120.0,
        )

    async def weather_insight(self, *, prompt: str, system: str) -> str | None:
        return await self.openai.chat(
            system=system,
            user=prompt,
            temperature=0.5,
            max_tokens=6000,
            json_mode=True,
            timeout=150.0,
        )

    async def factbomb_insight(self, *, prompt: str, system: str) -> str | None:
        return await self.openai.chat(
            system=system,
            user=prompt,
            temperature=0.85,
            max_tokens=3500,
            timeout=120.0,
        )

    async def tips_insight(self, *, prompt: str, system: str) -> str | None:
        return await self.openai.chat(
            system=system,
            user=prompt,
            temperature=0.6,
            max_tokens=8000,
            json_mode=True,
            timeout=150.0,
        )

    async def style_insight(self, *, prompt: str, system: str) -> str | None:
        return await self.openai.chat(
            system=system,
            user=prompt,
            temperature=0.55,
            max_tokens=3500,
            timeout=120.0,
        )

    async def schedule_insight(self, *, prompt: str, system: str) -> str | None:
        return await self.openai.chat(
            system=system,
            user=prompt,
            temperature=0.6,
            max_tokens=5000,
            timeout=120.0,
        )

    async def plan_itinerary(self, *, prompt: str, system: str) -> str | None:
        return await self.openai.chat(
            system=system,
            user=prompt,
            temperature=0.65,
            max_tokens=24000,
            json_mode=True,
            timeout=240.0,
        )

    async def deals_curate(self, *, prompt: str, system: str) -> str | None:
        return await self.openai.chat(
            system=system,
            user=prompt,
            temperature=0.55,
            max_tokens=8000,
            json_mode=True,
            timeout=150.0,
        )

    async def summary_insight(self, *, prompt: str, system: str) -> str | None:
        return await self.openai.chat(
            system=system,
            user=prompt,
            temperature=0.55,
            max_tokens=4000,
            timeout=120.0,
        )

    async def deal_enrich(self, *, prompt: str, system: str) -> str | None:
        return await self.openai.chat(
            system=system,
            user=prompt,
            temperature=0.65,
            max_tokens=8000,
            json_mode=True,
            timeout=180.0,
        )

    async def buddy_chat(self, *, prompt: str, system: str) -> str | None:
        return await self.openai.chat(
            system=system,
            user=prompt,
            temperature=0.9,
            max_tokens=1200,
            timeout=60.0,
        )

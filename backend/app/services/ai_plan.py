from __future__ import annotations

from app.services.openai_service import OpenAIService


class InsightService:
    """AI insight generation used by Next BFF."""

    def __init__(self) -> None:
        self.openai = OpenAIService()

    async def budget_insight(self, *, budget: int, prompt: str, system: str) -> str | None:
        return await self.openai.chat(
            system=system,
            user=prompt,
            temperature=0.3,
            max_tokens=120,
        )

    async def party_insight(self, *, prompt: str, system: str) -> str | None:
        return await self.openai.chat(
            system=system,
            user=prompt,
            temperature=0.3,
            max_tokens=140,
        )

    async def weather_insight(self, *, prompt: str, system: str) -> str | None:
        return await self.openai.chat(
            system=system,
            user=prompt,
            temperature=0.35,
            max_tokens=320,
            json_mode=True,
        )

    async def deal_enrich(self, *, prompt: str, system: str) -> str | None:
        return await self.openai.chat(
            system=system,
            user=prompt,
            temperature=0.6,
            max_tokens=500,
            json_mode=True,
        )

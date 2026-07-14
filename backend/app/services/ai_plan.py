from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from typing import Any

from pydantic import BaseModel

from app.schemas.ai_outputs import (
    JSON_MODES,
    MODE_RESPONSE_MODEL,
    InsightTextOut,
)
from app.services.ai_cache import ai_response_cache
from app.services.ai_prompts import build_system_prompt
from app.services.openai_service import OpenAIService

logger = logging.getLogger(__name__)


# Mode → generation knobs
_MODE_CONFIG: dict[str, dict[str, float | int]] = {
    "budget": {"temperature": 0.45, "max_tokens": 4000, "timeout": 120.0},
    "party": {"temperature": 0.45, "max_tokens": 4000, "timeout": 120.0},
    "weather": {"temperature": 0.5, "max_tokens": 6000, "timeout": 150.0},
    "factbomb": {"temperature": 0.85, "max_tokens": 3500, "timeout": 120.0},
    "tips": {"temperature": 0.6, "max_tokens": 8000, "timeout": 150.0},
    "style": {"temperature": 0.55, "max_tokens": 3500, "timeout": 120.0},
    "schedule": {"temperature": 0.6, "max_tokens": 5000, "timeout": 120.0},
    "plan": {"temperature": 0.55, "max_tokens": 24000, "timeout": 240.0},
    "deals": {"temperature": 0.55, "max_tokens": 8000, "timeout": 150.0},
    "summary": {"temperature": 0.55, "max_tokens": 4000, "timeout": 120.0},
    "deal": {"temperature": 0.65, "max_tokens": 8000, "timeout": 180.0},
    "buddy": {"temperature": 1.0, "max_tokens": 4000, "timeout": 90.0},
}

# buddy chats are unique — skip cache. High-reuse insights get longer TTL.
_CACHE_TTL: dict[str, float] = {
    "buddy": 0,
    "plan": 600,
    "budget": 900,
    "party": 900,
    "weather": 900,
    "tips": 600,
    "deals": 600,
    "deal": 600,
    "style": 600,
    "schedule": 600,
    "factbomb": 300,
    "summary": 600,
}

# Modes that benefit from token streaming (plain Korean text to the user)
STREAMABLE_TEXT_MODES = frozenset(
    {"buddy", "budget", "party", "factbomb", "style", "schedule", "summary"}
)


class InsightService:
    """AI insight generation used by Next BFF.

    All modes go through Pydantic-validated structured outputs (sync path).
    - JSON modes (plan/tips/...): validated model dumped back to JSON string
      for BFF compatibility (`ChatResponse.content`).
    - Text modes: wrapped as InsightTextOut, returned as plain `text` string
      so existing Next parsers keep working.
    Streaming path skips JSON wrapping for text modes (better UX).
    """

    def __init__(self) -> None:
        self.openai = OpenAIService()

    async def generate(
        self, *, mode: str, prompt: str, system: str
    ) -> tuple[str | None, bool]:
        """Returns (content, from_cache)."""
        cache_key = ai_response_cache.make_key(mode=mode, system=system, prompt=prompt)
        ttl = _CACHE_TTL.get(mode, 600.0)
        if ttl > 0:
            hit = ai_response_cache.get(cache_key)
            if hit is not None:
                return hit, True

        model = MODE_RESPONSE_MODEL.get(mode, InsightTextOut)
        cfg = _MODE_CONFIG.get(mode, _MODE_CONFIG["budget"])
        hardened_system = build_system_prompt(mode, system)

        user_prompt = prompt
        if mode not in JSON_MODES:
            user_prompt = (
                f"{prompt.strip()}\n\n"
                '응답은 반드시 JSON 객체 하나이며 형태는 '
                '{"text":"한국어 해요체 본문"} 입니다. 다른 키 금지.'
            )

        structured = await self.openai.chat_structured(
            system=hardened_system,
            user=user_prompt,
            response_model=model,
            schema_name=f"metu_{mode}",
            temperature=float(cfg["temperature"]),
            max_tokens=int(cfg["max_tokens"]),
            timeout=float(cfg["timeout"]),
        )
        if structured is None:
            return None, False

        content = self._to_bff_content(mode, structured)
        if ttl > 0 and content:
            ai_response_cache.set(cache_key, content, ttl_seconds=ttl)
        return content, False

    async def stream_text(
        self, *, mode: str, prompt: str, system: str
    ) -> AsyncIterator[dict[str, Any]]:
        """
        Yield SSE-friendly dict events for text modes:
          {"type":"meta","cached":bool}
          {"type":"token","t":str}
          {"type":"done","content":str,"source":str,"cached":bool}
          {"type":"error","message":str}
        """
        if mode not in STREAMABLE_TEXT_MODES:
            yield {"type": "error", "message": f"mode-{mode}-not-streamable"}
            return

        cache_key = ai_response_cache.make_key(mode=mode, system=system, prompt=prompt)
        ttl = _CACHE_TTL.get(mode, 600.0)
        if ttl > 0:
            hit = ai_response_cache.get(cache_key)
            if hit is not None:
                yield {"type": "meta", "cached": True}
                yield {
                    "type": "done",
                    "content": hit,
                    "source": "ai",
                    "cached": True,
                    "validated": True,
                }
                return

        yield {"type": "meta", "cached": False}

        cfg = _MODE_CONFIG.get(mode, _MODE_CONFIG["budget"])
        hardened_system = build_system_prompt(mode, system)
        # Plain text stream — no JSON wrapper (tokens go straight to UI)
        user_prompt = (
            f"{prompt.strip()}\n\n"
            "출력: 답변 본문만. JSON/마크다운 코드펜스 금지."
        )

        parts: list[str] = []
        async for token in self.openai.chat_stream(
            system=hardened_system,
            user=user_prompt,
            temperature=float(cfg["temperature"]),
            max_tokens=int(cfg["max_tokens"]),
            timeout=float(cfg["timeout"]),
        ):
            parts.append(token)
            yield {"type": "token", "t": token}

        content = "".join(parts).strip()
        if not content:
            yield {"type": "error", "message": "empty-ai"}
            return

        if ttl > 0:
            ai_response_cache.set(cache_key, content, ttl_seconds=ttl)

        yield {
            "type": "done",
            "content": content,
            "source": "ai",
            "cached": False,
            "validated": True,
        }

    def _to_bff_content(self, mode: str, model: BaseModel) -> str:
        """Serialize for existing Next.js BFF contracts."""
        if mode in JSON_MODES:
            return model.model_dump_json(exclude_none=True)
        if isinstance(model, InsightTextOut):
            return model.text.strip()
        data = model.model_dump(exclude_none=True)
        if "text" in data and isinstance(data["text"], str):
            return data["text"].strip()
        return json.dumps(data, ensure_ascii=False)

    # --- Backward-compatible method aliases ---

    async def budget_insight(self, *, prompt: str, system: str) -> str | None:
        content, _ = await self.generate(mode="budget", prompt=prompt, system=system)
        return content

    async def party_insight(self, *, prompt: str, system: str) -> str | None:
        content, _ = await self.generate(mode="party", prompt=prompt, system=system)
        return content

    async def weather_insight(self, *, prompt: str, system: str) -> str | None:
        content, _ = await self.generate(mode="weather", prompt=prompt, system=system)
        return content

    async def factbomb_insight(self, *, prompt: str, system: str) -> str | None:
        content, _ = await self.generate(mode="factbomb", prompt=prompt, system=system)
        return content

    async def tips_insight(self, *, prompt: str, system: str) -> str | None:
        content, _ = await self.generate(mode="tips", prompt=prompt, system=system)
        return content

    async def style_insight(self, *, prompt: str, system: str) -> str | None:
        content, _ = await self.generate(mode="style", prompt=prompt, system=system)
        return content

    async def schedule_insight(self, *, prompt: str, system: str) -> str | None:
        content, _ = await self.generate(mode="schedule", prompt=prompt, system=system)
        return content

    async def plan_itinerary(self, *, prompt: str, system: str) -> str | None:
        content, _ = await self.generate(mode="plan", prompt=prompt, system=system)
        return content

    async def deals_curate(self, *, prompt: str, system: str) -> str | None:
        content, _ = await self.generate(mode="deals", prompt=prompt, system=system)
        return content

    async def summary_insight(self, *, prompt: str, system: str) -> str | None:
        content, _ = await self.generate(mode="summary", prompt=prompt, system=system)
        return content

    async def deal_enrich(self, *, prompt: str, system: str) -> str | None:
        content, _ = await self.generate(mode="deal", prompt=prompt, system=system)
        return content

    async def buddy_chat(self, *, prompt: str, system: str) -> str | None:
        content, _ = await self.generate(mode="buddy", prompt=prompt, system=system)
        return content

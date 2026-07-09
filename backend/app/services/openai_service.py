from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import Settings, get_settings
from app.core.constants import OPENAI_CHAT_URL

logger = logging.getLogger(__name__)


class OpenAIService:
    """Thin wrapper around OpenAI Chat Completions."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    @property
    def enabled(self) -> bool:
        return bool(self.settings.openai_api_key)

    async def chat(
        self,
        *,
        system: str,
        user: str,
        temperature: float = 0.3,
        max_tokens: int = 200,
        json_mode: bool = False,
    ) -> str | None:
        if not self.enabled:
            logger.warning("OpenAI disabled: missing OPENAI_API_KEY")
            return None

        body: dict[str, Any] = {
            "model": self.settings.openai_model,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}

        try:
            async with httpx.AsyncClient(
                timeout=self.settings.openai_timeout_seconds
            ) as client:
                res = await client.post(
                    OPENAI_CHAT_URL,
                    headers={
                        "Authorization": f"Bearer {self.settings.openai_api_key}",
                        "Content-Type": "application/json",
                    },
                    json=body,
                )
            if res.status_code >= 400:
                logger.error("OpenAI HTTP %s: %s", res.status_code, res.text[:300])
                return None
            data = res.json()
            content = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content")
            )
            return content.strip() if isinstance(content, str) else None
        except Exception:
            logger.exception("OpenAI request failed")
            return None

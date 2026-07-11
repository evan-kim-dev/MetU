from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import Settings, get_settings
from app.core.constants import OPENROUTER_CHAT_URL

logger = logging.getLogger(__name__)


class OpenAIService:
    """Thin wrapper around OpenRouter Chat Completions."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    @property
    def enabled(self) -> bool:
        return bool(self.settings.openrouter_api_key or self.settings.openai_api_key)

    @property
    def api_key(self) -> str:
        return self.settings.openrouter_api_key or self.settings.openai_api_key

    @property
    def model(self) -> str:
        # Backward compatibility: OPENROUTER_MODEL 우선, 없으면 기존 OPENAI_MODEL 사용.
        return self.settings.openrouter_model or self.settings.openai_model

    @property
    def timeout_seconds(self) -> float:
        return self.settings.openrouter_timeout_seconds or self.settings.openai_timeout_seconds

    async def chat(
        self,
        *,
        system: str,
        user: str,
        temperature: float = 0.4,
        max_tokens: int = 8000,
        json_mode: bool = False,
        timeout: float | None = None,
    ) -> str | None:
        if not self.enabled:
            logger.warning("OpenRouter disabled: missing OPENROUTER_API_KEY")
            return None

        body: dict[str, Any] = {
            "model": self.model,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}

        headers: dict[str, str] = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if self.settings.openrouter_http_referer:
            headers["HTTP-Referer"] = self.settings.openrouter_http_referer
        if self.settings.openrouter_app_title:
            headers["X-OpenRouter-Title"] = self.settings.openrouter_app_title

        request_timeout = timeout if timeout is not None else self.timeout_seconds

        try:
            async with httpx.AsyncClient(timeout=request_timeout) as client:
                res = await client.post(
                    OPENROUTER_CHAT_URL,
                    headers=headers,
                    json=body,
                )
            if res.status_code >= 400:
                logger.error("OpenRouter HTTP %s: %s", res.status_code, res.text[:300])
                return None
            data = res.json()
            content = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content")
            )
            return content.strip() if isinstance(content, str) else None
        except Exception:
            logger.exception("OpenRouter request failed")
            return None

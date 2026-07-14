from __future__ import annotations

import json
import logging
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from app.core.config import Settings, get_settings
from app.core.constants import OPENROUTER_CHAT_URL
from app.schemas.ai_outputs import json_schema_for_openai

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)


class OpenAIService:
    """Thin wrapper around OpenRouter Chat Completions + structured outputs."""

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
        return self.settings.openrouter_model or self.settings.openai_model

    @property
    def timeout_seconds(self) -> float:
        return self.settings.openrouter_timeout_seconds or self.settings.openai_timeout_seconds

    def _headers(self) -> dict[str, str]:
        headers: dict[str, str] = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if self.settings.openrouter_http_referer:
            headers["HTTP-Referer"] = self.settings.openrouter_http_referer
        if self.settings.openrouter_app_title:
            headers["X-OpenRouter-Title"] = self.settings.openrouter_app_title
        return headers

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
        """Legacy string chat. Prefer chat_structured for JSON modes."""
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

        return await self._post_content(body, timeout)

    async def chat_structured(
        self,
        *,
        system: str,
        user: str,
        response_model: type[T],
        schema_name: str,
        temperature: float = 0.4,
        max_tokens: int = 8000,
        timeout: float | None = None,
        use_json_schema: bool = True,
    ) -> T | None:
        """
        Force JSON output and validate with Pydantic.
        1) Try OpenAI-style json_schema (strict)
        2) Fallback to json_object + local validation
        """
        if not self.enabled:
            logger.warning("OpenRouter disabled: missing OPENROUTER_API_KEY")
            return None

        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]

        if use_json_schema:
            body: dict[str, Any] = {
                "model": self.model,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "messages": messages,
                "response_format": {
                    "type": "json_schema",
                    "json_schema": json_schema_for_openai(
                        response_model, name=schema_name
                    ),
                },
            }
            raw = await self._post_content(body, timeout)
            parsed = self._parse_model(raw, response_model)
            if parsed is not None:
                return parsed
            logger.warning(
                "json_schema structured output failed for %s — falling back to json_object",
                schema_name,
            )

        # Fallback: json_object + Pydantic validate
        body = {
            "model": self.model,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "messages": messages,
            "response_format": {"type": "json_object"},
        }
        raw = await self._post_content(body, timeout)
        return self._parse_model(raw, response_model)

    def _parse_model(self, raw: str | None, response_model: type[T]) -> T | None:
        if not raw:
            return None
        text = raw.strip()
        if text.startswith("```"):
            # Strip accidental fences
            text = text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            logger.error("AI returned non-JSON for %s: %s", response_model.__name__, text[:200])
            return None
        try:
            return response_model.model_validate(data)
        except ValidationError as exc:
            logger.error(
                "AI JSON failed Pydantic validation (%s): %s | raw=%s",
                response_model.__name__,
                exc.error_count(),
                text[:240],
            )
            return None

    async def chat_stream(
        self,
        *,
        system: str,
        user: str,
        temperature: float = 0.4,
        max_tokens: int = 8000,
        timeout: float | None = None,
    ):
        """Yield content token deltas from OpenRouter (plain text, no JSON schema)."""
        if not self.enabled:
            logger.warning("OpenRouter disabled: missing OPENROUTER_API_KEY")
            return

        body: dict[str, Any] = {
            "model": self.model,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        }
        request_timeout = timeout if timeout is not None else self.timeout_seconds
        try:
            async with httpx.AsyncClient(timeout=request_timeout) as client:
                async with client.stream(
                    "POST",
                    OPENROUTER_CHAT_URL,
                    headers=self._headers(),
                    json=body,
                ) as res:
                    if res.status_code >= 400:
                        err = await res.aread()
                        logger.error(
                            "OpenRouter stream HTTP %s: %s",
                            res.status_code,
                            err[:400],
                        )
                        return
                    async for line in res.aiter_lines():
                        if not line or not line.startswith("data:"):
                            continue
                        payload = line[5:].strip()
                        if not payload or payload == "[DONE]":
                            if payload == "[DONE]":
                                break
                            continue
                        try:
                            data = json.loads(payload)
                        except json.JSONDecodeError:
                            continue
                        delta = (
                            data.get("choices", [{}])[0]
                            .get("delta", {})
                            .get("content")
                        )
                        if isinstance(delta, str) and delta:
                            yield delta
        except Exception:
            logger.exception("OpenRouter stream failed")
            return

    async def _post_content(
        self, body: dict[str, Any], timeout: float | None
    ) -> str | None:
        request_timeout = timeout if timeout is not None else self.timeout_seconds
        try:
            async with httpx.AsyncClient(timeout=request_timeout) as client:
                res = await client.post(
                    OPENROUTER_CHAT_URL,
                    headers=self._headers(),
                    json=body,
                )
            if res.status_code >= 400:
                # Some models reject json_schema — caller may fallback
                logger.error("OpenRouter HTTP %s: %s", res.status_code, res.text[:400])
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

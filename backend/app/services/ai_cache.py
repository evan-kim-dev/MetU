"""Simple in-memory TTL cache for AI chat responses."""

from __future__ import annotations

import hashlib
import threading
import time
from dataclasses import dataclass


@dataclass
class _CacheEntry:
    value: str
    expires_at: float


class AiResponseCache:
    def __init__(self, *, default_ttl_seconds: float = 600.0, max_entries: int = 256) -> None:
        self._default_ttl = default_ttl_seconds
        self._max_entries = max_entries
        self._store: dict[str, _CacheEntry] = {}
        self._lock = threading.Lock()

    @staticmethod
    def make_key(*, mode: str, system: str, prompt: str) -> str:
        raw = f"{mode}\n---\n{system}\n---\n{prompt}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def get(self, key: str) -> str | None:
        now = time.monotonic()
        with self._lock:
            entry = self._store.get(key)
            if not entry:
                return None
            if entry.expires_at < now:
                self._store.pop(key, None)
                return None
            return entry.value

    def set(self, key: str, value: str, ttl_seconds: float | None = None) -> None:
        ttl = self._default_ttl if ttl_seconds is None else ttl_seconds
        with self._lock:
            if len(self._store) >= self._max_entries:
                # Drop expired first, then oldest-ish arbitrary
                now = time.monotonic()
                expired = [k for k, v in self._store.items() if v.expires_at < now]
                for k in expired:
                    self._store.pop(k, None)
                while len(self._store) >= self._max_entries:
                    self._store.pop(next(iter(self._store)))
            self._store[key] = _CacheEntry(value=value, expires_at=time.monotonic() + ttl)


# Process-wide cache (FastAPI workers each have their own; fine for Step 2)
ai_response_cache = AiResponseCache(default_ttl_seconds=900.0, max_entries=300)

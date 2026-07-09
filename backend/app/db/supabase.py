from functools import lru_cache
from typing import Any

from app.core.config import get_settings


@lru_cache
def get_supabase() -> Any:
    """
    Singleton Supabase admin client (service_role).
    Lazy-imports supabase so the API can boot without the package
    until privileged DB calls are needed.
    """
    url, key = get_settings().require_supabase()
    try:
        from supabase import create_client
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError(
            "supabase package is not installed. Run: pip install -r requirements.txt"
        ) from exc
    return create_client(url, key)

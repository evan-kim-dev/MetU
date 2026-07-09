from typing import Any

from app.core.constants import TABLE_TRIPS
from app.db.supabase import get_supabase


class TripRepository:
    """DAO only — no OpenAI / business rules here."""

    def list_by_user(self, user_id: str) -> list[dict[str, Any]]:
        sb = get_supabase()
        res = (
            sb.table(TABLE_TRIPS)
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return list(res.data or [])

    def get(self, trip_id: str) -> dict[str, Any] | None:
        sb = get_supabase()
        res = (
            sb.table(TABLE_TRIPS)
            .select("*")
            .eq("id", trip_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None

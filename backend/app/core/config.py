from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    cors_origins: str = (
        "http://localhost:3000,https://met-u.vercel.app"
    )

    supabase_url: str = ""
    supabase_service_role_key: str = ""

    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_timeout_seconds: float = 90.0
    openrouter_api_key: str = ""
    openrouter_model: str = "~openai/gpt-latest"
    openrouter_timeout_seconds: float = 90.0
    openrouter_http_referer: str = ""
    openrouter_app_title: str = ""

    # 공공데이터포털 — 인천국제공항 취항 항공사(B551177), 한국공항공사 공항코드(B551178)
    data_go_kr_service_key: str = ""

    # Hotelbeds — 숙소 Content/Booking API (테스트: https://api.test.hotelbeds.com)
    hotelbeds_api_key: str = ""
    hotelbeds_api_secret: str = ""
    hotelbeds_api_base: str = "https://api.test.hotelbeds.com"

    # WithAct — 체크리스트(required-items) 프록시 전용
    withact_api_base: str = "https://api.withact.xyz"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

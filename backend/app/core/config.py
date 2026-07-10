from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    log_level: str = "info"
    cors_origins: str = (
        "http://localhost:3000,https://met-u.vercel.app"
    )

    supabase_url: str = ""
    supabase_service_role_key: str = ""

    db_host: str = ""
    db_port: int = 6543
    db_name: str = "postgres"
    db_user: str = ""
    db_password: str = ""
    jwt_secret: str = ""

    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_timeout_seconds: float = 30.0
    openrouter_api_key: str = ""
    openrouter_model: str = "~openai/gpt-latest"
    openrouter_timeout_seconds: float = 30.0
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

    def require_openai(self) -> str:
        if not self.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not configured")
        return self.openai_api_key

    def require_openrouter(self) -> str:
        api_key = self.openrouter_api_key or self.openai_api_key
        if not api_key:
            raise RuntimeError("OPENROUTER_API_KEY is not configured")
        return api_key

    def require_supabase(self) -> tuple[str, str]:
        if not self.supabase_url or not self.supabase_service_role_key:
            raise RuntimeError(
                "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured"
            )
        return self.supabase_url, self.supabase_service_role_key

    @property
    def database_url(self) -> str | None:
        if not self.db_host or not self.db_user or not self.db_password:
            return None
        from urllib.parse import quote_plus

        password = quote_plus(self.db_password)
        return (
            f"postgresql://{self.db_user}:{password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()

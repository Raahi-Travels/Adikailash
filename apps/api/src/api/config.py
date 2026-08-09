"""Runtime settings.

The database is shared with the Raahi intercity cab platform. Two consequences shape
everything here:

1. We own exactly one schema (``yatra``). Nothing we create may land in ``public``
   (Raahi's app tables) or ``auth`` (Supabase GoTrue).
2. ``public.alembic_version`` already belongs to Raahi's Python service. Our Alembic
   must keep its own version table inside our schema or the two will overwrite each
   other's migration head.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    #: Transaction-pooled (pgbouncer, port 6543) async URL for request handling.
    database_url: str = Field(alias="DATABASE_URL")

    #: Session-pooled (port 5432) sync URL. Migrations and anything needing
    #: prepared statements or advisory locks must use this.
    direct_database_url: str = Field(alias="DIRECT_DATABASE_URL")

    #: The only schema this service may write to.
    db_schema: str = Field(default="yatra", alias="DB_SCHEMA")

    #: Schemas owned by other services. Guarded against in migrations.
    foreign_schemas: tuple[str, ...] = ("public", "auth", "storage", "realtime", "vault")

    #: "development" | "production". Drives CORS strictness and the startup guards.
    app_env: str = Field(default="development", alias="APP_ENV")

    #: Comma-separated exact origins allowed to call the API with credentials.
    #: Required in production; see main.py.
    allowed_origins_raw: str = Field(default="", alias="ALLOWED_ORIGINS")

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins_raw.split(",") if o.strip()]

    @property
    def alembic_version_table_schema(self) -> str:
        return self.db_schema


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]

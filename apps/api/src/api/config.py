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

    # --- Document storage (Supabase Storage over the S3 protocol) ---
    #
    # Read through Settings rather than os.environ so a local `.env` and a real
    # container environment behave identically. pydantic-settings parses the file
    # without exporting to os.environ, so a module reading os.environ directly would
    # report "not configured" locally even with the keys filled in.
    s3_endpoint_url: str = Field(default="", alias="S3_ENDPOINT_URL")
    s3_region: str = Field(default="ap-south-1", alias="S3_REGION")
    s3_access_key_id: str = Field(default="", alias="S3_ACCESS_KEY_ID")
    s3_secret_access_key: str = Field(default="", alias="S3_SECRET_ACCESS_KEY")
    document_bucket: str = Field(default="traveller-documents", alias="DOCUMENT_BUCKET")

    # --- Public site identity and IndexNow ---
    #
    # The API needs to know the public origin to submit URLs, and it cannot read the
    # web app's brand config. Empty means no submissions, which is the correct state
    # until decision O7 settles a domain.
    public_site_origin: str = Field(default="", alias="PUBLIC_SITE_ORIGIN")

    # --- Outside data sources ---
    #
    # Open-Meteo's free tier is licensed for non-commercial use only, and a paid key
    # moves requests to a different host. Both are settings rather than constants
    # because which one applies is a commercial decision, and because the day the
    # business starts charging for journeys is the day the free tier stops being the
    # right thing to be using. Empty key means the free host, which is correct for
    # everything up to launch.
    open_meteo_api_key: str = Field(default="", alias="OPEN_METEO_API_KEY")
    open_meteo_host: str = Field(default="", alias="OPEN_METEO_HOST")

    # Two Indian government portals refuse this host's address, so those requests go
    # through a function pinned to Mumbai; see `api/live/india.py`. There is no
    # secret: the relay takes no caller-supplied URL, so there is nothing to protect.
    # This override exists for a preview deployment or a move; the default works.
    india_fetch_url: str = Field(default="", alias="INDIA_FETCH_URL")

    #: Guards every outside fetch. Set false to make the app stop calling anyone,
    #: which is what you want if a provider starts misbehaving and you cannot deploy.
    live_sources_enabled: bool = Field(default=True, alias="LIVE_SOURCES_ENABLED")

    # --- Assistant (doc 08's AI layer) ---
    #
    # Empty means the assistant runs retrieval-only: it still finds and cites approved
    # passages, it just does not draft prose from them. That is a supported mode, not
    # a broken one — most of the value is the retrieval.
    openrouter_api_key: str = Field(default="", alias="OPENROUTER_API_KEY")
    #: The provider's model slug, exactly as OpenRouter lists it. Configuration
    #: rather than a constant: catalogues change faster than deploys, and a slug
    #: baked into source is a silent failure the day it is renamed.
    openrouter_model: str = Field(default="", alias="OPENROUTER_MODEL")

    #: Public brand name, for the handful of places the API needs one — currently
    #: only OpenRouter's attribution header. Decision D4 forbids a brand string in
    #: any source file, and the API has no access to the web app's brand config, so
    #: it comes through the environment. Empty means the header is omitted rather
    #: than faked, the same way HTTP-Referer is while O7 is open.
    public_brand_name: str = Field(default="", alias="PUBLIC_BRAND_NAME")
    #: Any opaque string, 8 to 128 hex-ish characters. Must also be served at
    #: `<origin>/<key>.txt` or IndexNow refuses every submission with a 403.
    indexnow_key: str = Field(default="", alias="INDEXNOW_KEY")

    @property
    def storage_configured(self) -> bool:
        """True only when all three secrets are real, not placeholders.

        The placeholder check matters: the .env ships with PASTE_..._HERE values, and
        without this the API would claim storage works and then fail at upload time.
        """
        values = (self.s3_endpoint_url, self.s3_access_key_id, self.s3_secret_access_key)
        return all(v and not v.startswith("PASTE_") for v in values)

    @property
    def assistant_configured(self) -> bool:
        """Both halves present and not a placeholder.

        Same shape as `storage_configured`: the .env ships with PASTE_..._HERE values
        and without this check the API would claim the assistant works, then fail on
        the first draft.
        """
        return bool(
            self.openrouter_api_key
            and not self.openrouter_api_key.startswith("PASTE_")
            and self.openrouter_model
        )

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

"""Engine, session and declarative base.

Everything is pinned to the ``yatra`` schema through ``MetaData(schema=...)`` so a
model that forgets to declare a schema still cannot land in Raahi's ``public``.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import datetime

from enum import Enum as PyEnum

from sqlalchemy import CheckConstraint, Enum, MetaData, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from api.config import get_settings

settings = get_settings()

#: Naming convention so Alembic emits stable, predictable constraint names in a
#: database it shares with another service.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

metadata = MetaData(schema=settings.db_schema, naming_convention=NAMING_CONVENTION)


class Base(DeclarativeBase):
    metadata = metadata


def pg_enum(py_enum: type[PyEnum], name: str) -> Enum:
    """A native Postgres enum whose labels are the enum *values*.

    SQLAlchemy defaults to storing member NAMES, so ``DepartureState.OPEN_FOR_BOOKING``
    would become the label ``OPEN_FOR_BOOKING`` while every check constraint, API
    payload and ``StrEnum`` comparison in this codebase uses ``open_for_booking``.
    ``values_callable`` keeps the database labels identical to the Python values.

    ``inherit_schema=True`` is equally load-bearing. Without it SQLAlchemy creates the
    type in the *default* schema — meaning ``CREATE TYPE public.departure_state``,
    dropping our types into Raahi's schema alongside their ``genderenum`` and
    ``tierenum``. MetaData's schema is not inherited by enums automatically.
    """
    return Enum(
        py_enum,
        name=name,
        native_enum=True,
        create_constraint=False,
        inherit_schema=True,
        values_callable=lambda enum_cls: [member.value for member in enum_cls],
    )


#: Locales the content model supports. `en` is required on every localized field;
#: everything else is optional and falls back to English at render time.
DEFAULT_LOCALE = "en"
SUPPORTED_LOCALES = ("en", "hi")


def LocalizedText() -> JSONB:  # noqa: N802 — reads as a type at the call site
    """Translatable text as ``{"en": "...", "hi": "..."}``.

    Decision D9. Paired ``name`` / ``name_hi`` columns were rejected because O11
    anticipates further languages and the catalogue would have needed ~20 extra
    columns. One row carries every locale, which keeps PostgREST reads from the Raahi
    mobile app to a single query.

    Pair with :func:`requires_english` so a row cannot be saved with no English text.
    """
    return JSONB()


def requires_english(column: str) -> CheckConstraint:
    """CHECK ensuring a localized column carries at least the default locale.

    Without this, a half-filled admin form produces content that renders as an empty
    string on the public site — which for a journey name or a route status is a trust
    defect, not a cosmetic one.
    """
    # jsonb_exists(...) rather than the `?` operator: a literal ? in constraint text
    # is ambiguous with driver bind-parameter placeholders.
    return CheckConstraint(
        f"{column} IS NULL OR (jsonb_exists({column}, '{DEFAULT_LOCALE}') "
        f"AND length(trim({column} ->> '{DEFAULT_LOCALE}')) > 0)",
        name=f"{column}_has_english",
    )


class TimestampMixin:
    """Audit timestamps, with server defaults.

    Note these are `timestamp WITHOUT time zone`: the annotation is `datetime` and no
    explicit type is given, so SQLAlchemy infers a naive column. Values are UTC in
    practice because `func.now()` runs on a UTC server, and ordering and display are
    unaffected.

    What it does affect is comparison from Python. Passing an aware datetime into a
    query against these columns raises "can't subtract offset-naive and offset-aware
    datetimes" from asyncpg. Compare server-side (`func.now() - interval '1 day'`) or
    use one of the explicit `DateTime(timezone=True)` columns instead. Every column
    that carries operational meaning — `verified_at`, `send_after`, `occurred_at` —
    already declares its timezone explicitly for exactly this reason.
    """

    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        onupdate=func.now(),
        nullable=True,
    )


# Port 6543 is pgbouncer in transaction mode, which does not support prepared
# statements. asyncpg caches them by default and fails intermittently under load
# unless both caches are disabled — a genuinely nasty bug to diagnose after the fact.
engine = create_async_engine(
    settings.database_url,
    pool_pre_ping=True,
    connect_args={
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
    },
)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session

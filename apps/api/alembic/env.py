"""Alembic environment.

This database is SHARED with the Raahi intercity cab platform. Two safeguards below
are not optional:

1. ``include_name`` restricts reflection to our schema only. Without it, autogenerate
   compares our metadata against every schema it can see and cheerfully emits
   ``DROP TABLE`` for all 31 of Raahi's ``public`` tables. This filter is the single
   most important line in the file.

2. ``version_table_schema`` keeps our migration head in ``yatra.alembic_version``.
   ``public.alembic_version`` already belongs to Raahi's Python service; sharing it
   would make each service think the other's migrations were its own.
"""

from __future__ import annotations

import os
from logging.config import fileConfig

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool

from api.db import Base
from api.models import *  # noqa: F401,F403  — registers every table on Base.metadata

load_dotenv()

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

TARGET_SCHEMA = os.environ.get("DB_SCHEMA", "yatra")

#: Schemas owned by other services. Nothing here may ever appear in a migration.
FOREIGN_SCHEMAS = frozenset(
    {"public", "auth", "storage", "realtime", "vault", "extensions",
     "graphql", "graphql_public", "net", "supabase_functions", "supabase_migrations"}
)

target_metadata = Base.metadata


def _direct_url() -> str:
    """Migrations use the session pooler (5432), never the transaction pooler.

    DDL and Alembic's advisory locking need a real session; pgbouncer in transaction
    mode will not provide one.
    """
    url = os.environ.get("DIRECT_DATABASE_URL")
    if not url:
        raise RuntimeError("DIRECT_DATABASE_URL is not set — see apps/api/.env")
    return url


def include_name(name: str | None, type_: str, parent_names: dict) -> bool:
    """Restrict autogenerate to our schema. See the module docstring.

    Allow-list, not a deny-list. Postgres reports the *default* schema (public, where
    all 31 Raahi tables live) as ``None`` rather than by name, so a deny-list built
    from FOREIGN_SCHEMAS silently lets it through — autogenerate then reads Raahi's
    tables as "removed" and emits DROP TABLE for every one of them. Only ``yatra``
    passes.
    """
    if type_ == "schema":
        return name == TARGET_SCHEMA
    return True


def include_object(obj, name, type_, reflected, compare_to) -> bool:
    """Second gate, same allow-list logic, applied per object.

    Indexes and constraints carry no schema of their own, so resolve through the
    owning table. Anything that does not land squarely in our schema is excluded —
    including the ``public.users`` FK anchor in ``api.models.external``.
    """
    # Foreign keys pointing OUT of our schema (leads.raahi_user_id -> public.users)
    # can never be compared correctly, because the referent schema is excluded from
    # reflection by design. Left in, Alembic re-emits a drop-and-recreate of the same
    # constraint on every autogenerate — and its downgrade drops the referent_schema
    # entirely, producing a reference to a yatra.users table that does not exist.
    # The constraint is created inline with the table in the initial migration.
    # Read the target through the column spec rather than `referred_table`: on the
    # reflected side the referent schema is unreflected, so `referred_table` does not
    # resolve and the check silently passes.
    if type_ == "foreign_key_constraint":
        for element in getattr(obj, "elements", ()) or ():
            target = getattr(element, "target_fullname", "") or ""
            parts = target.split(".")
            # Three parts means schema-qualified: keep it only if the schema is ours.
            if len(parts) >= 3:
                if parts[0] != TARGET_SCHEMA:
                    return False
            # Two parts means UNQUALIFIED — which happens precisely because the
            # referent's schema was excluded from reflection. Our own constraints
            # always reflect as "yatra.table.column", so an unqualified target is by
            # definition pointing outside the schema we own.
            elif len(parts) == 2:
                return False

    schema = getattr(obj, "schema", None)
    if schema is None:
        parent = getattr(obj, "table", None)
        schema = getattr(parent, "schema", None)
    return schema == TARGET_SCHEMA


def _configure(**kwargs) -> None:
    context.configure(
        target_metadata=target_metadata,
        version_table="alembic_version",
        version_table_schema=TARGET_SCHEMA,
        include_schemas=True,
        include_name=include_name,
        include_object=include_object,
        compare_type=True,
        compare_server_default=True,
        **kwargs,
    )


def run_migrations_offline() -> None:
    _configure(
        url=_direct_url(),
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    section = config.get_section(config.config_ini_section, {})
    section["sqlalchemy.url"] = _direct_url()

    connectable = engine_from_config(
        section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        # Deliberately NOT setting search_path to our schema.
        #
        # Alembic derives the "default schema" from search_path. If yatra were the
        # default, reflection would report our tables with schema=None while our
        # metadata declares schema="yatra" — autogenerate then sees every table as
        # missing and tries to create duplicates. Leaving the default alone keeps
        # yatra genuinely non-default, which is what the metadata says.
        #
        # Nothing depends on search_path: every table is schema-qualified through
        # MetaData(schema=...), and the cross-schema FK to public.users is explicit.
        _configure(connection=connection)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

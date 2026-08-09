"""Read-only references to tables owned by the Raahi cab platform.

``leads.raahi_user_id`` points at ``public.users(id)``, and SQLAlchemy cannot resolve
that foreign key unless the target exists somewhere in the same ``MetaData``. This
module declares the minimum needed for resolution — the primary key column, nothing
more.

**We do not own these tables.** ``include_object`` in ``alembic/env.py`` filters
anything in a foreign schema out of autogenerate, so no migration will ever create,
alter or drop them. Do not add columns here to "keep it in sync": this is an FK
anchor, not a model. Read Raahi user data through their service, not through this.
"""

from __future__ import annotations

from sqlalchemy import Column, Integer, Table

from api.db import metadata

#: public.users(id) — integer identity PK, per the live schema.
raahi_users = Table(
    "users",
    metadata,
    Column("id", Integer, primary_key=True),
    schema="public",
    info={"external": True},
)

__all__ = ["raahi_users"]

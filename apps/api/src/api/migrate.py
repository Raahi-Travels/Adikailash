"""Run migrations at container start, under a lock, before the app serves.

**Why this moved out of Coolify's pre-deployment command.** That command runs inside
the *currently running* container — the old image. So the sequence was:

  1. A migration is applied from a developer's machine (dev and production share one
     Supabase database, decision D6), leaving the schema at revision X.
  2. Coolify starts a deploy and runs `alembic upgrade head` in the **old** container,
     whose `alembic/versions` directory has never heard of X.
  3. Alembic reads the schema's current revision, cannot locate it among its own
     files, and exits non-zero.
  4. The deploy aborts before the new image — the one that *does* contain X — is ever
     started.

Observed exactly that on 16 Aug 2026: `Can't locate revision identified by
'0f647b3d522f'`, from a container built on 9 Aug carrying four migration files
against a database eighteen revisions ahead. The API had been serving stale code for
days and every attempt to fix it failed on a migration that had nothing to do.

The image that contains the migrations has to be the one that applies them.

**The two objections the old Dockerfile comment raised are handled, not ignored.**

*Replicas racing*: a Postgres advisory lock. One container wins, the others block and
then find nothing to do. This is stricter than the pre-deployment command ever was —
that had no lock at all, it just ran somewhere there was only one of.

*A failed migration taking the API down*: it should. Serving new code against a
schema it does not match is worse than not serving, and Coolify keeps the previous
container running when a new one fails to become healthy. A migration failure now
means the old version stays up and the deploy is marked failed, which is the correct
outcome and a visible one.
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text

from api.config import get_settings

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("migrate")

#: Any int64 works; it only has to be the same in every replica and not collide with
#: another application's lock on this database. Derived from the schema name so a
#: second service in `public` cannot accidentally share it.
LOCK_KEY = 8_412_004_517_336_021


def run() -> None:
    settings = get_settings()
    root = Path(__file__).resolve().parents[2]

    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "alembic"))

    # The direct (session-pooled) URL, not pgbouncer: migrations need advisory locks
    # and prepared statements, and transaction pooling supports neither.
    engine = create_engine(settings.direct_database_url, future=True)

    with engine.connect() as connection:
        logger.info("Waiting for the migration lock…")
        connection.execute(text("SELECT pg_advisory_lock(:key)"), {"key": LOCK_KEY})
        connection.commit()
        try:
            logger.info("Running alembic upgrade head")
            command.upgrade(config, "head")
            logger.info("Schema is at head")
        finally:
            connection.execute(
                text("SELECT pg_advisory_unlock(:key)"), {"key": LOCK_KEY}
            )
            connection.commit()

    engine.dispose()


if __name__ == "__main__":
    try:
        run()
    except Exception as exc:  # noqa: BLE001 — the exit code is the whole point
        # Non-zero stops the container from serving. Coolify leaves the previous
        # version running and marks the deploy failed, which is what should happen
        # when the code and the schema do not agree.
        logger.error("Migration failed, refusing to start: %s", exc)
        sys.exit(1)

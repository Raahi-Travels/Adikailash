"""Remove fabricated route verifications from the database.

    uv run --project apps/api python -m api.purge_demo_status

**Why this deletes rather than replaces.** A route status is a claim that a named
person checked a named stretch of road on a given date. There were nine in the
database and not one of them was true: eight say `DEMO DATA - not a real
verification` outright, and the ninth is attributed to `ops@example.invalid`, a
reserved non-domain that can never receive mail. They were seeded to make the status
page render during development.

No amount of research can turn those into real verifications, and writing plausible
ones would be the single worst thing this codebase could do: the entire proposition
of the site is that we tell the truth about a road people drive at four thousand
metres. So they go, and the honest empty state takes over.

**What the site shows afterwards.** `LiveStatus.has_data` becomes false and the
status surfaces say so in their own words: "No verified route status yet. Our
coordinators publish conditions once the season opens and checks begin." That is
accurate. The route diagram draws every leg as not confirmed, which it already did,
because a stale reading was being downgraded to unknown anyway.

Nothing is lost that anybody would want. What is gained is that the database no
longer contains sentences claiming a person stood somewhere they did not.

**The demo staff account is deliberately left alone.** `ops@example.invalid` holds
`ops_manager`, `status_publisher` and `content_editor`, which is more privilege than
a demo row should carry, and it should go. But `yatra.staff_users` has no credential
column: sign-in runs through better-auth against `public.account`, which belongs to
Raahi (decision D6) and is not ours to read or modify. Disabling the only account
with admin roles, without being able to confirm whether somebody is currently using
it to sign in, is a lockout risk rather than a cleanup. It is reported instead.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db import SessionLocal
from api.models.operations import StatusUpdate
from api.models.staff import StaffUser

#: Markers that identify a verification nobody actually made. Both were introduced by
#: seeding; neither can occur in a real entry, because `.invalid` is reserved by RFC
#: 2606 precisely so that it can never resolve.
FABRICATED = ("DEMO DATA", "example.invalid")


async def purge(session: AsyncSession) -> int:
    rows = list(await session.scalars(select(StatusUpdate)))

    doomed = [
        row
        for row in rows
        if row.verified_by and any(mark in row.verified_by for mark in FABRICATED)
    ]

    for row in doomed:
        print(f"  removing: {row.access:16} by {row.verified_by[:52]}")

    if doomed:
        await session.execute(
            delete(StatusUpdate).where(StatusUpdate.id.in_([r.id for r in doomed]))
        )
        await session.commit()

    remaining = await session.scalar(select(func.count()).select_from(StatusUpdate))
    print(f"\n{len(doomed)} removed, {remaining} real verification(s) remain.")

    if remaining == 0:
        print(
            "The status pages will now say there is no verified route status yet, "
            "which is true. They start reporting again the moment a coordinator "
            "publishes one."
        )

    # Reported, not acted on. See the module docstring.
    for staff in await session.scalars(select(StaffUser)):
        if staff.email and "example.invalid" in staff.email:
            print(
                f"\nStill present: staff account {staff.email} with roles "
                f"{staff.roles}. It is a demo row with more privilege than it should "
                "have. Left alone because sign-in runs through better-auth tables "
                "owned by Raahi, so this cannot be checked or revoked from here "
                "without risking a lockout. Remove it once a real account exists."
            )


async def run() -> None:
    async with SessionLocal() as session:
        await purge(session)


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()

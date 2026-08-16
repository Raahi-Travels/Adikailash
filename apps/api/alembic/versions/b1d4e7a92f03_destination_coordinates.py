"""destination coordinates

Needed to ask a weather model about a specific place, and to test whether a disaster
alert's polygon contains it. Both are additive nullable columns on a table we own in
the `yatra` schema; nothing outside it is touched.

Revision ID: b1d4e7a92f03
Revises: 0f647b3d522f
Create Date: 2026-08-17

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b1d4e7a92f03"
down_revision: Union[str, Sequence[str], None] = "0f647b3d522f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "destinations",
        sa.Column("latitude", sa.Numeric(precision=9, scale=6), nullable=True),
        schema="yatra",
    )
    op.add_column(
        "destinations",
        sa.Column("longitude", sa.Numeric(precision=9, scale=6), nullable=True),
        schema="yatra",
    )
    op.add_column(
        "destinations",
        sa.Column("coordinate_source", sa.String(length=300), nullable=True),
        schema="yatra",
    )
    # Either both or neither. A latitude with no longitude is not a location, and a
    # half-populated row would silently be skipped by every consumer rather than
    # failing where somebody would notice.
    op.create_check_constraint(
        "coordinates_come_in_pairs",
        "destinations",
        "(latitude is null) = (longitude is null)",
        schema="yatra",
    )


def downgrade() -> None:
    op.drop_constraint(
        "coordinates_come_in_pairs", "destinations", schema="yatra", type_="check"
    )
    op.drop_column("destinations", "coordinate_source", schema="yatra")
    op.drop_column("destinations", "longitude", schema="yatra")
    op.drop_column("destinations", "latitude", schema="yatra")

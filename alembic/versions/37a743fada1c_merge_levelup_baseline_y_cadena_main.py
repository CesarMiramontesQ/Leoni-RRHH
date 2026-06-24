"""merge levelup baseline y cadena main

Revision ID: 37a743fada1c
Revises: g7h8i9j0k1l2, v1l2u3p0base
Create Date: 2026-06-24

Une la cadena incremental de main (head g7) con el baseline Bono (v1l2u3p0base).
"""

from typing import Sequence, Union

from alembic import op

revision: str = "37a743fada1c"
down_revision: Union[str, tuple[str, ...], None] = (
    "g7h8i9j0k1l2",
    "v1l2u3p0base",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

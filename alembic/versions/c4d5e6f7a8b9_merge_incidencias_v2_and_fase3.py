"""merge incidencias schema v2 y fase3 capacitaciones

Revision ID: c4d5e6f7a8b9
Revises: b2c3d4e5f6a7, v5w6x7y8z9a0
Create Date: 2026-05-22

Une las ramas:
- b2c3d4e5f6a7 (incidencias origen/synced_at)
- v5w6x7y8z9a0 (fase3 capacitaciones)
"""

from typing import Sequence, Union

from alembic import op

revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, tuple[str, ...], None] = ("b2c3d4e5f6a7", "v5w6x7y8z9a0")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

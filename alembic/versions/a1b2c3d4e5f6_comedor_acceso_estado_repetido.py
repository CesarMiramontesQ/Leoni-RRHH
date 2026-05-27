"""comedor acceso estado REPETIDO

Revision ID: d0e1f2a3b4c5
Revises: y1z2a3b4c5d6
Create Date: 2026-05-21

PostgreSQL: extiende comedor_acceso_estado_enum.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "d0e1f2a3b4c5"
down_revision: Union[str, None] = "y1z2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TYPE comedor_acceso_estado_enum ADD VALUE IF NOT EXISTS 'REPETIDO'"
    )


def downgrade() -> None:
    pass

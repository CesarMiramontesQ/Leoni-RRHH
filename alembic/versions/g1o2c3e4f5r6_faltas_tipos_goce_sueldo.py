"""falta_retardo_tipo_enum: tipos con goce de sueldo

Revision ID: g1o2c3e4f5r6
Revises: f1r2a3u4d5i6
Create Date: 2026-07-15
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "g1o2c3e4f5r6"
down_revision: Union[str, None] = "f1r2a3u4d5i6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TYPE falta_retardo_tipo_enum ADD VALUE IF NOT EXISTS 'matrimonio'"
    )
    op.execute(
        "ALTER TYPE falta_retardo_tipo_enum ADD VALUE IF NOT EXISTS 'incapacidad_interna'"
    )
    op.execute(
        "ALTER TYPE falta_retardo_tipo_enum ADD VALUE IF NOT EXISTS 'defuncion'"
    )
    op.execute(
        "ALTER TYPE falta_retardo_tipo_enum ADD VALUE IF NOT EXISTS 'paternidad'"
    )


def downgrade() -> None:
    # PostgreSQL no permite quitar valores de enum de forma segura.
    pass

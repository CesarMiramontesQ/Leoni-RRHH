"""tabla vacaciones — saldo de días por empleado

Revision ID: h9i0j1k2l3m4
Revises: l5m6n7o8p9q0
Create Date: 2026-05-27
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "h9i0j1k2l3m4"
down_revision: Union[str, None] = "l5m6n7o8p9q0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "vacaciones",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("empleado_id", sa.Integer(), nullable=False),
        sa.Column("dias_disponibles", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["empleado_id"], ["empleados.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("empleado_id", name="uq_vacaciones_empleado_id"),
    )


def downgrade() -> None:
    op.drop_table("vacaciones")

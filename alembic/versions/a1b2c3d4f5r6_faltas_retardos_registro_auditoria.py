"""tabla levelup_faltas_retardos_registro

Revision ID: a1b2c3d4f5r6
Revises: v1a2c3d4i5s6
Create Date: 2026-06-28
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4f5r6"
down_revision: Union[str, None] = "v1a2c3d4i5s6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.execute(
        sa.text(
            "SELECT 1 FROM pg_class WHERE relname = 'levelup_faltas_retardos_registro' AND relkind = 'r'"
        )
    ).scalar():
        return

    op.create_table(
        "levelup_faltas_retardos_registro",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("bono_origen", sa.String(length=64), nullable=False),
        sa.Column("bono_origen_id", sa.Integer(), nullable=False),
        sa.Column("registrado_por_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["registrado_por_id"], ["empleados.empleado_id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "bono_origen",
            "bono_origen_id",
            name="uq_levelup_faltas_retardos_registro_bono",
        ),
    )
    op.create_index(
        "ix_levelup_faltas_retardos_registro_bono_origen_id",
        "levelup_faltas_retardos_registro",
        ["bono_origen_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_levelup_faltas_retardos_registro_bono_origen_id",
        table_name="levelup_faltas_retardos_registro",
    )
    op.drop_table("levelup_faltas_retardos_registro")

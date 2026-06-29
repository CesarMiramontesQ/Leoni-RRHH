"""tabla levelup_curso_instructor_interno

Revision ID: b2c3d4e5f6i7
Revises: a1b2c3d4f5r6
Create Date: 2026-06-28
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b2c3d4e5f6i7"
down_revision: Union[str, None] = "a1b2c3d4f5r6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.execute(
        sa.text(
            "SELECT 1 FROM pg_class WHERE relname = 'levelup_curso_instructor_interno' AND relkind = 'r'"
        )
    ).scalar():
        return

    op.create_table(
        "levelup_curso_instructor_interno",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("empleado_id", sa.Integer(), nullable=False),
        sa.Column("especialidad", sa.String(length=255), nullable=True),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["empleado_id"], ["empleados.empleado_id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("empleado_id", name="uq_levelup_curso_instructor_interno_empleado"),
    )
    op.create_index(
        "ix_levelup_curso_instructor_interno_activo",
        "levelup_curso_instructor_interno",
        ["activo"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_levelup_curso_instructor_interno_activo",
        table_name="levelup_curso_instructor_interno",
    )
    op.drop_table("levelup_curso_instructor_interno")

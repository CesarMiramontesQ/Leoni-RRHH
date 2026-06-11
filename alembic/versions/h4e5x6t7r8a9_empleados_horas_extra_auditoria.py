"""empleados — fecha y usuario RH de autorización de horas extra

Revision ID: h4e5x6t7r8a9
Revises: h3e4x5t6r7a8
Create Date: 2026-06-11
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "h4e5x6t7r8a9"
down_revision: Union[str, None] = "h3e4x5t6r7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("empleados")}

    if "horas_extra_autorizado_en" not in columns:
        op.add_column(
            "empleados",
            sa.Column(
                "horas_extra_autorizado_en",
                sa.DateTime(timezone=True),
                nullable=True,
            ),
        )

    if "horas_extra_autorizado_por_id" not in columns:
        op.add_column(
            "empleados",
            sa.Column(
                "horas_extra_autorizado_por_id",
                sa.Integer(),
                sa.ForeignKey("empleados.id"),
                nullable=True,
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("empleados")}

    if "horas_extra_autorizado_por_id" in columns:
        op.drop_column("empleados", "horas_extra_autorizado_por_id")

    if "horas_extra_autorizado_en" in columns:
        op.drop_column("empleados", "horas_extra_autorizado_en")

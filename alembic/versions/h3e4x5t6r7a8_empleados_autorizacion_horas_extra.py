"""empleados — autorización para registrar horas extra

Revision ID: h3e4x5t6r7a8
Revises: h2e3x4t5r6a7
Create Date: 2026-06-11
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "h3e4x5t6r7a8"
down_revision: Union[str, None] = "h2e3x4t5r6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("empleados")}
    if "puede_registrar_horas_extra" in columns:
        return

    op.add_column(
        "empleados",
        sa.Column(
            "puede_registrar_horas_extra",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("empleados")}
    if "puede_registrar_horas_extra" not in columns:
        return

    op.drop_column("empleados", "puede_registrar_horas_extra")

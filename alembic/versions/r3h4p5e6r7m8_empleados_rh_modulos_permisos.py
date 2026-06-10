"""empleados rh modulos permisos

Revision ID: r3h4p5e6r7m8
Revises: q2r3s4t5u6v7, m1n2o3p4q5r6
Create Date: 2026-06-03

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "r3h4p5e6r7m8"
down_revision: Union[str, Sequence[str], None] = ("q2r3s4t5u6v7", "m1n2o3p4q5r6")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "empleados",
        sa.Column(
            "puede_administrar_permisos_rh",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "empleados",
        sa.Column(
            "modulos_rh",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("empleados", "modulos_rh")
    op.drop_column("empleados", "puede_administrar_permisos_rh")

"""horas extra — tabla de aprobadores (gerentes regionales y director)

Revision ID: h5e6x7t8r9a0
Revises: h4e5x6t7r8a9
Create Date: 2026-06-12
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "h5e6x7t8r9a0"
down_revision: Union[str, None] = "h4e5x6t7r8a9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("horas_extra_aprobadores"):
        return

    op.create_table(
        "horas_extra_aprobadores",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column(
            "empleado_id",
            sa.Integer(),
            sa.ForeignKey("empleados.id"),
            nullable=False,
        ),
        sa.Column(
            "tipo",
            sa.Enum(
                "gerente_regional",
                "director",
                name="horas_extra_aprobador_tipo_enum",
            ),
            nullable=False,
        ),
        sa.Column(
            "activo",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "creado_por_id",
            sa.Integer(),
            sa.ForeignKey("empleados.id"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("empleado_id", "tipo", name="uq_he_aprobador_empleado_tipo"),
    )
    # Solo puede existir un director activo a la vez.
    op.create_index(
        "uq_he_aprobador_director_activo",
        "horas_extra_aprobadores",
        ["tipo"],
        unique=True,
        postgresql_where=sa.text("tipo = 'director' AND activo"),
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("horas_extra_aprobadores"):
        op.drop_index(
            "uq_he_aprobador_director_activo",
            table_name="horas_extra_aprobadores",
        )
        op.drop_table("horas_extra_aprobadores")
    sa.Enum(name="horas_extra_aprobador_tipo_enum").drop(bind, checkfirst=True)

"""tabla levelup_faltas_retardos

Revision ID: f1r2t3a4r5d6
Revises: i2j3k4l5m6n7
Create Date: 2026-06-23
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f1r2t3a4r5d6"
down_revision: Union[str, None] = "i2j3k4l5m6n7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FALTA_RETARDO_TIPO_ENUM = postgresql.ENUM(
    "falta_justificada",
    "falta_injustificada",
    "retardo",
    "incapacidad",
    "suspension",
    name="falta_retardo_tipo_enum",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    FALTA_RETARDO_TIPO_ENUM.create(bind, checkfirst=True)

    if bind.execute(sa.text("SELECT 1 FROM pg_class WHERE relname = 'levelup_faltas_retardos' AND relkind = 'r'")).scalar():
        return

    op.create_table(
        "levelup_faltas_retardos",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("empleado_id", sa.Integer(), nullable=False),
        sa.Column("tipo", FALTA_RETARDO_TIPO_ENUM, nullable=False),
        sa.Column("fecha_evento", sa.Date(), nullable=False),
        sa.Column("fecha_fin", sa.Date(), nullable=True),
        sa.Column("observaciones", sa.Text(), nullable=True),
        sa.Column("registrado_por_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "fecha_fin IS NULL OR fecha_fin >= fecha_evento",
            name="chk_faltas_retardos_fecha_fin_gte_inicio",
        ),
        sa.ForeignKeyConstraint(["empleado_id"], ["empleados.empleado_id"]),
        sa.ForeignKeyConstraint(["registrado_por_id"], ["empleados.empleado_id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_levelup_faltas_retardos_empleado_id",
        "levelup_faltas_retardos",
        ["empleado_id"],
    )
    op.create_index(
        "ix_levelup_faltas_retardos_tipo",
        "levelup_faltas_retardos",
        ["tipo"],
    )
    op.create_index(
        "ix_levelup_faltas_retardos_fecha_evento",
        "levelup_faltas_retardos",
        ["fecha_evento"],
    )
    op.create_index(
        "ix_levelup_faltas_retardos_created_at",
        "levelup_faltas_retardos",
        ["created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_levelup_faltas_retardos_created_at", table_name="levelup_faltas_retardos")
    op.drop_index("ix_levelup_faltas_retardos_fecha_evento", table_name="levelup_faltas_retardos")
    op.drop_index("ix_levelup_faltas_retardos_tipo", table_name="levelup_faltas_retardos")
    op.drop_index("ix_levelup_faltas_retardos_empleado_id", table_name="levelup_faltas_retardos")
    op.drop_table("levelup_faltas_retardos")
    op.execute("DROP TYPE IF EXISTS falta_retardo_tipo_enum")

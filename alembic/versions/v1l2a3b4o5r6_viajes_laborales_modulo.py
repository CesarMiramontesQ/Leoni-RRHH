"""tabla levelup_viajes_laborales

Revision ID: v1l2a3b4o5r6
Revises: e360b2c3d4e5
Create Date: 2026-07-06
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "v1l2a3b4o5r6"
down_revision: Union[str, None] = "g1r2a3d4t5p6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

VIAJE_LABORAL_ESTADO_ENUM = postgresql.ENUM(
    "borrador",
    "pendiente",
    "aprobado",
    "rechazado",
    "cancelado",
    name="viaje_laboral_estado_enum",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    VIAJE_LABORAL_ESTADO_ENUM.create(bind, checkfirst=True)

    if bind.execute(
        sa.text(
            "SELECT 1 FROM pg_class WHERE relname = 'levelup_viajes_laborales' "
            "AND relkind = 'r'"
        )
    ).scalar():
        return

    op.create_table(
        "levelup_viajes_laborales",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("empleado_id", sa.Integer(), nullable=False),
        sa.Column("fecha_salida", sa.Date(), nullable=False),
        sa.Column("fecha_regreso", sa.Date(), nullable=False),
        sa.Column("lugar_origen", sa.String(length=255), nullable=False),
        sa.Column("lugar_destino", sa.String(length=255), nullable=False),
        sa.Column("motivo", sa.Text(), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("medio_transporte", sa.String(length=120), nullable=False),
        sa.Column("hospedaje", sa.String(length=255), nullable=True),
        sa.Column("viaticos_estimados", sa.Numeric(12, 2), nullable=True),
        sa.Column(
            "estado",
            VIAJE_LABORAL_ESTADO_ENUM,
            server_default="borrador",
            nullable=False,
        ),
        sa.Column("registrado_por_id", sa.Integer(), nullable=False),
        sa.Column("aprobado_por_id", sa.Integer(), nullable=True),
        sa.Column("motivo_rechazo", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "fecha_regreso >= fecha_salida",
            name="chk_viajes_laborales_fecha_regreso_gte_salida",
        ),
        sa.ForeignKeyConstraint(["empleado_id"], ["empleados.empleado_id"]),
        sa.ForeignKeyConstraint(["registrado_por_id"], ["empleados.empleado_id"]),
        sa.ForeignKeyConstraint(["aprobado_por_id"], ["empleados.empleado_id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_levelup_viajes_laborales_empleado_id",
        "levelup_viajes_laborales",
        ["empleado_id"],
    )
    op.create_index(
        "ix_levelup_viajes_laborales_fecha_salida",
        "levelup_viajes_laborales",
        ["fecha_salida"],
    )
    op.create_index(
        "ix_levelup_viajes_laborales_lugar_destino",
        "levelup_viajes_laborales",
        ["lugar_destino"],
    )
    op.create_index(
        "ix_levelup_viajes_laborales_estado",
        "levelup_viajes_laborales",
        ["estado"],
    )
    op.create_index(
        "ix_levelup_viajes_laborales_created_at",
        "levelup_viajes_laborales",
        ["created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_levelup_viajes_laborales_created_at", table_name="levelup_viajes_laborales"
    )
    op.drop_index(
        "ix_levelup_viajes_laborales_estado", table_name="levelup_viajes_laborales"
    )
    op.drop_index(
        "ix_levelup_viajes_laborales_lugar_destino",
        table_name="levelup_viajes_laborales",
    )
    op.drop_index(
        "ix_levelup_viajes_laborales_fecha_salida", table_name="levelup_viajes_laborales"
    )
    op.drop_index(
        "ix_levelup_viajes_laborales_empleado_id", table_name="levelup_viajes_laborales"
    )
    op.drop_table("levelup_viajes_laborales")
    op.execute("DROP TYPE IF EXISTS viaje_laboral_estado_enum")

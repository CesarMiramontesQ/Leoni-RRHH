"""comedor_accesos pre-autorizacion diaria comedor

Revision ID: h5i6j7k8l9m0
Revises: g3h4i5j6k7l8
Create Date: 2026-04-26

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "h5i6j7k8l9m0"
down_revision: Union[str, None] = "g3h4i5j6k7l8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_ENUM_NAME = "comedor_acceso_estado_enum"
_ENUM_VALUES = ("PENDIENTE", "ACCEDIDO", "EXPIRADO")

# Creación explícita del tipo (idempotente con checkfirst).
estado_enum_ddl = postgresql.ENUM(
    *_ENUM_VALUES,
    name=_ENUM_NAME,
    create_type=True,
)

# Misma definición sin emitir CREATE TYPE al crear la tabla (evita DuplicateObject).
estado_enum_column = postgresql.ENUM(
    *_ENUM_VALUES,
    name=_ENUM_NAME,
    create_type=False,
)


def upgrade() -> None:
    estado_enum_ddl.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "comedor_accesos",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("empleado_id", sa.Integer(), nullable=False),
        sa.Column("comedor_id", sa.Integer(), nullable=False),
        sa.Column("comedor_registro_id", sa.Integer(), nullable=False),
        sa.Column("fecha_servicio", sa.Date(), nullable=False),
        sa.Column(
            "estado_acceso",
            estado_enum_column,
            nullable=False,
            server_default="PENDIENTE",
        ),
        sa.Column("hora_entrada", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["comedor_id"], ["comedores.id"]),
        sa.ForeignKeyConstraint(["comedor_registro_id"], ["comedor_registros.id"]),
        sa.ForeignKeyConstraint(["empleado_id"], ["empleados.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "comedor_registro_id",
            "fecha_servicio",
            name="uq_comedor_acceso_registro_fecha",
        ),
    )
    op.create_index(
        "ix_comedor_accesos_empleado_fecha_estado",
        "comedor_accesos",
        ["empleado_id", "fecha_servicio", "estado_acceso"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_comedor_accesos_empleado_fecha_estado", table_name="comedor_accesos")
    op.drop_table("comedor_accesos")
    estado_enum_ddl.drop(op.get_bind(), checkfirst=True)

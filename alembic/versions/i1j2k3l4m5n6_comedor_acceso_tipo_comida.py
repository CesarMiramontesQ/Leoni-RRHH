"""comedor_accesos: tipo_comida y unicidad por empleado/fecha/tipo

Revision ID: i1j2k3l4m5n6
Revises: h5i6j7k8l9m0
Create Date: 2026-04-26

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "i1j2k3l4m5n6"
down_revision: Union[str, None] = "h5i6j7k8l9m0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_ENUM_NAME = "comedor_tipo_comida_enum"
_ENUM_VALUES = ("casera", "saludable")

tipo_enum_ddl = postgresql.ENUM(
    *_ENUM_VALUES,
    name=_ENUM_NAME,
    create_type=True,
)

tipo_enum_column = postgresql.ENUM(
    *_ENUM_VALUES,
    name=_ENUM_NAME,
    create_type=False,
)


def upgrade() -> None:
    tipo_enum_ddl.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "comedor_accesos",
        sa.Column(
            "tipo_comida",
            tipo_enum_column,
            nullable=False,
            server_default="casera",
        ),
    )
    op.drop_constraint(
        "uq_comedor_acceso_registro_fecha",
        "comedor_accesos",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_comedor_acceso_empleado_fecha_tipo",
        "comedor_accesos",
        ["empleado_id", "fecha_servicio", "tipo_comida"],
    )
    op.alter_column("comedor_accesos", "tipo_comida", server_default=None)


def downgrade() -> None:
    op.drop_constraint(
        "uq_comedor_acceso_empleado_fecha_tipo",
        "comedor_accesos",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_comedor_acceso_registro_fecha",
        "comedor_accesos",
        ["comedor_registro_id", "fecha_servicio"],
    )
    op.drop_column("comedor_accesos", "tipo_comida")
    tipo_enum_ddl.drop(op.get_bind(), checkfirst=True)

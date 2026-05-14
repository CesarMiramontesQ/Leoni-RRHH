"""fase3_capacitaciones

Revision ID: v5w6x7y8z9a0
Revises: u4v5w6x7y8z9, z9y8x7w6v5u4
Create Date: 2026-05-14 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision: str = "v5w6x7y8z9a0"
down_revision: Union[str, Sequence[str]] = ("u4v5w6x7y8z9", "z9y8x7w6v5u4")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "capacitaciones",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nombre", sa.String(255), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("duracion_horas", sa.Integer(), nullable=False),
        sa.Column("modalidad", sa.String(20), nullable=False),
        sa.Column("instructor", sa.String(255), nullable=True),
        sa.Column("fecha_inicio", sa.DateTime(timezone=True), nullable=True),
        sa.Column("fecha_fin", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cupo_maximo", sa.Integer(), nullable=True),
        sa.Column("area_id", sa.Integer(), nullable=True),
        sa.Column("competencias_asociadas", JSONB(), nullable=True),
        sa.Column(
            "estado", sa.String(20), nullable=False, server_default="activa"
        ),
        sa.Column(
            "activo", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column("created_by", sa.Integer(), nullable=True),
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
        sa.ForeignKeyConstraint(["area_id"], ["areas.area_id"]),
        sa.ForeignKeyConstraint(["created_by"], ["empleados.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_capacitaciones_activo_estado",
        "capacitaciones",
        ["activo", "estado"],
    )
    op.create_index(
        "ix_capacitaciones_area_id",
        "capacitaciones",
        ["area_id"],
    )

    op.create_table(
        "inscripciones_capacitacion",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("capacitacion_id", sa.Integer(), nullable=False),
        sa.Column("empleado_id", sa.Integer(), nullable=False),
        sa.Column(
            "estado", sa.String(20), nullable=False, server_default="inscrito"
        ),
        sa.Column("calificacion", sa.Integer(), nullable=True),
        sa.Column(
            "fecha_inscripcion",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("fecha_completado", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["capacitacion_id"], ["capacitaciones.id"]),
        sa.ForeignKeyConstraint(["empleado_id"], ["empleados.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_inscripciones_empleado_id",
        "inscripciones_capacitacion",
        ["empleado_id"],
    )
    op.create_index(
        "uq_inscripcion_cap_emp",
        "inscripciones_capacitacion",
        ["capacitacion_id", "empleado_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_table("inscripciones_capacitacion")
    op.drop_table("capacitaciones")

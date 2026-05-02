"""alinear tabla actas con formulario nueva acta

Revision ID: 9a1b2c3d4e5f
Revises: b4c7d2e1f0a3
Create Date: 2026-05-02 12:55:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "9a1b2c3d4e5f"
down_revision: Union[str, None] = "b4c7d2e1f0a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    table_name = "actas_administrativas"
    bind = op.get_bind()
    fundamento_enum = sa.Enum(
        "Ley Federal del Trabajo",
        "Reglamento Interior de Trabajo",
        name="acta_fundamento_legal_enum",
    )
    fundamento_enum.create(bind, checkfirst=True)

    op.add_column(table_name, sa.Column("numero_empleado", sa.String(length=50), nullable=True))
    op.add_column(table_name, sa.Column("area_departamento", sa.String(length=255), nullable=True))
    op.add_column(table_name, sa.Column("supervisor_directo", sa.String(length=255), nullable=True))
    op.add_column(table_name, sa.Column("tipo_falta", sa.Text(), nullable=True))
    op.add_column(table_name, sa.Column("fundamento_legal", fundamento_enum, nullable=True))
    op.add_column(table_name, sa.Column("articulo_inciso", sa.Text(), nullable=True))
    op.add_column(table_name, sa.Column("fecha_evento", sa.Date(), nullable=True))
    op.add_column(table_name, sa.Column("lugar_incidente", sa.String(length=255), nullable=True))
    op.add_column(table_name, sa.Column("descripcion_hechos", sa.Text(), nullable=True))
    op.add_column(table_name, sa.Column("personas_involucradas", sa.Text(), nullable=True))
    op.add_column(table_name, sa.Column("testigos", sa.Text(), nullable=True))
    op.add_column(table_name, sa.Column("responsable_rh", sa.String(length=255), nullable=True))
    op.add_column(table_name, sa.Column("evidencia", sa.Text(), nullable=True))


def downgrade() -> None:
    table_name = "actas_administrativas"
    op.drop_column(table_name, "evidencia")
    op.drop_column(table_name, "responsable_rh")
    op.drop_column(table_name, "testigos")
    op.drop_column(table_name, "personas_involucradas")
    op.drop_column(table_name, "descripcion_hechos")
    op.drop_column(table_name, "lugar_incidente")
    op.drop_column(table_name, "fecha_evento")
    op.drop_column(table_name, "articulo_inciso")
    op.drop_column(table_name, "fundamento_legal")
    op.drop_column(table_name, "tipo_falta")
    op.drop_column(table_name, "supervisor_directo")
    op.drop_column(table_name, "area_departamento")
    op.drop_column(table_name, "numero_empleado")

    fundamento_enum = sa.Enum(
        "Ley Federal del Trabajo",
        "Reglamento Interior de Trabajo",
        name="acta_fundamento_legal_enum",
    )
    fundamento_enum.drop(op.get_bind(), checkfirst=True)

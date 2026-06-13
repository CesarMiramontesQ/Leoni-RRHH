"""horas extra — eliminar departamento_id y tabla departamentos

Revision ID: h2e3x4t5r6a7
Revises: h1e2x3t4r5a6
Create Date: 2026-06-10
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "h2e3x4t5r6a7"
down_revision: Union[str, None] = "h1e2x3t4r5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("horas_extra_solicitudes")}
    if "departamento_id" not in columns:
        return

    op.drop_index("idx_he_solicitudes_org", table_name="horas_extra_solicitudes")
    op.drop_constraint(
        "horas_extra_solicitudes_departamento_id_fkey",
        "horas_extra_solicitudes",
        type_="foreignkey",
    )
    op.drop_column("horas_extra_solicitudes", "departamento_id")
    op.drop_table("departamentos")
    op.create_index(
        "idx_he_solicitudes_org",
        "horas_extra_solicitudes",
        ["area_id", "subarea_id"],
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {col["name"] for col in inspector.get_columns("horas_extra_solicitudes")}
    if "departamento_id" in columns:
        return

    op.drop_index("idx_he_solicitudes_org", table_name="horas_extra_solicitudes")

    op.create_table(
        "departamentos",
        sa.Column("departamento_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("codigo", sa.String(length=20), nullable=False),
        sa.Column("nombre", sa.String(length=150), nullable=False),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.PrimaryKeyConstraint("departamento_id"),
        sa.UniqueConstraint("codigo"),
    )

    op.add_column(
        "horas_extra_solicitudes",
        sa.Column("departamento_id", sa.Integer(), nullable=True),
    )
    op.execute(
        """
        INSERT INTO departamentos (codigo, nombre, activo)
        SELECT DISTINCT
            'AREA-' || s.area_id::text,
            COALESCE(a.descripcion, 'Área ' || s.area_id::text),
            true
        FROM horas_extra_solicitudes s
        LEFT JOIN areas a ON a.area_id = s.area_id
        ON CONFLICT (codigo) DO NOTHING
        """
    )
    op.execute(
        """
        UPDATE horas_extra_solicitudes s
        SET departamento_id = d.departamento_id
        FROM departamentos d
        WHERE d.codigo = 'AREA-' || s.area_id::text
        """
    )
    op.alter_column("horas_extra_solicitudes", "departamento_id", nullable=False)
    op.create_foreign_key(
        "horas_extra_solicitudes_departamento_id_fkey",
        "horas_extra_solicitudes",
        "departamentos",
        ["departamento_id"],
        ["departamento_id"],
    )
    op.create_index(
        "idx_he_solicitudes_org",
        "horas_extra_solicitudes",
        ["departamento_id", "area_id", "subarea_id"],
    )

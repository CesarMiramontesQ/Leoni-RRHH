"""juntas

Crea el esquema del modulo Juntas (tablas levelup_juntas y
levelup_junta_asistente). Todas las FKs apuntan a `empleados.empleado_id`
(catalogo legacy Bono, read-only) o a tablas `levelup_*`; no toca catalogos Bono.

Revision ID: j1u2n3t4a5s6
Revises: e360b2c3d4e5
Create Date: 2026-07-03 21:20:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "j1u2n3t4a5s6"
down_revision: Union[str, None] = "e360b2c3d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Junta (padre) ─────────────────────────────────────────────────────────
    op.create_table(
        "levelup_juntas",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nombre", sa.String(length=255), nullable=False),
        sa.Column("motivo", sa.Text(), nullable=True),
        sa.Column("categoria", sa.String(length=120), nullable=True),
        sa.Column("estado", sa.String(length=20), nullable=False, server_default="registrada"),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["empleados.empleado_id"]),
        sa.ForeignKeyConstraint(["updated_by"], ["empleados.empleado_id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_levelup_juntas_categoria", "levelup_juntas", ["categoria"])

    # ── Asistentes (hijos) ────────────────────────────────────────────────────
    op.create_table(
        "levelup_junta_asistente",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("junta_id", sa.Integer(), nullable=False),
        sa.Column("empleado_id", sa.Integer(), nullable=False),
        sa.Column("asistio", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["junta_id"], ["levelup_juntas.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["empleado_id"], ["empleados.empleado_id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("junta_id", "empleado_id", name="uq_levelup_junta_asistente"),
    )
    op.create_index(
        "ix_levelup_junta_asistente_empleado",
        "levelup_junta_asistente",
        ["empleado_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_levelup_junta_asistente_empleado", table_name="levelup_junta_asistente")
    op.drop_table("levelup_junta_asistente")
    op.drop_index("ix_levelup_juntas_categoria", table_name="levelup_juntas")
    op.drop_table("levelup_juntas")

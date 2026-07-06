"""evaluacion 360 fase 3: plantillas y plantillas de correo

Agrega tablas de plantillas reutilizables (levelup_eval360_plantilla + hijos)
y la columna plantillas_correo a levelup_eval360_config.

Revision ID: e360b2c3d4e5
Revises: e360a1b2c3d4
Create Date: 2026-07-01 17:20:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "e360b2c3d4e5"
down_revision: Union[str, None] = "e360a1b2c3d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "levelup_eval360_config",
        sa.Column("plantillas_correo", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )

    op.create_table(
        "levelup_eval360_plantilla",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nombre", sa.String(length=255), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("escala_id", sa.Integer(), nullable=True),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["escala_id"], ["levelup_eval360_escala.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["empleados.empleado_id"]),
        sa.ForeignKeyConstraint(["updated_by"], ["empleados.empleado_id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "levelup_eval360_plantilla_competencia",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("plantilla_id", sa.Integer(), nullable=False),
        sa.Column("competencia_id", sa.Integer(), nullable=False),
        sa.Column("peso", sa.Numeric(6, 2), nullable=False, server_default="0"),
        sa.Column("num_preguntas", sa.SmallInteger(), nullable=True),
        sa.Column("nivel_esperado", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("obligatoria", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("orden", sa.SmallInteger(), nullable=True),
        sa.ForeignKeyConstraint(["plantilla_id"], ["levelup_eval360_plantilla.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["competencia_id"], ["levelup_competencias.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("plantilla_id", "competencia_id", name="uq_levelup_eval360_plantilla_competencia"),
    )

    op.create_table(
        "levelup_eval360_plantilla_evaluador_tipo",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("plantilla_id", sa.Integer(), nullable=False),
        sa.Column("tipo", sa.String(length=20), nullable=False),
        sa.Column("peso", sa.Numeric(6, 2), nullable=False, server_default="0"),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(["plantilla_id"], ["levelup_eval360_plantilla.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("plantilla_id", "tipo", name="uq_levelup_eval360_plantilla_evaluador_tipo"),
    )


def downgrade() -> None:
    op.drop_table("levelup_eval360_plantilla_evaluador_tipo")
    op.drop_table("levelup_eval360_plantilla_competencia")
    op.drop_table("levelup_eval360_plantilla")
    op.drop_column("levelup_eval360_config", "plantillas_correo")

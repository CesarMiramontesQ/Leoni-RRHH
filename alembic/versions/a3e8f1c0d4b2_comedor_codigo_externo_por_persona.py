"""comedor codigo externo por persona (empleado_id, lote_id)

Revision ID: a3e8f1c0d4b2
Revises: 2f4b8c1d9e77
Create Date: 2026-04-28 16:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect


revision: str = "a3e8f1c0d4b2"
down_revision: Union[str, None] = "2f4b8c1d9e77"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _index_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = inspect(bind)
    return {idx["name"] for idx in inspector.get_indexes(table_name)}


def _column_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = inspect(bind)
    return {col["name"] for col in inspector.get_columns(table_name)}


def upgrade() -> None:
    table = "comedor_codigos_externos"
    cols = _column_names(table)
    if "empleado_id" not in cols:
        op.add_column(
            table,
            sa.Column("empleado_id", sa.Integer(), nullable=True),
        )
        op.create_foreign_key(
            "fk_comedor_codigos_externos_empleado",
            table,
            "empleados",
            ["empleado_id"],
            ["id"],
        )
        op.create_index(
            "ix_comedor_codigos_externos_empleado_id",
            table,
            ["empleado_id"],
            unique=False,
        )
    if "lote_id" not in cols:
        op.add_column(
            table,
            sa.Column("lote_id", sa.String(length=36), nullable=True),
        )
        op.create_index(
            "ix_comedor_codigos_externos_lote_id",
            table,
            ["lote_id"],
            unique=False,
        )

    idx = _index_names(table)
    if "ix_comedor_codigos_externos_codigo" in idx:
        op.drop_index("ix_comedor_codigos_externos_codigo", table_name=table)
    if "ix_comedor_codigos_externos_codigo_acceso" not in idx:
        op.create_index(
            "ix_comedor_codigos_externos_codigo_acceso",
            table,
            ["codigo_acceso"],
            unique=True,
        )


def downgrade() -> None:
    table = "comedor_codigos_externos"
    idx = _index_names(table)
    if "ix_comedor_codigos_externos_codigo_acceso" in idx:
        op.drop_index("ix_comedor_codigos_externos_codigo_acceso", table_name=table)
    if "ix_comedor_codigos_externos_codigo" not in idx:
        op.create_index(
            "ix_comedor_codigos_externos_codigo",
            table,
            ["codigo_acceso"],
            unique=False,
        )

    cols = _column_names(table)
    if "lote_id" in cols:
        if "ix_comedor_codigos_externos_lote_id" in _index_names(table):
            op.drop_index("ix_comedor_codigos_externos_lote_id", table_name=table)
        op.drop_column(table, "lote_id")
    if "empleado_id" in cols:
        if "ix_comedor_codigos_externos_empleado_id" in _index_names(table):
            op.drop_index("ix_comedor_codigos_externos_empleado_id", table_name=table)
        op.drop_constraint("fk_comedor_codigos_externos_empleado", table, type_="foreignkey")
        op.drop_column(table, "empleado_id")

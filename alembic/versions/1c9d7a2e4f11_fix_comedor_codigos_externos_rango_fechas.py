"""fix comedor_codigos_externos rango fechas

Revision ID: 1c9d7a2e4f11
Revises: 0b237ebcdd8b
Create Date: 2026-04-28 14:45:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = "1c9d7a2e4f11"
down_revision: Union[str, None] = "0b237ebcdd8b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = inspect(bind)
    return {col["name"] for col in inspector.get_columns(table_name)}


def _index_names(table_name: str) -> set[str]:
    bind = op.get_bind()
    inspector = inspect(bind)
    return {idx["name"] for idx in inspector.get_indexes(table_name)}


def upgrade() -> None:
    table_name = "comedor_codigos_externos"
    cols = _column_names(table_name)

    # Compatibilidad para DBs donde la tabla ya existía con fecha_servicio.
    if "fecha_inicio" not in cols:
        op.add_column(table_name, sa.Column("fecha_inicio", sa.Date(), nullable=True))
    if "fecha_fin" not in cols:
        op.add_column(table_name, sa.Column("fecha_fin", sa.Date(), nullable=True))

    cols = _column_names(table_name)
    if "fecha_servicio" in cols:
        op.execute(
            sa.text(
                """
                UPDATE comedor_codigos_externos
                SET fecha_inicio = COALESCE(fecha_inicio, fecha_servicio),
                    fecha_fin = COALESCE(fecha_fin, fecha_servicio)
                """
            )
        )

    op.execute(
        sa.text(
            """
            UPDATE comedor_codigos_externos
            SET fecha_inicio = COALESCE(fecha_inicio, CURRENT_DATE),
                fecha_fin = COALESCE(fecha_fin, CURRENT_DATE)
            """
        )
    )

    op.alter_column(table_name, "fecha_inicio", existing_type=sa.Date(), nullable=False)
    op.alter_column(table_name, "fecha_fin", existing_type=sa.Date(), nullable=False)

    idx = _index_names(table_name)
    if "ix_comedor_codigos_externos_fecha" in idx:
        op.drop_index("ix_comedor_codigos_externos_fecha", table_name=table_name)
    if "ix_comedor_codigos_externos_fecha_inicio" not in idx:
        op.create_index(
            "ix_comedor_codigos_externos_fecha_inicio",
            table_name,
            ["fecha_inicio"],
            unique=False,
        )
    if "ix_comedor_codigos_externos_fecha_fin" not in idx:
        op.create_index(
            "ix_comedor_codigos_externos_fecha_fin",
            table_name,
            ["fecha_fin"],
            unique=False,
        )


def downgrade() -> None:
    table_name = "comedor_codigos_externos"
    idx = _index_names(table_name)
    if "ix_comedor_codigos_externos_fecha_inicio" in idx:
        op.drop_index("ix_comedor_codigos_externos_fecha_inicio", table_name=table_name)
    if "ix_comedor_codigos_externos_fecha_fin" in idx:
        op.drop_index("ix_comedor_codigos_externos_fecha_fin", table_name=table_name)
    if "ix_comedor_codigos_externos_fecha" not in idx:
        op.create_index(
            "ix_comedor_codigos_externos_fecha",
            table_name,
            ["fecha_servicio"],
            unique=False,
        )


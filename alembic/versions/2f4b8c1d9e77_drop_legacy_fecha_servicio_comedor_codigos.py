"""drop legacy fecha_servicio en comedor_codigos_externos

Revision ID: 2f4b8c1d9e77
Revises: 1c9d7a2e4f11
Create Date: 2026-04-28 14:50:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = "2f4b8c1d9e77"
down_revision: Union[str, None] = "1c9d7a2e4f11"
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
    idx = _index_names(table_name)
    if "ix_comedor_codigos_externos_fecha" in idx:
        op.drop_index("ix_comedor_codigos_externos_fecha", table_name=table_name)

    cols = _column_names(table_name)
    if "fecha_servicio" in cols:
        op.drop_column(table_name, "fecha_servicio")


def downgrade() -> None:
    table_name = "comedor_codigos_externos"
    cols = _column_names(table_name)
    if "fecha_servicio" not in cols:
        op.add_column(
            table_name,
            sa.Column("fecha_servicio", sa.Date(), nullable=True),
        )
        op.execute(
            sa.text(
                """
                UPDATE comedor_codigos_externos
                SET fecha_servicio = COALESCE(fecha_inicio, fecha_fin, CURRENT_DATE)
                """
            )
        )
        op.alter_column(table_name, "fecha_servicio", existing_type=sa.Date(), nullable=False)
        op.create_index(
            "ix_comedor_codigos_externos_fecha",
            table_name,
            ["fecha_servicio"],
            unique=False,
        )


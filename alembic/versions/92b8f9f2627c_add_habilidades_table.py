"""add habilidades table

Revision ID: 92b8f9f2627c
Revises: 034fd01d2eae
Create Date: 2026-05-20 00:33:27.873744

Altera habilidades creada en 242b98b667ff. Depende de 034fd01d2eae para garantizar
que la tabla exista antes de modificar columnas (evita race con rama paralela).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from app.utils.migration_helpers import column_names, column_type, table_exists

revision: str = "92b8f9f2627c"
down_revision: Union[str, None] = "034fd01d2eae"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if not table_exists("habilidades"):
        return

    cols = column_names("habilidades")

    if "niveles_descripcion" not in cols:
        op.add_column(
            "habilidades",
            sa.Column(
                "niveles_descripcion",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=True,
            ),
        )

    tipo_kind = column_type("habilidades", "tipo")
    if tipo_kind == "ENUM":
        op.alter_column(
            "habilidades",
            "tipo",
            existing_type=postgresql.ENUM(
                "tecnica",
                "blanda",
                "operativa",
                "critica",
                name="tipo_habilidad_enum",
            ),
            type_=sa.String(length=30),
            existing_nullable=False,
            postgresql_using="tipo::text",
        )

    cols = column_names("habilidades")
    if "nivel_max" in cols:
        op.drop_column("habilidades", "nivel_max")


def downgrade() -> None:
    if not table_exists("habilidades"):
        return

    cols = column_names("habilidades")

    if "nivel_max" not in cols:
        op.add_column(
            "habilidades",
            sa.Column(
                "nivel_max",
                sa.INTEGER(),
                autoincrement=False,
                nullable=False,
                server_default=sa.text("4"),
            ),
        )

    tipo_kind = column_type("habilidades", "tipo")
    if tipo_kind == "VARCHAR":
        op.alter_column(
            "habilidades",
            "tipo",
            existing_type=sa.String(length=30),
            type_=postgresql.ENUM(
                "tecnica",
                "blanda",
                "operativa",
                "critica",
                name="tipo_habilidad_enum",
                create_type=False,
            ),
            existing_nullable=False,
            postgresql_using="tipo::tipo_habilidad_enum",
        )

    cols = column_names("habilidades")
    if "niveles_descripcion" in cols:
        op.drop_column("habilidades", "niveles_descripcion")

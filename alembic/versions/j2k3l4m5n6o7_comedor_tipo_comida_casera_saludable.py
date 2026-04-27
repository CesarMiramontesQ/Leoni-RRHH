"""PG: migrar comedor_tipo_comida_enum desayuno/comida/cena -> casera/saludable

Revision ID: j2k3l4m5n6o7
Revises: i1j2k3l4m5n6
Create Date: 2026-04-26

Solo PostgreSQL. Si el enum aun tiene valores viejos, se convierte a texto,
se normaliza a casera/saludable y se recrea el tipo.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects import postgresql

revision: str = "j2k3l4m5n6o7"
down_revision: Union[str, None] = "i1j2k3l4m5n6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_ENUM_NAME = "comedor_tipo_comida_enum"


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    row = bind.execute(
        text(
            """
            SELECT EXISTS (
              SELECT 1
              FROM pg_enum e
              JOIN pg_type t ON e.enumtypid = t.oid
              WHERE t.typname = :enum_name
                AND e.enumlabel IN ('desayuno', 'comida', 'cena')
            )
            """
        ),
        {"enum_name": _ENUM_NAME},
    ).scalar()
    if not row:
        return

    op.execute(text("ALTER TABLE comedor_accesos ALTER COLUMN tipo_comida DROP DEFAULT"))
    op.execute(
        text(
            """
            ALTER TABLE comedor_accesos
            ALTER COLUMN tipo_comida TYPE varchar(32)
            USING tipo_comida::text
            """
        )
    )
    op.execute(
        text(
            """
            UPDATE comedor_accesos
            SET tipo_comida = 'casera'
            WHERE tipo_comida IN ('desayuno', 'comida', 'cena')
            """
        )
    )
    op.execute(text(f"DROP TYPE {_ENUM_NAME}"))
    nuevo = postgresql.ENUM("casera", "saludable", name=_ENUM_NAME)
    nuevo.create(bind, checkfirst=True)
    col = postgresql.ENUM("casera", "saludable", name=_ENUM_NAME, create_type=False)
    op.alter_column(
        "comedor_accesos",
        "tipo_comida",
        existing_type=sa.VARCHAR(length=32),
        type_=col,
        postgresql_using="tipo_comida::text::" + _ENUM_NAME,
        nullable=False,
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute(text("ALTER TABLE comedor_accesos ALTER COLUMN tipo_comida DROP DEFAULT"))
    op.execute(
        text(
            """
            ALTER TABLE comedor_accesos
            ALTER COLUMN tipo_comida TYPE varchar(32)
            USING tipo_comida::text
            """
        )
    )
    op.execute(text(f"DROP TYPE {_ENUM_NAME}"))
    viejo = postgresql.ENUM("desayuno", "comida", "cena", name=_ENUM_NAME)
    viejo.create(bind, checkfirst=True)
    col = postgresql.ENUM("desayuno", "comida", "cena", name=_ENUM_NAME, create_type=False)
    using_down = (
        f"CASE tipo_comida::text WHEN 'saludable' THEN 'comida' ELSE 'comida' END::{_ENUM_NAME}"
    )
    op.alter_column(
        "comedor_accesos",
        "tipo_comida",
        existing_type=sa.VARCHAR(length=32),
        type_=col,
        postgresql_using=using_down,
        nullable=False,
    )

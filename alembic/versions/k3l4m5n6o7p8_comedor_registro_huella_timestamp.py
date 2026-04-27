"""comedor_registros: alinear columna con modelo (huella_timestamp).

El esquema inicial usaba `rfid_timestamp`. El ORM mapea `huella_timestamp`.
- Si existe `rfid_timestamp` y no `huella_timestamp`: RENAME.
- Si no hay ninguna: ADD `huella_timestamp` NULL.

Revision ID: k3l4m5n6o7p8
Revises: j2k3l4m5n6o7
Create Date: 2026-04-26
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "k3l4m5n6o7p8"
down_revision: Union[str, None] = "j2k3l4m5n6o7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute(
        text(
            """
            DO $body$
            BEGIN
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'comedor_registros'
                  AND column_name = 'rfid_timestamp'
              ) AND NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'comedor_registros'
                  AND column_name = 'huella_timestamp'
              ) THEN
                ALTER TABLE comedor_registros RENAME COLUMN rfid_timestamp TO huella_timestamp;
              ELSIF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'comedor_registros'
                  AND column_name = 'huella_timestamp'
              ) THEN
                ALTER TABLE comedor_registros
                  ADD COLUMN huella_timestamp TIMESTAMP WITH TIME ZONE NULL;
              END IF;
            END
            $body$;
            """
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute(
        text(
            """
            DO $body$
            BEGIN
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'comedor_registros'
                  AND column_name = 'huella_timestamp'
              ) AND NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'comedor_registros'
                  AND column_name = 'rfid_timestamp'
              ) THEN
                ALTER TABLE comedor_registros RENAME COLUMN huella_timestamp TO rfid_timestamp;
              END IF;
            END
            $body$;
            """
        )
    )

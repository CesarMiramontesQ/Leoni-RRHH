"""comedor_accesos: un solo acceso por empleado y fecha (sin duplicar por tipo).

Revision ID: m4n5o6p7q8r9
Revises: k3l4m5n6o7p8
Create Date: 2026-04-26
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text

revision: str = "m4n5o6p7q8r9"
down_revision: Union[str, None] = "k3l4m5n6o7p8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute(
        text(
            """
            DELETE FROM comedor_accesos a
            USING (
              SELECT empleado_id, fecha_servicio, MIN(id) AS keep_id
              FROM comedor_accesos
              GROUP BY empleado_id, fecha_servicio
              HAVING COUNT(*) > 1
            ) d
            WHERE a.empleado_id = d.empleado_id
              AND a.fecha_servicio = d.fecha_servicio
              AND a.id <> d.keep_id
            """
        )
    )

    op.execute(
        text("ALTER TABLE comedor_accesos DROP CONSTRAINT IF EXISTS uq_comedor_acceso_empleado_fecha_tipo")
    )
    op.execute(
        text(
            """
            DO $body$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'uq_comedor_acceso_empleado_fecha'
              ) THEN
                ALTER TABLE comedor_accesos
                ADD CONSTRAINT uq_comedor_acceso_empleado_fecha
                UNIQUE (empleado_id, fecha_servicio);
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
        text("ALTER TABLE comedor_accesos DROP CONSTRAINT IF EXISTS uq_comedor_acceso_empleado_fecha")
    )
    op.execute(
        text(
            """
            DO $body$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'uq_comedor_acceso_empleado_fecha_tipo'
              ) THEN
                ALTER TABLE comedor_accesos
                ADD CONSTRAINT uq_comedor_acceso_empleado_fecha_tipo
                UNIQUE (empleado_id, fecha_servicio, tipo_comida);
              END IF;
            END
            $body$;
            """
        )
    )

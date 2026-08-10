"""levelup_turnos_uso — caché del personal activo por turno

Guarda cuántos colaboradores activos tiene cada turno según ``dbo.COLABORA`` de TRESS,
para que Ajustes Comedor pueda listar solo los turnos en uso (25 de los 76 del catálogo)
sin consultar esa BD externa en cada carga de página.

Sin FK a ``levelup_turnos`` a propósito: TRESS puede tener un turno que la réplica del
catálogo todavía no incluya, y una FK haría fallar el sync entero en ese caso.

Revision ID: e1t2u3r4u5s6
Revises: d1a2j2u3s4t5
Create Date: 2026-08-10

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.utils.migration_helpers import table_exists

revision: str = "e1t2u3r4u5s6"
down_revision: Union[str, None] = "d1a2j2u3s4t5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if table_exists("levelup_turnos_uso"):
        return

    op.create_table(
        "levelup_turnos_uso",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("tu_codigo", sa.String(6), nullable=False),
        sa.Column("empleados_activos", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "actualizado_en",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id", name="pk_levelup_turnos_uso"),
        # Garantía anti-duplicados del upsert: una fila por turno.
        sa.UniqueConstraint("tu_codigo", name="uq_levelup_turnos_uso_tu_codigo"),
    )


def downgrade() -> None:
    if not table_exists("levelup_turnos_uso"):
        return
    op.drop_table("levelup_turnos_uso")

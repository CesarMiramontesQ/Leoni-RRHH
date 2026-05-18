"""agrega tipos de solicitud con goce de sueldo

Revision ID: p9q8r7s6t5u4
Revises: z9y8x7w6v5u4
Create Date: 2026-05-07
"""

from typing import Sequence, Union

from alembic import op

revision: str = "p9q8r7s6t5u4"
down_revision: Union[str, None] = "z9y8x7w6v5u4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE solicitud_tipo_enum ADD VALUE IF NOT EXISTS 'matrimonio'")
    op.execute("ALTER TYPE solicitud_tipo_enum ADD VALUE IF NOT EXISTS 'incapacidad_interna'")
    op.execute("ALTER TYPE solicitud_tipo_enum ADD VALUE IF NOT EXISTS 'defuncion'")
    op.execute("ALTER TYPE solicitud_tipo_enum ADD VALUE IF NOT EXISTS 'paternidad'")


def downgrade() -> None:
    # PostgreSQL no soporta eliminar valores de enum de forma portable sin recrear tipo.
    pass

"""solicitud permiso sin goce y motivo

Revision ID: q1w2e3r4t5y6
Revises: p9q8r7s6t5u4
Create Date: 2026-05-07
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "q1w2e3r4t5y6"
down_revision: Union[str, None] = "p9q8r7s6t5u4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE solicitud_tipo_enum ADD VALUE IF NOT EXISTS 'permiso_sin_goce_sueldo'")
    op.add_column("solicitudes", sa.Column("motivo", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("solicitudes", "motivo")
    # PostgreSQL no soporta eliminar valores de enum sin recrear el tipo.
    pass

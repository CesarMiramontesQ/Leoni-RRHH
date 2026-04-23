"""solicitud estado changes_requested y accion request_changes

Revision ID: g3h4i5j6k7l8
Revises: b8f5c2a91d4e
Create Date: 2026-04-22

PostgreSQL: extiende enums existentes (sin recrear tablas).
"""

from typing import Sequence, Union

from alembic import op

revision: str = "g3h4i5j6k7l8"
down_revision: Union[str, None] = "b8f5c2a91d4e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Requiere PostgreSQL. En desarrollo con SQLite los tests usan `Base.metadata.create_all` desde modelos.
    op.execute("ALTER TYPE solicitud_estado_enum ADD VALUE 'changes_requested'")
    op.execute("ALTER TYPE aprobacion_accion_enum ADD VALUE 'request_changes'")


def downgrade() -> None:
    # Los valores de enum en PostgreSQL no se eliminan de forma portable sin recrear el tipo.
    pass

"""empleados usuario unique lower partial index

Revision ID: f2b3c4d5e6a7
Revises: e1a2b3c4d5e6
Create Date: 2026-04-01

Garantiza a lo sumo un empleado por valor de usuario (case-insensitive).
Si existen filas con el mismo lower(usuario), la migración fallará hasta corregir datos.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "f2b3c4d5e6a7"
down_revision: Union[str, None] = "e1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE UNIQUE INDEX ix_empleados_usuario_lower
        ON empleados (lower(usuario))
        WHERE usuario IS NOT NULL
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_empleados_usuario_lower")

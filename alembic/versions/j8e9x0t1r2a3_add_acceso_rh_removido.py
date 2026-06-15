"""empleados — agregar acceso_rh_removido (baja de usuarios RH en permisos)

Marca que un usuario con rol RH fue quitado de la administración de permisos
(sin cambiar su rol): queda oculto de la lista y sin acceso a módulos RH.

Revision ID: j8e9x0t1r2a3
Revises: i7e8x9t0r1a2
Create Date: 2026-06-15
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "j8e9x0t1r2a3"
down_revision: Union[str, None] = "i7e8x9t0r1a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "empleados",
        sa.Column(
            "acceso_rh_removido",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("empleados", "acceso_rh_removido")

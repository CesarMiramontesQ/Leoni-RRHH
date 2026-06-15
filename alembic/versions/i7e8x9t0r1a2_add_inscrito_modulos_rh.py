"""empleados — agregar inscrito_modulos_rh (inscripción de no-RH en permisos por módulo)

Merge de los heads actuales (cc02_cursos_fk_swap, h6e7x8t9r0a1) y alta de la
columna que marca a usuarios de otros roles inscritos por RH en el sistema de
accesos por módulo, sin alterar su rol.

Revision ID: i7e8x9t0r1a2
Revises: cc02_cursos_fk_swap, h6e7x8t9r0a1
Create Date: 2026-06-15
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "i7e8x9t0r1a2"
down_revision: Union[str, Sequence[str], None] = ("cc02_cursos_fk_swap", "h6e7x8t9r0a1")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "empleados",
        sa.Column(
            "inscrito_modulos_rh",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("empleados", "inscrito_modulos_rh")

"""mover proveedor de curso a sesion

Revision ID: s1p2r3o4v5s6
Revises: m7e8r9g0e1h2
Create Date: 2026-07-09

El proveedor deja de ser atributo del curso y pasa a la sesión: un mismo
curso puede impartirse por distintos proveedores según la sesión.

- Agrega levelup_curso_sesion.proveedor_id (FK a levelup_curso_proveedor).
- Backfill: copia el proveedor del curso a sus sesiones existentes.
- Elimina levelup_cursos.proveedor_id.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "s1p2r3o4v5s6"
down_revision: Union[str, None] = "m7e8r9g0e1h2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "levelup_curso_sesion",
        sa.Column("proveedor_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_levelup_curso_sesion_proveedor_id",
        "levelup_curso_sesion",
        "levelup_curso_proveedor",
        ["proveedor_id"],
        ["id"],
    )
    # Backfill: heredar el proveedor del curso en las sesiones existentes.
    op.execute(
        """
        UPDATE levelup_curso_sesion s
        SET proveedor_id = c.proveedor_id
        FROM levelup_cursos c
        WHERE s.curso_id = c.id
          AND c.proveedor_id IS NOT NULL
          AND s.proveedor_id IS NULL
        """
    )
    op.drop_column("levelup_cursos", "proveedor_id")


def downgrade() -> None:
    op.add_column(
        "levelup_cursos",
        sa.Column("proveedor_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "levelup_cursos_proveedor_id_fkey",
        "levelup_cursos",
        "levelup_curso_proveedor",
        ["proveedor_id"],
        ["id"],
    )
    op.drop_constraint(
        "fk_levelup_curso_sesion_proveedor_id",
        "levelup_curso_sesion",
        type_="foreignkey",
    )
    op.drop_column("levelup_curso_sesion", "proveedor_id")

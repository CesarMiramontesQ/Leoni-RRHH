"""merge menu semanal detalle (main) y prod email/nivel tarea

Revision ID: n3o4p5q6r7s8
Revises: a0b1c2d3e4f5, m1n2o3p4q5r6
Create Date: 2026-06-03

Une las ramas abiertas tras integrar main en release de producción:
- a0b1c2d3e4f5: merge nivel tarea + empleados email (prod)
- m1n2o3p4q5r6: columna detalle JSONB en menu_semanal (main)
"""

from typing import Sequence, Union

from alembic import op

revision: str = "n3o4p5q6r7s8"
down_revision: Union[str, tuple[str, ...], None] = (
    "a0b1c2d3e4f5",
    "m1n2o3p4q5r6",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

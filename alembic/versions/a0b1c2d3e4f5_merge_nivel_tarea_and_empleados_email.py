"""merge nivel tarea (main) y empleados email (prod)

Revision ID: a0b1c2d3e4f5
Revises: f20804120d66, q2r3s4t5u6v7
Create Date: 2026-06-01

Une las ramas abiertas tras integrar main en producción:
- f20804120d66: columna nivel en perfil_funciones_tarea
- q2r3s4t5u6v7: email en empleados desde bono
"""

from typing import Sequence, Union

from alembic import op

revision: str = "a0b1c2d3e4f5"
down_revision: Union[str, tuple[str, ...], None] = (
    "f20804120d66",
    "q2r3s4t5u6v7",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

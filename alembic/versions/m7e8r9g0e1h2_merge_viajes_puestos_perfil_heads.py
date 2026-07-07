"""merge viajes laborales y puestos perfil tipo admin

Revision ID: m7e8r9g0e1h2
Revises: v1l2a3b4o5r6, v3p4u5e6s7t8
Create Date: 2026-07-07

Une las ramas abiertas tras integraciones paralelas:
- v1l2a3b4o5r6: modulo viajes laborales (grados puesto stub)
- v3p4u5e6s7t8: default administrativo en puestos_perfil (tareas catalogo)
"""

from typing import Sequence, Union

from alembic import op

revision: str = "m7e8r9g0e1h2"
down_revision: Union[str, tuple[str, ...], None] = (
    "v1l2a3b4o5r6",
    "v3p4u5e6s7t8",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

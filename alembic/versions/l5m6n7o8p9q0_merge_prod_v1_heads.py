"""merge prod v1 heads (level up, habilidades, bono histórico, comedor repetido)

Revision ID: l5m6n7o8p9q0
Revises: 034fd01d2eae, 92b8f9f2627c, i2j3k4l5m6n7, d0e1f2a3b4c5
Create Date: 2026-05-26

Une las ramas abiertas para permitir `alembic upgrade head` en producción.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "l5m6n7o8p9q0"
down_revision: Union[str, tuple[str, ...], None] = (
    "034fd01d2eae",
    "92b8f9f2627c",
    "i2j3k4l5m6n7",
    "d0e1f2a3b4c5",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

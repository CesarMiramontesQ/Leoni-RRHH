"""merge prod v1.0 head (n3) con prod-v2.0 head (k9)

Revision ID: p2q3r4s5t6u7
Revises: n3o4p5q6r7s8, k9f0y1u2s3b4
Create Date: 2026-06-17

Une el historial de producción v1.0 (servidor en n3) con la cadena main/prod-v2.0.
En servidores que vienen de prod v1.0, prod-migrate.sh hace stamp a f36fc5feb45e
(equivalente de schema) antes de upgrade head; al final stamp head alcanza esta revisión.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "p2q3r4s5t6u7"
down_revision: Union[str, tuple[str, ...], None] = (
    "n3o4p5q6r7s8",
    "k9f0y1u2s3b4",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

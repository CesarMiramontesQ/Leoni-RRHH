"""bono_historico_fuente_empleados

Revision ID: i2j3k4l5m6n7
Revises: h1i2j3k4l5m6
Create Date: 2026-05-26

"""

from typing import Sequence, Union

from alembic import op

revision: str = "i2j3k4l5m6n7"
down_revision: Union[str, None] = "h1i2j3k4l5m6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TYPE bono_historico_fuente_enum ADD VALUE IF NOT EXISTS 'empleados'"
    )


def downgrade() -> None:
    # PostgreSQL no permite quitar valores de enum de forma segura sin recrear el tipo.
    pass

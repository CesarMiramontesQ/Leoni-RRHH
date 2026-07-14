"""ausencias_fi_re_fuente_enum

Revision ID: a1u2s3e4n5c6
Revises: g2r3a4d5o6s7
Create Date: 2026-07-14

Agrega fuentes de sync diario dbo.AUSENCIA (FI/RE) → importadas_historico
al enum de levelup_bono_historico_import_log.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "a1u2s3e4n5c6"
down_revision: Union[str, None] = "g2r3a4d5o6s7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TYPE bono_historico_fuente_enum ADD VALUE IF NOT EXISTS 'ausencias_fi'"
    )
    op.execute(
        "ALTER TYPE bono_historico_fuente_enum ADD VALUE IF NOT EXISTS 'ausencias_re'"
    )


def downgrade() -> None:
    # PostgreSQL no permite quitar valores de enum de forma segura sin recrear el tipo.
    pass

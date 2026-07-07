"""puestos_perfil tipo default administrativo

Revision ID: v3p4u5e6s7t8
Revises: u2p3u4e5s6t7
Create Date: 2026-07-07

"""

from typing import Sequence, Union

from alembic import op

revision: str = "v3p4u5e6s7t8"
down_revision: Union[str, None] = "u2p3u4e5s6t7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE levelup_puestos_perfil
        SET tipo = 'administrativo'
        """
    )
    op.execute(
        """
        ALTER TABLE levelup_puestos_perfil
        ALTER COLUMN tipo SET DEFAULT 'administrativo'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE levelup_puestos_perfil
        ALTER COLUMN tipo SET DEFAULT 'operativo'
        """
    )

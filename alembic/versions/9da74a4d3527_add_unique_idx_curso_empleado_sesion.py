"""add_unique_idx_curso_empleado_sesion

Revision ID: 9da74a4d3527
Revises: e12d9114fab6
Create Date: 2026-06-05 06:39:54.040351

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9da74a4d3527'
down_revision: Union[str, None] = 'e12d9114fab6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "uq_curso_empleado_sesion",
        "curso_empleado",
        ["curso_id", "empleado_id", "sesion_id"],
        unique=True,
        postgresql_where=sa.text("sesion_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_curso_empleado_sesion", table_name="curso_empleado")

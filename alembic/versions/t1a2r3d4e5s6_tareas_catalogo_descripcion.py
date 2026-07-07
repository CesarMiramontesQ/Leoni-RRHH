"""tareas catalogo descripcion

Revision ID: t1a2r3d4e5s6
Revises: p1r2o3v4e5x6
Create Date: 2026-07-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "t1a2r3d4e5s6"
down_revision: Union[str, None] = "p1r2o3v4e5x6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "levelup_tareas_catalogo",
        sa.Column("descripcion", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("levelup_tareas_catalogo", "descripcion")

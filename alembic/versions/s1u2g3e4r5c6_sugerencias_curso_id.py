"""sugerencias: curso_id opcional en levelup_sugerencias_capacitacion

Revision ID: s1u2g3e4r5c6
Revises: h1s2t3s4e5n6
Create Date: 2026-07-23
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "s1u2g3e4r5c6"
down_revision: Union[str, None] = "h1s2t3s4e5n6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE = "levelup_sugerencias_capacitacion"


def upgrade() -> None:
    op.add_column(TABLE, sa.Column("curso_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_levelup_sugerencia_curso",
        TABLE, "levelup_cursos",
        ["curso_id"], ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_levelup_sugerencia_curso", TABLE, type_="foreignkey")
    op.drop_column(TABLE, "curso_id")

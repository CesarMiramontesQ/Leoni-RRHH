"""menu_semanal: columna detalle JSONB para complementos del día

Revision ID: m1n2o3p4q5r6
Revises: f20804120d66
Create Date: 2026-06-02
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from app.utils.migration_helpers import column_names

revision: str = "m1n2o3p4q5r6"
down_revision: Union[str, None] = "f20804120d66"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if "detalle" not in column_names("menu_semanal"):
        op.add_column(
            "menu_semanal",
            sa.Column("detalle", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        )


def downgrade() -> None:
    if "detalle" in column_names("menu_semanal"):
        op.drop_column("menu_semanal", "detalle")

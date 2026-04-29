"""empleados fecha_fin_contrato

Revision ID: n7o8p9q0r1s2
Revises: b4c7d2e1f0a3
Create Date: 2026-04-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "n7o8p9q0r1s2"
down_revision: Union[str, None] = "b4c7d2e1f0a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "empleados",
        sa.Column("fecha_fin_contrato", sa.Date(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("empleados", "fecha_fin_contrato")

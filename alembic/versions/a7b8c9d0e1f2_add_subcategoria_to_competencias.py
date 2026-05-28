"""add subcategoria to competencias

Revision ID: a7b8c9d0e1f2
Revises: 6e1c0bf591c7
Create Date: 2026-05-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.utils.migration_helpers import column_names, table_exists


# revision identifiers, used by Alembic.
revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, None] = '6e1c0bf591c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if not table_exists("competencias"):
        return
    if "subcategoria" not in column_names("competencias"):
        op.add_column("competencias", sa.Column("subcategoria", sa.String(50), nullable=True))


def downgrade() -> None:
    if not table_exists("competencias"):
        return
    if "subcategoria" in column_names("competencias"):
        op.drop_column("competencias", "subcategoria")

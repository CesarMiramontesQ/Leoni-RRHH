"""add competencia_id to perfil_competencias_requeridas

Revision ID: 6e1c0bf591c7
Revises: c5d968704019
Create Date: 2026-05-25 19:37:11.294674

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.utils.migration_helpers import column_names, foreign_key_names, table_exists

# revision identifiers, used by Alembic.
revision: str = '6e1c0bf591c7'
down_revision: Union[str, None] = 'c5d968704019'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if not table_exists("perfil_competencias_requeridas"):
        return
    cols = column_names("perfil_competencias_requeridas")
    if "competencia_id" not in cols:
        op.add_column(
            "perfil_competencias_requeridas",
            sa.Column("competencia_id", sa.Integer(), nullable=True),
        )
    if "fk_perfil_comp_req_competencia_id" not in foreign_key_names(
        "perfil_competencias_requeridas"
    ):
        op.create_foreign_key(
            "fk_perfil_comp_req_competencia_id",
            "perfil_competencias_requeridas",
            "competencias",
            ["competencia_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    if not table_exists("perfil_competencias_requeridas"):
        return
    if "fk_perfil_comp_req_competencia_id" in foreign_key_names(
        "perfil_competencias_requeridas"
    ):
        op.drop_constraint(
            "fk_perfil_comp_req_competencia_id",
            "perfil_competencias_requeridas",
            type_="foreignkey",
        )
    cols = column_names("perfil_competencias_requeridas")
    if "competencia_id" in cols:
        op.drop_column("perfil_competencias_requeridas", "competencia_id")

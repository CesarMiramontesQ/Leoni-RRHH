"""drop jsonb columns from puestos_perfil

Revision ID: a1b2c3d4e5f6
Revises: x1y2z3a4b5c6
Create Date: 2026-05-25 08:30:00.000000
"""

from alembic import op

from app.utils.migration_helpers import column_names, table_exists

revision = "a1b2c3d4e5f6"
down_revision = "x1y2z3a4b5c6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if not table_exists("puestos_perfil"):
        return
    cols = column_names("puestos_perfil")
    if "competencias_tecnicas" in cols:
        op.drop_column("puestos_perfil", "competencias_tecnicas")
    if "habilidades_blandas" in cols:
        op.drop_column("puestos_perfil", "habilidades_blandas")
    if "maquinas_herramientas" in cols:
        op.drop_column("puestos_perfil", "maquinas_herramientas")


def downgrade() -> None:
    from sqlalchemy import Column
    from sqlalchemy.dialects.postgresql import JSONB

    op.add_column("puestos_perfil", Column("competencias_tecnicas", JSONB, nullable=True))
    op.add_column("puestos_perfil", Column("habilidades_blandas", JSONB, nullable=True))
    op.add_column("puestos_perfil", Column("maquinas_herramientas", JSONB, nullable=True))

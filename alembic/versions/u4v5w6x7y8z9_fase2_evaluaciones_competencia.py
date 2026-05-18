"""fase2_evaluaciones_competencia

Revision ID: u4v5w6x7y8z9
Revises: t3u4v5w6x7y8
Create Date: 2026-05-05 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "u4v5w6x7y8z9"
down_revision: Union[str, None] = "t3u4v5w6x7y8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "evaluaciones_competencia",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("empleado_id", sa.Integer(), nullable=False),
        sa.Column("competencia_id", sa.Integer(), nullable=False),
        sa.Column("nivel_actual", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("evaluador_id", sa.Integer(), nullable=True),
        sa.Column("observaciones", sa.Text(), nullable=True),
        sa.Column(
            "fecha_evaluacion",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["empleado_id"], ["empleados.id"]),
        sa.ForeignKeyConstraint(
            ["competencia_id"], ["competencias.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["evaluador_id"], ["empleados.id"]),
        sa.CheckConstraint(
            "nivel_actual >= 0 AND nivel_actual <= 4", name="ck_nivel_actual_rango"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_evaluacion_vigente",
        "evaluaciones_competencia",
        ["empleado_id", "competencia_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_table("evaluaciones_competencia")

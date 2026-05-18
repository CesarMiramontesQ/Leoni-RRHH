"""incidencias keep only required columns

Revision ID: x8y7z6w5v4u3
Revises: v1w2x3y4z5a6
Create Date: 2026-05-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "x8y7z6w5v4u3"
down_revision: Union[str, None] = "v1w2x3y4z5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_incidencias_bono_source_key_unique")

    op.drop_column("incidencias", "descripcion")
    op.drop_column("incidencias", "estado")
    op.drop_column("incidencias", "registrado_por")
    op.drop_column("incidencias", "bono_source_key")
    op.drop_column("incidencias", "bono_tipo")
    op.drop_column("incidencias", "bono_categoria")
    op.drop_column("incidencias", "bono_detalle")
    op.drop_column("incidencias", "bono_fecha")
    op.drop_column("incidencias", "bono_semana_id")
    op.drop_column("incidencias", "bono_numero_semana")
    op.drop_column("incidencias", "bono_descuento_porcentaje")
    op.drop_column("incidencias", "bono_estatus_id")
    op.drop_column("incidencias", "bono_area")
    op.drop_column("incidencias", "bono_subarea")
    op.add_column(
        "incidencias",
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("incidencias", "updated_at")
    op.add_column("incidencias", sa.Column("bono_subarea", sa.String(length=255), nullable=True))
    op.add_column("incidencias", sa.Column("bono_area", sa.String(length=255), nullable=True))
    op.add_column("incidencias", sa.Column("bono_estatus_id", sa.Integer(), nullable=True))
    op.add_column("incidencias", sa.Column("bono_descuento_porcentaje", sa.Float(), nullable=True))
    op.add_column("incidencias", sa.Column("bono_numero_semana", sa.Integer(), nullable=True))
    op.add_column("incidencias", sa.Column("bono_semana_id", sa.Integer(), nullable=True))
    op.add_column("incidencias", sa.Column("bono_fecha", sa.Date(), nullable=True))
    op.add_column("incidencias", sa.Column("bono_detalle", sa.Text(), nullable=True))
    op.add_column("incidencias", sa.Column("bono_categoria", sa.String(length=255), nullable=True))
    op.add_column("incidencias", sa.Column("bono_tipo", sa.String(length=50), nullable=True))
    op.add_column("incidencias", sa.Column("bono_source_key", sa.String(length=100), nullable=True))
    op.add_column("incidencias", sa.Column("registrado_por", sa.Integer(), nullable=False))
    op.add_column(
        "incidencias",
        sa.Column(
            "estado",
            sa.Enum(
                "open",
                "in_review",
                "resolved",
                "closed",
                name="incidencia_estado_enum",
                create_type=False,
            ),
            nullable=False,
            server_default="open",
        ),
    )
    op.add_column("incidencias", sa.Column("descripcion", sa.Text(), nullable=False, server_default=""))
    op.create_foreign_key(None, "incidencias", "empleados", ["registrado_por"], ["id"])
    op.create_index(
        "ix_incidencias_bono_source_key_unique",
        "incidencias",
        ["bono_source_key"],
        unique=True,
    )

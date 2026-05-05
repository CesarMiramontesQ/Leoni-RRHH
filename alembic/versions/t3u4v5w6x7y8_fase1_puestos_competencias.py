"""fase1_puestos_competencias

Revision ID: t3u4v5w6x7y8
Revises: r1s2t3u4v5w6
Create Date: 2026-05-04 10:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "t3u4v5w6x7y8"
down_revision: Union[str, None] = "r1s2t3u4v5w6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Table: puestos_perfil ---
    op.create_table(
        "puestos_perfil",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("codigo", sa.String(length=20), nullable=False),
        sa.Column("nombre", sa.String(length=255), nullable=False),
        sa.Column("area_id", sa.Integer(), nullable=True),
        sa.Column("nivel", sa.String(length=50), nullable=True),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column(
            "competencias_tecnicas",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "habilidades_blandas",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "maquinas_herramientas",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("codigo", name="uq_puestos_perfil_codigo"),
        sa.ForeignKeyConstraint(["area_id"], ["areas.area_id"]),
        sa.ForeignKeyConstraint(["created_by"], ["empleados.id"]),
        sa.ForeignKeyConstraint(["updated_by"], ["empleados.id"]),
    )
    op.create_index(
        "ix_puestos_perfil_area_id", "puestos_perfil", ["area_id"], unique=False
    )
    op.create_index(
        "ix_puestos_perfil_nivel", "puestos_perfil", ["nivel"], unique=False
    )

    # --- Table: competencias ---
    op.create_table(
        "competencias",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nombre", sa.String(length=255), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("categoria", sa.String(length=20), nullable=False),
        sa.Column("area_id", sa.Integer(), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["area_id"], ["areas.area_id"]),
    )
    op.create_index(
        "ix_competencias_categoria", "competencias", ["categoria"], unique=False
    )
    op.create_index(
        "ix_competencias_area_id", "competencias", ["area_id"], unique=False
    )

    # --- Table: competencia_requisitos ---
    op.create_table(
        "competencia_requisitos",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("competencia_id", sa.Integer(), nullable=False),
        sa.Column("puesto_perfil_id", sa.Integer(), nullable=False),
        sa.Column(
            "nivel_requerido",
            sa.Integer(),
            nullable=False,
            server_default="0",
            comment="0=N/A, 1=Basico, 2=Intermedio, 3=Avanzado, 4=Experto",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["competencia_id"],
            ["competencias.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["puesto_perfil_id"],
            ["puestos_perfil.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "competencia_id",
            "puesto_perfil_id",
            name="uq_competencia_puesto_perfil",
        ),
        sa.CheckConstraint(
            "nivel_requerido >= 0 AND nivel_requerido <= 4",
            name="ck_nivel_requerido_rango",
        ),
    )
    op.create_index(
        "ix_competencia_requisitos_competencia_id",
        "competencia_requisitos",
        ["competencia_id"],
        unique=False,
    )
    op.create_index(
        "ix_competencia_requisitos_puesto_perfil_id",
        "competencia_requisitos",
        ["puesto_perfil_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_table("competencia_requisitos")
    op.drop_table("competencias")
    op.drop_table("puestos_perfil")

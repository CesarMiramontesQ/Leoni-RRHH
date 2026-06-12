"""grados puesto catalogo

Revision ID: d2e3f4g5h6i7
Revises: c1d2e3f4g5h6
Create Date: 2026-06-04

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d2e3f4g5h6i7"
down_revision: Union[str, Sequence[str], None] = "c1d2e3f4g5h6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

GRADOS_SEED = [
    ("Grado 1", 1),
    ("Grado 2", 2),
    ("Grado 3", 3),
    ("Grado 4", 4),
]


def upgrade() -> None:
    op.create_table(
        "grados_puesto",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.Column("orden", sa.Integer(), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
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
        sa.UniqueConstraint("nombre"),
        sa.UniqueConstraint("orden"),
    )

    grados_table = sa.table(
        "grados_puesto",
        sa.column("nombre", sa.String),
        sa.column("orden", sa.Integer),
        sa.column("activo", sa.Boolean),
    )
    op.bulk_insert(
        grados_table,
        [{"nombre": nombre, "orden": orden, "activo": True} for nombre, orden in GRADOS_SEED],
    )

    op.add_column(
        "competencia_requisitos",
        sa.Column("grado_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "perfil_funciones",
        sa.Column("grado_id", sa.Integer(), nullable=True),
    )

    op.execute(
        sa.text(
            "UPDATE competencia_requisitos SET grado_id = "
            "(SELECT id FROM grados_puesto WHERE orden = 1 LIMIT 1)"
        )
    )
    op.execute(
        sa.text(
            "UPDATE perfil_funciones SET grado_id = "
            "(SELECT id FROM grados_puesto WHERE orden = 1 LIMIT 1)"
        )
    )

    op.alter_column("competencia_requisitos", "grado_id", nullable=False)
    op.alter_column("perfil_funciones", "grado_id", nullable=False)

    op.create_foreign_key(
        "fk_competencia_requisitos_grado_id",
        "competencia_requisitos",
        "grados_puesto",
        ["grado_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_perfil_funciones_grado_id",
        "perfil_funciones",
        "grados_puesto",
        ["grado_id"],
        ["id"],
    )

    op.drop_constraint("uq_competencia_puesto_perfil", "competencia_requisitos", type_="unique")
    op.create_unique_constraint(
        "uq_competencia_puesto_grado",
        "competencia_requisitos",
        ["competencia_id", "puesto_perfil_id", "grado_id"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_competencia_puesto_grado", "competencia_requisitos", type_="unique")
    op.create_unique_constraint(
        "uq_competencia_puesto_perfil",
        "competencia_requisitos",
        ["competencia_id", "puesto_perfil_id"],
    )

    op.drop_constraint("fk_perfil_funciones_grado_id", "perfil_funciones", type_="foreignkey")
    op.drop_constraint(
        "fk_competencia_requisitos_grado_id", "competencia_requisitos", type_="foreignkey"
    )
    op.drop_column("perfil_funciones", "grado_id")
    op.drop_column("competencia_requisitos", "grado_id")
    op.drop_table("grados_puesto")

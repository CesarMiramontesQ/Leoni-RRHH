"""metodos calificacion competencia catalogo

Revision ID: e7f8g9h0i1j2
Revises: d2e3f4g5h6i7
Create Date: 2026-06-05

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e7f8g9h0i1j2"
down_revision: Union[str, Sequence[str], None] = "d2e3f4g5h6i7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

METODOS_SEED = [
    (1, "Planeado", 1),
    (2, "En entrenamiento", 2),
    (3, "Certificado", 3),
    (4, "Experto", 4),
]


def upgrade() -> None:
    op.create_table(
        "metodos_calificacion_competencia",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("valor", sa.Integer(), nullable=False),
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
        sa.CheckConstraint(
            "valor >= 1 AND valor <= 4",
            name="ck_metodo_calificacion_competencia_valor",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("orden"),
        sa.UniqueConstraint("valor"),
    )

    metodos_table = sa.table(
        "metodos_calificacion_competencia",
        sa.column("valor", sa.Integer),
        sa.column("nombre", sa.String),
        sa.column("orden", sa.Integer),
        sa.column("activo", sa.Boolean),
    )
    op.bulk_insert(
        metodos_table,
        [
            {"valor": valor, "nombre": nombre, "orden": orden, "activo": True}
            for valor, nombre, orden in METODOS_SEED
        ],
    )


def downgrade() -> None:
    op.drop_table("metodos_calificacion_competencia")

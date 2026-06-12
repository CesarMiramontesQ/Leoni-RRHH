"""grupos competencia catalogo

Revision ID: u6v7w8x9y0z1
Revises: t5u6v7w8x9y0
Create Date: 2026-06-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "u6v7w8x9y0z1"
down_revision: Union[str, Sequence[str], None] = "t5u6v7w8x9y0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SEED_GRUPOS = [
    ("Técnica", "tecnica"),
    ("Habilidad blanda", "blanda"),
]


def upgrade() -> None:
    op.create_table(
        "grupos_competencia",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.Column("categoria", sa.String(length=20), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
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
    )

    grupos_table = sa.table(
        "grupos_competencia",
        sa.column("nombre", sa.String),
        sa.column("categoria", sa.String),
        sa.column("activo", sa.Boolean),
    )
    op.bulk_insert(
        grupos_table,
        [{"nombre": n, "categoria": c, "activo": True} for n, c in SEED_GRUPOS],
    )

    op.add_column(
        "tipos_competencia",
        sa.Column("grupo_competencia_id", sa.Integer(), nullable=True),
    )

    conn = op.get_bind()

    def _grupo_id_for_categoria(categoria: str) -> int:
        row = conn.execute(
            sa.text(
                "SELECT id FROM grupos_competencia WHERE categoria = :c LIMIT 1"
            ),
            {"c": categoria},
        ).fetchone()
        assert row is not None, f"Grupo no encontrado para categoria {categoria}"
        return row[0]

    tipos = conn.execute(
        sa.text("SELECT id, grupo FROM tipos_competencia")
    ).fetchall()

    for tipo_id, grupo in tipos:
        gid = _grupo_id_for_categoria(str(grupo).strip())
        conn.execute(
            sa.text(
                "UPDATE tipos_competencia SET grupo_competencia_id = :gid WHERE id = :tid"
            ),
            {"gid": gid, "tid": tipo_id},
        )

    op.alter_column("tipos_competencia", "grupo_competencia_id", nullable=False)
    op.create_foreign_key(
        "fk_tipos_competencia_grupo_competencia_id",
        "tipos_competencia",
        "grupos_competencia",
        ["grupo_competencia_id"],
        ["id"],
    )
    op.create_index(
        "ix_tipos_competencia_grupo_competencia_id",
        "tipos_competencia",
        ["grupo_competencia_id"],
    )
    op.drop_column("tipos_competencia", "grupo")


def downgrade() -> None:
    op.add_column(
        "tipos_competencia",
        sa.Column("grupo", sa.String(length=20), nullable=True),
    )

    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            "SELECT t.id, g.categoria FROM tipos_competencia t "
            "JOIN grupos_competencia g ON t.grupo_competencia_id = g.id"
        )
    ).fetchall()
    for tipo_id, categoria in rows:
        conn.execute(
            sa.text("UPDATE tipos_competencia SET grupo = :g WHERE id = :id"),
            {"g": categoria, "id": tipo_id},
        )

    op.drop_index("ix_tipos_competencia_grupo_competencia_id", table_name="tipos_competencia")
    op.drop_constraint(
        "fk_tipos_competencia_grupo_competencia_id",
        "tipos_competencia",
        type_="foreignkey",
    )
    op.drop_column("tipos_competencia", "grupo_competencia_id")
    op.drop_table("grupos_competencia")

"""tipos competencia catalogo

Revision ID: t5u6v7w8x9y0
Revises: s4t5u6v7w8x9
Create Date: 2026-06-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "t5u6v7w8x9y0"
down_revision: Union[str, Sequence[str], None] = "s4t5u6v7w8x9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (codigo legacy subcategoria, nombre, grupo categoria)
SEED_TIPOS = [
    ("informatica", "Conocimientos de Informática", "tecnica"),
    ("idiomas", "Lenguas", "tecnica"),
    ("profesional", "Competencia profesional", "blanda"),
    ("social", "Competencia social", "blanda"),
    ("personal", "Competencias personales", "blanda"),
    ("metodos", "Competencias en métodos", "blanda"),
    ("complementos", "Complementos", "blanda"),
]


def upgrade() -> None:
    op.create_table(
        "tipos_competencia",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.Column("grupo", sa.String(length=20), nullable=False),
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

    tipos_table = sa.table(
        "tipos_competencia",
        sa.column("nombre", sa.String),
        sa.column("grupo", sa.String),
        sa.column("activo", sa.Boolean),
    )
    op.bulk_insert(
        tipos_table,
        [{"nombre": nombre, "grupo": grupo, "activo": True} for _, nombre, grupo in SEED_TIPOS],
    )

    op.add_column(
        "competencias",
        sa.Column("tipo_competencia_id", sa.Integer(), nullable=True),
    )

    conn = op.get_bind()

    def _codigo_to_id(codigo: str) -> int | None:
        mapping = {c: n for c, n, _ in SEED_TIPOS}
        nombre = mapping.get(codigo)
        if not nombre:
            return None
        row = conn.execute(
            sa.text("SELECT id FROM tipos_competencia WHERE nombre = :n"),
            {"n": nombre},
        ).fetchone()
        return row[0] if row else None

    default_tecnica = _codigo_to_id("informatica")
    default_blanda = _codigo_to_id("profesional")
    assert default_tecnica is not None and default_blanda is not None

    competencias = conn.execute(
        sa.text("SELECT id, categoria, subcategoria FROM competencias")
    ).fetchall()

    for comp_id, categoria, subcategoria in competencias:
        target_id = default_blanda if categoria == "blanda" else default_tecnica
        if subcategoria:
            mapped = _codigo_to_id(str(subcategoria).strip().lower())
            if mapped is not None:
                target_id = mapped
        conn.execute(
            sa.text(
                "UPDATE competencias SET tipo_competencia_id = :tid WHERE id = :cid"
            ),
            {"tid": target_id, "cid": comp_id},
        )

    op.alter_column("competencias", "tipo_competencia_id", nullable=False)
    op.create_foreign_key(
        "fk_competencias_tipo_competencia_id",
        "competencias",
        "tipos_competencia",
        ["tipo_competencia_id"],
        ["id"],
    )
    op.create_index(
        "ix_competencias_tipo_competencia_id",
        "competencias",
        ["tipo_competencia_id"],
    )
    op.drop_column("competencias", "subcategoria")


def downgrade() -> None:
    op.add_column(
        "competencias",
        sa.Column("subcategoria", sa.String(length=50), nullable=True),
    )

    conn = op.get_bind()
    codigo_by_nombre = {n: c for c, n, _ in SEED_TIPOS}

    rows = conn.execute(
        sa.text(
            "SELECT c.id, t.nombre FROM competencias c "
            "JOIN tipos_competencia t ON c.tipo_competencia_id = t.id"
        )
    ).fetchall()
    for comp_id, tipo_nombre in rows:
        sub = codigo_by_nombre.get(tipo_nombre)
        conn.execute(
            sa.text("UPDATE competencias SET subcategoria = :s WHERE id = :id"),
            {"s": sub, "id": comp_id},
        )

    op.drop_index("ix_competencias_tipo_competencia_id", table_name="competencias")
    op.drop_constraint(
        "fk_competencias_tipo_competencia_id", "competencias", type_="foreignkey"
    )
    op.drop_column("competencias", "tipo_competencia_id")
    op.drop_table("tipos_competencia")

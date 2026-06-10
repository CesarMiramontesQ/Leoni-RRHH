"""niveles puesto catalogo

Revision ID: s4t5u6v7w8x9
Revises: r3h4p5e6r7m8
Create Date: 2026-06-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "s4t5u6v7w8x9"
down_revision: Union[str, Sequence[str], None] = "r3h4p5e6r7m8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SEED_NIVELES = [
    "Operativo",
    "Mando Medio",
    "Gerencial",
    "Directivo",
]

SLUG_TO_NOMBRE = {
    "operativo": "Operativo",
    "mando_medio": "Mando Medio",
    "gerencial": "Gerencial",
    "directivo": "Directivo",
}


def upgrade() -> None:
    op.create_table(
        "niveles_puesto",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nombre", sa.String(length=100), nullable=False),
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

    niveles_table = sa.table(
        "niveles_puesto",
        sa.column("id", sa.Integer),
        sa.column("nombre", sa.String),
        sa.column("activo", sa.Boolean),
    )
    op.bulk_insert(
        niveles_table,
        [{"nombre": nombre, "activo": True} for nombre in SEED_NIVELES],
    )

    op.add_column(
        "puestos_perfil",
        sa.Column("nivel_id", sa.Integer(), nullable=True),
    )

    conn = op.get_bind()

    def _nombre_to_id(nombre: str) -> int | None:
        row = conn.execute(
            sa.text("SELECT id FROM niveles_puesto WHERE lower(nombre) = lower(:n)"),
            {"n": nombre},
        ).fetchone()
        return row[0] if row else None

    def _ensure_nivel(nombre: str) -> int:
        existing = _nombre_to_id(nombre)
        if existing is not None:
            return existing
        result = conn.execute(
            sa.text(
                "INSERT INTO niveles_puesto (nombre, activo) "
                "VALUES (:n, true) RETURNING id"
            ),
            {"n": nombre},
        )
        return result.scalar_one()

    default_id = _nombre_to_id("Operativo")
    assert default_id is not None

    perfiles = conn.execute(
        sa.text("SELECT id, nivel FROM puestos_perfil")
    ).fetchall()

    for perfil_id, nivel_val in perfiles:
        target_id = default_id
        if nivel_val:
            raw = str(nivel_val).strip()
            mapped = SLUG_TO_NOMBRE.get(raw.lower())
            if mapped:
                target_id = _nombre_to_id(mapped) or default_id
            else:
                target_id = _ensure_nivel(raw)
        conn.execute(
            sa.text("UPDATE puestos_perfil SET nivel_id = :nid WHERE id = :pid"),
            {"nid": target_id, "pid": perfil_id},
        )

    op.alter_column("puestos_perfil", "nivel_id", nullable=False)
    op.create_foreign_key(
        "fk_puestos_perfil_nivel_id",
        "puestos_perfil",
        "niveles_puesto",
        ["nivel_id"],
        ["id"],
    )
    op.create_index("ix_puestos_perfil_nivel_id", "puestos_perfil", ["nivel_id"])

    op.drop_index("ix_puestos_perfil_nivel", table_name="puestos_perfil")
    op.drop_column("puestos_perfil", "nivel")


def downgrade() -> None:
    op.add_column(
        "puestos_perfil",
        sa.Column("nivel", sa.String(length=50), nullable=True),
    )

    conn = op.get_bind()
    perfiles = conn.execute(
        sa.text(
            "SELECT pp.id, np.nombre FROM puestos_perfil pp "
            "JOIN niveles_puesto np ON pp.nivel_id = np.id"
        )
    ).fetchall()
    slug_map = {v.lower().replace(" ", "_"): v for v in SLUG_TO_NOMBRE.values()}
    for perfil_id, nombre in perfiles:
        slug = nombre.lower().replace(" ", "_")
        if nombre in SLUG_TO_NOMBRE.values():
            stored = slug if slug in SLUG_TO_NOMBRE else nombre
        else:
            stored = nombre
        conn.execute(
            sa.text("UPDATE puestos_perfil SET nivel = :n WHERE id = :pid"),
            {"n": stored, "pid": perfil_id},
        )

    op.create_index("ix_puestos_perfil_nivel", "puestos_perfil", ["nivel"])
    op.drop_index("ix_puestos_perfil_nivel_id", table_name="puestos_perfil")
    op.drop_constraint("fk_puestos_perfil_nivel_id", "puestos_perfil", type_="foreignkey")
    op.drop_column("puestos_perfil", "nivel_id")
    op.drop_table("niveles_puesto")

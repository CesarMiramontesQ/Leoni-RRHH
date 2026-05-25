"""migrar_jsonb_a_competencias_requeridas

Revision ID: x1y2z3a4b5c6
Revises: w6x7y8z9a0b1
Create Date: 2026-05-25 10:00:00.000000

Data migration: extrae datos de columnas JSONB (competencias_tecnicas,
habilidades_blandas, maquinas_herramientas) de puestos_perfil y los inserta
como filas en perfil_competencias_requeridas.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.utils.jsonb_migration import CATEGORY_MAP, extract_items


revision: str = "x1y2z3a4b5c6"
down_revision: Union[str, Sequence[str]] = "w6x7y8z9a0b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    rows = conn.execute(
        sa.text(
            "SELECT id, competencias_tecnicas, habilidades_blandas, maquinas_herramientas "
            "FROM puestos_perfil WHERE "
            "(competencias_tecnicas IS NOT NULL AND competencias_tecnicas::text != 'null' AND competencias_tecnicas::text != '{}' AND competencias_tecnicas::text != '[]') OR "
            "(habilidades_blandas IS NOT NULL AND habilidades_blandas::text != 'null' AND habilidades_blandas::text != '{}' AND habilidades_blandas::text != '[]') OR "
            "(maquinas_herramientas IS NOT NULL AND maquinas_herramientas::text != 'null' AND maquinas_herramientas::text != '{}' AND maquinas_herramientas::text != '[]')"
        )
    ).fetchall()

    for row in rows:
        puesto_id = row[0]
        for col_idx, col_name in enumerate(["competencias_tecnicas", "habilidades_blandas", "maquinas_herramientas"], start=1):
            raw = row[col_idx]
            if not raw:
                continue

            items = extract_items(raw)
            if not items:
                continue

            categoria = CATEGORY_MAP[col_name]

            existing = conn.execute(
                sa.text(
                    "SELECT COUNT(*) FROM perfil_competencias_requeridas "
                    "WHERE puesto_perfil_id = :pid AND categoria = :cat"
                ),
                {"pid": puesto_id, "cat": categoria},
            ).scalar()

            if existing and existing > 0:
                continue

            for orden, descripcion in enumerate(items, start=1):
                conn.execute(
                    sa.text(
                        "INSERT INTO perfil_competencias_requeridas "
                        "(puesto_perfil_id, categoria, descripcion, orden) "
                        "VALUES (:pid, :cat, :desc, :orden)"
                    ),
                    {
                        "pid": puesto_id,
                        "cat": categoria,
                        "desc": descripcion,
                        "orden": orden,
                    },
                )


def downgrade() -> None:
    conn = op.get_bind()

    for col_name, categoria in CATEGORY_MAP.items():
        rows = conn.execute(
            sa.text(
                "SELECT puesto_perfil_id, array_agg(descripcion ORDER BY orden) "
                "FROM perfil_competencias_requeridas "
                "WHERE categoria = :cat "
                "GROUP BY puesto_perfil_id"
            ),
            {"cat": categoria},
        ).fetchall()

        for row in rows:
            puesto_id = row[0]
            items = list(row[1]) if row[1] else []
            import json
            conn.execute(
                sa.text(
                    f"UPDATE puestos_perfil SET {col_name} = :val::jsonb WHERE id = :pid"
                ),
                {"val": json.dumps(items), "pid": puesto_id},
            )

    conn.execute(
        sa.text(
            "DELETE FROM perfil_competencias_requeridas "
            "WHERE categoria IN ('profesional', 'social', 'complementos')"
        )
    )



"""tabla turnos_empleados y carga inicial desde seed JSON

Revision ID: w4x5y6z7a8b9
Revises: q1w2e3r4t5y6, s2t3u4v5w6x7
Create Date: 2026-05-11
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "w4x5y6z7a8b9"
down_revision: Union[str, tuple[str, ...], None] = ("q1w2e3r4t5y6", "s2t3u4v5w6x7")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "turnos_empleados",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("no_empleado", sa.String(length=50), nullable=False),
        sa.Column("nombre", sa.String(length=255), nullable=False),
        sa.Column("clasificacion", sa.String(length=20), nullable=True),
        sa.Column("comedor", sa.Integer(), nullable=True),
        sa.Column("turno", sa.String(length=50), nullable=True),
        sa.ForeignKeyConstraint(
            ["no_empleado"],
            ["empleados.no_empleado"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("no_empleado", name="uq_turnos_empleados_no_empleado"),
    )

    seed_path = Path(__file__).resolve().parent.parent / "seed_data" / "turnos_empleados.json"
    rows = json.loads(seed_path.read_text(encoding="utf-8"))
    if not rows:
        return

    conn = op.get_bind()
    # TRESS/IT suelen guardar no_empleado como "123.0"; el Excel trae "123".
    stmt = sa.text(
        """
        INSERT INTO turnos_empleados (no_empleado, nombre, clasificacion, comedor, turno)
        SELECT e.no_empleado, :nombre, :clasificacion, :comedor, :turno
        FROM empleados e
        WHERE e.no_empleado = :no_empleado
           OR (
                e.no_empleado = :no_empleado || '.0'
                AND :no_empleado ~ '^[0-9]+$'
           )
        LIMIT 1
        """
    )
    for row in rows:
        conn.execute(stmt, row)


def downgrade() -> None:
    op.drop_table("turnos_empleados")

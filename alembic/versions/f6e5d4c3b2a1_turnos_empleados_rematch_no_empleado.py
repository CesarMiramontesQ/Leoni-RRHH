"""recarga turnos_empleados alineando no_empleado con variante TRESS (.0)

Revision ID: f6e5d4c3b2a1
Revises: w4x5y6z7a8b9
Create Date: 2026-05-11

Corrige carga vacía cuando empleados.no_empleado es "N.0" y el seed trae "N".
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f6e5d4c3b2a1"
down_revision: Union[str, None] = "w4x5y6z7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text("DELETE FROM turnos_empleados"))

    seed_path = Path(__file__).resolve().parent.parent / "seed_data" / "turnos_empleados.json"
    rows = json.loads(seed_path.read_text(encoding="utf-8"))
    if not rows:
        return

    conn = op.get_bind()
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
    op.execute(sa.text("DELETE FROM turnos_empleados"))

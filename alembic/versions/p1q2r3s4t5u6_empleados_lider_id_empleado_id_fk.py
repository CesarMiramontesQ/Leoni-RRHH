"""empleados lider_id referencia empleado_id

Revision ID: p1q2r3s4t5u6
Revises: e9f0a1b2c3d4
Create Date: 2026-05-29

"""
from typing import Sequence, Union

from alembic import op

revision: str = "p1q2r3s4t5u6"
down_revision: Union[str, None] = "e9f0a1b2c3d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("empleados_lider_id_fkey", "empleados", type_="foreignkey")
    op.execute(
        """
        UPDATE empleados AS e
        SET lider_id = l.empleado_id
        FROM empleados AS l
        WHERE e.lider_id IS NOT NULL
          AND e.lider_id = l.id
        """
    )
    op.execute(
        """
        UPDATE empleados AS e
        SET lider_id = NULL
        WHERE e.lider_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM empleados AS l WHERE l.empleado_id = e.lider_id
          )
        """
    )
    op.create_foreign_key(
        "empleados_lider_id_fkey",
        "empleados",
        "empleados",
        ["lider_id"],
        ["empleado_id"],
    )


def downgrade() -> None:
    op.drop_constraint("empleados_lider_id_fkey", "empleados", type_="foreignkey")
    op.execute(
        """
        UPDATE empleados AS e
        SET lider_id = l.id
        FROM empleados AS l
        WHERE e.lider_id IS NOT NULL
          AND e.lider_id = l.empleado_id
        """
    )
    op.execute(
        """
        UPDATE empleados AS e
        SET lider_id = NULL
        WHERE e.lider_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM empleados AS l WHERE l.id = e.lider_id
          )
        """
    )
    op.create_foreign_key(
        "empleados_lider_id_fkey",
        "empleados",
        "empleados",
        ["lider_id"],
        ["id"],
    )

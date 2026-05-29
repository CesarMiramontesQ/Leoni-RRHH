"""empleados email nullable desde bono

Revision ID: q2r3s4t5u6v7
Revises: p1q2r3s4t5u6
Create Date: 2026-05-29

Agrega columna email en empleados (idempotente) y copia correos existentes
desde la tabla emails hacia empleados.email antes de importar desde bono.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.utils.migration_helpers import column_names, constraint_names, table_exists

revision: str = "q2r3s4t5u6v7"
down_revision: Union[str, None] = "p1q2r3s4t5u6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    cols = column_names("empleados")
    if "email" not in cols:
        op.add_column(
            "empleados",
            sa.Column("email", sa.String(length=255), nullable=True),
        )

    unique_names = constraint_names("empleados")
    if "empleados_email_key" not in unique_names and "uq_empleados_email" not in unique_names:
        if not any("email" in name for name in unique_names):
            op.create_unique_constraint("uq_empleados_email", "empleados", ["email"])

    if table_exists("emails"):
        op.execute(
            sa.text(
                """
                UPDATE empleados AS e
                SET email = NULLIF(TRIM(e2.email), '')
                FROM emails AS e2
                WHERE (
                    e.no_empleado = e2.no_empleado
                    OR (
                        e.no_empleado ~ '^[0-9]+\\.0$'
                        AND REPLACE(e.no_empleado, '.0', '') = e2.no_empleado
                    )
                    OR (
                        e2.no_empleado ~ '^[0-9]+\\.0$'
                        AND e.no_empleado = REPLACE(e2.no_empleado, '.0', '')
                    )
                )
                  AND (e.email IS NULL OR TRIM(e.email) = '')
                  AND TRIM(e2.email) <> ''
                """
            )
        )


def downgrade() -> None:
    unique_names = constraint_names("empleados")
    if "uq_empleados_email" in unique_names:
        op.drop_constraint("uq_empleados_email", "empleados", type_="unique")
    cols = column_names("empleados")
    if "email" in cols:
        op.drop_column("empleados", "email")

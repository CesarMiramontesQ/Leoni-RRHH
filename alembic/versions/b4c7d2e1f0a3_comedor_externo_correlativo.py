"""tabla correlativo CEXT para personal externo

Revision ID: b4c7d2e1f0a3
Revises: a3e8f1c0d4b2
Create Date: 2026-04-28 18:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "b4c7d2e1f0a3"
down_revision: Union[str, None] = "a3e8f1c0d4b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "comedor_externo_correlativo",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("siguiente", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        sa.text(
            "INSERT INTO comedor_externo_correlativo (id, siguiente) VALUES (1, 0) "
            "ON CONFLICT (id) DO NOTHING"
        )
    )

    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect == "postgresql":
        op.execute(
            sa.text(
                """
                UPDATE comedor_externo_correlativo SET siguiente = GREATEST(
                  siguiente,
                  COALESCE((
                    SELECT MAX(CAST(SUBSTRING(no_empleado FROM 5) AS INTEGER))
                    FROM empleados WHERE no_empleado ~ '^CEXT[0-9]+$'
                  ), 0),
                  COALESCE((
                    SELECT MAX(CAST(SUBSTRING(codigo_acceso FROM 5) AS INTEGER))
                    FROM comedor_codigos_externos WHERE codigo_acceso ~ '^CEXT[0-9]+$'
                  ), 0)
                ) WHERE id = 1
                """
            )
        )
    else:
        op.execute(
            sa.text(
                """
                UPDATE comedor_externo_correlativo SET siguiente = MAX(
                  siguiente,
                  COALESCE((
                    SELECT MAX(CAST(SUBSTR(no_empleado, 5) AS INTEGER))
                    FROM empleados WHERE no_empleado GLOB 'CEXT[0-9]*'
                  ), 0),
                  COALESCE((
                    SELECT MAX(CAST(SUBSTR(codigo_acceso, 5) AS INTEGER))
                    FROM comedor_codigos_externos WHERE codigo_acceso GLOB 'CEXT[0-9]*'
                  ), 0)
                ) WHERE id = 1
                """
            )
        )


def downgrade() -> None:
    op.drop_table("comedor_externo_correlativo")

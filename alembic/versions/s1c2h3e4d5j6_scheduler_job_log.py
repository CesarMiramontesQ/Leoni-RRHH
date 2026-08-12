"""levelup_scheduler_job_log — historial de corridas de los jobs de APScheduler

Una fila por ejecución de job: inicio, fin, duración, resultado y las líneas de log que
ese job emitió. La escribe el envoltorio de `registrar_jobs_programados`; la lee la
página `#/ajustes/scheduler-logs`.

Revision ID: s1c2h3e4d5j6
Revises: g1e2m3p4t5r6
Create Date: 2026-08-11
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from app.utils.migration_helpers import table_exists

revision: str = "s1c2h3e4d5j6"
down_revision: Union[str, None] = "g1e2m3p4t5r6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if table_exists("levelup_scheduler_job_log"):
        return

    op.create_table(
        "levelup_scheduler_job_log",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("job_id", sa.String(length=64), nullable=False),
        sa.Column("inicio_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("fin_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duracion_ms", sa.Integer(), nullable=True),
        sa.Column(
            "resultado",
            sa.Enum(
                "en_curso",
                "ok",
                "advertencia",
                "error",
                name="scheduler_job_resultado_enum",
            ),
            nullable=False,
            server_default="en_curso",
        ),
        sa.Column("resumen", sa.Text(), nullable=True),
        sa.Column(
            "lineas",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "lineas_descartadas", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_levelup_scheduler_job_log_job_id",
        "levelup_scheduler_job_log",
        ["job_id"],
    )
    op.create_index(
        "ix_levelup_scheduler_job_log_job_inicio",
        "levelup_scheduler_job_log",
        ["job_id", "inicio_at"],
    )


def downgrade() -> None:
    if not table_exists("levelup_scheduler_job_log"):
        return
    op.drop_index(
        "ix_levelup_scheduler_job_log_job_inicio",
        table_name="levelup_scheduler_job_log",
    )
    op.drop_index(
        "ix_levelup_scheduler_job_log_job_id", table_name="levelup_scheduler_job_log"
    )
    op.drop_table("levelup_scheduler_job_log")
    sa.Enum(name="scheduler_job_resultado_enum").drop(op.get_bind(), checkfirst=True)

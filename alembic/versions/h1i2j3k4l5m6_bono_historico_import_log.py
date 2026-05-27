"""bono_historico_import_log

Revision ID: h1i2j3k4l5m6
Revises: g8b9c0d1e2f3
Create Date: 2026-05-26

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "h1i2j3k4l5m6"
down_revision: Union[str, None] = "g8b9c0d1e2f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_bono_fuente_values = (
    "calidad_historico",
    "seguridad_historico",
    "importadas_historico",
    "evaluacion_historica_gral",
)
_fuente_enum = postgresql.ENUM(*_bono_fuente_values, name="bono_historico_fuente_enum")
_origen_enum = postgresql.ENUM("scheduler", "manual", name="bono_historico_origen_enum")
_status_enum = postgresql.ENUM("ok", "skipped", "error", name="bono_historico_import_status_enum")


def upgrade() -> None:
    _fuente_enum.create(op.get_bind(), checkfirst=True)
    _origen_enum.create(op.get_bind(), checkfirst=True)
    _status_enum.create(op.get_bind(), checkfirst=True)

    fuente_type = postgresql.ENUM(
        *_bono_fuente_values, name="bono_historico_fuente_enum", create_type=False
    )
    origen_type = postgresql.ENUM(
        "scheduler", "manual", name="bono_historico_origen_enum", create_type=False
    )
    status_type = postgresql.ENUM(
        "ok", "skipped", "error", name="bono_historico_import_status_enum", create_type=False
    )

    op.create_table(
        "bono_historico_import_log",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("fuente", fuente_type, nullable=False),
        sa.Column("corrida_id", sa.String(length=36), nullable=True),
        sa.Column("origen_ejecucion", origen_type, nullable=False),
        sa.Column("status", status_type, nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("leidos", sa.Integer(), nullable=True),
        sa.Column("insertados", sa.Integer(), nullable=True),
        sa.Column("omitidos", sa.Integer(), nullable=True),
        sa.Column("errores", sa.Integer(), nullable=True),
        sa.Column("mensajes_error", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error_msg", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_bono_historico_import_log_fuente_started",
        "bono_historico_import_log",
        ["fuente", "started_at"],
    )
    op.create_index(
        op.f("ix_bono_historico_import_log_corrida_id"),
        "bono_historico_import_log",
        ["corrida_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_bono_historico_import_log_corrida_id"), table_name="bono_historico_import_log")
    op.drop_index("ix_bono_historico_import_log_fuente_started", table_name="bono_historico_import_log")
    op.drop_table("bono_historico_import_log")
    _status_enum.drop(op.get_bind(), checkfirst=True)
    _origen_enum.drop(op.get_bind(), checkfirst=True)
    _fuente_enum.drop(op.get_bind(), checkfirst=True)

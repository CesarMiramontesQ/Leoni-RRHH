"""tabla levelup_vistas_rol + configuración inicial por rol

Crea la tabla que persiste qué vistas puede consultar cada rol base
(`empleado`, `supervisor`, `gerente`) y la siembra con `defaults_por_rol()`,
que reproduce el acceso que esos roles ya tienen hoy — el despliegue no debe
cambiar lo que ve nadie.

El backfill importa las constantes de `app/core/vista_rol_registry.py` en vez de
duplicar la lista (mismo patrón que w1t2w3c4l5a6_clasificacion_puesto_wtw).

Revision ID: v1s2t3r4o5l6
Revises: v1a2r3g4g5m6
Create Date: 2026-08-03
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "v1s2t3r4o5l6"
down_revision: Union[str, None] = "v1a2r3g4g5m6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLA = "levelup_vistas_rol"


def _tabla_existe(bind) -> bool:
    return bool(
        bind.execute(
            sa.text("SELECT 1 FROM pg_class WHERE relname = :t AND relkind = 'r'"),
            {"t": TABLA},
        ).scalar()
    )


def upgrade() -> None:
    bind = op.get_bind()

    if not _tabla_existe(bind):
        op.create_table(
            TABLA,
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("rol_id", sa.Integer(), nullable=False),
            sa.Column("vista_key", sa.String(length=64), nullable=False),
            sa.Column(
                "habilitado", sa.Boolean(), server_default=sa.text("false"), nullable=False
            ),
            sa.Column("actualizado_por_empleado_id", sa.Integer(), nullable=True),
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
            sa.ForeignKeyConstraint(["rol_id"], ["levelup_roles.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(
                ["actualizado_por_empleado_id"],
                ["empleados.empleado_id"],
                ondelete="SET NULL",
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("rol_id", "vista_key", name="uq_levelup_vistas_rol_rol_vista"),
        )
        op.create_index("ix_levelup_vistas_rol_rol_id", TABLA, ["rol_id"])

    _sembrar_defaults(bind)


def _sembrar_defaults(bind) -> None:
    """Inserta las filas faltantes. Nunca sobrescribe una configuración existente."""
    from app.core.vista_rol_registry import defaults_por_rol

    defaults = defaults_por_rol()
    roles = bind.execute(
        sa.text("SELECT id, nombre FROM levelup_roles WHERE nombre = ANY(:nombres)"),
        {"nombres": list(defaults.keys())},
    ).all()
    if not roles:
        # BD sin roles todavía (p. ej. baseline recién creada): el seed de la
        # aplicación (`ensure_vistas_rol_defaults`) las creará al arrancar.
        return

    existentes = {
        (rol_id, key)
        for rol_id, key in bind.execute(
            sa.text(f"SELECT rol_id, vista_key FROM {TABLA}")  # noqa: S608 - nombre constante
        ).all()
    }

    filas = [
        {"rol_id": rol_id, "vista_key": vista_key, "habilitado": habilitado}
        for rol_id, rol_nombre in roles
        for vista_key, habilitado in defaults.get(rol_nombre, {}).items()
        if (rol_id, vista_key) not in existentes
    ]
    if filas:
        bind.execute(
            sa.text(
                f"INSERT INTO {TABLA} (rol_id, vista_key, habilitado) "  # noqa: S608
                "VALUES (:rol_id, :vista_key, :habilitado)"
            ),
            filas,
        )


def downgrade() -> None:
    op.drop_index("ix_levelup_vistas_rol_rol_id", table_name=TABLA)
    op.drop_table(TABLA)

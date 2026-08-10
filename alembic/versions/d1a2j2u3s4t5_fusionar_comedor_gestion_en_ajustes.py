"""Fusionar el módulo `comedor-gestion` dentro de `comedor-ajustes`

La pantalla «Comedores» se absorbió en «Ajustes Comedor» (una sola pantalla con
pestañas), así que el catálogo de módulos RH deja de tener `comedor-gestion` y
`comedor-ajustes` hereda sus rutas y sus prefijos de API.

Los catálogos viven en código, pero las **asignaciones** viven en BD. Sin esta
migración, quien hoy tiene `comedor-gestion` perdería en silencio el acceso a la
administración de comedores, a los códigos externos y a asignar comedor en turnos.
Por eso se renombra la clave donde esté guardada:

- ``levelup_empleados_config.modulos_rh`` (JSONB, una clave por módulo)
- ``levelup_vistas_rol.vista_key`` (una fila por par rol/vista)

Ambas son tablas propias del proyecto (`levelup_*`); no se toca nada de Bono.

El renombrado respeta lo que el usuario ya tenía: si alguien tenía **las dos** claves,
gana el `true` (no se degrada un acceso concedido). En `levelup_vistas_rol`, si ya
existe la fila destino para ese rol se conserva y solo se descarta la vieja, porque la
unique `(rol_id, vista_key)` no admite duplicados.

Revision ID: d1a2j2u3s4t5
Revises: c1o2m3h4o5r6
Create Date: 2026-08-10

"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

from app.utils.migration_helpers import table_exists

revision: str = "d1a2j2u3s4t5"
down_revision: Union[str, None] = "c1o2m3h4o5r6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

VIEJA = "comedor-gestion"
NUEVA = "comedor-ajustes"


def _mover_clave_modulos(origen: str, destino: str) -> None:
    """Renombra una clave dentro del JSONB `modulos_rh`, sin degradar un `true`."""
    op.execute(
        f"""
        UPDATE levelup_empleados_config
           SET modulos_rh = (modulos_rh - '{origen}') || jsonb_build_object(
                 '{destino}',
                 to_jsonb(
                     COALESCE((modulos_rh ->> '{origen}')::boolean, false)
                     OR COALESCE((modulos_rh ->> '{destino}')::boolean, false)
                 )
               )
         WHERE modulos_rh ? '{origen}'
        """
    )


def _mover_vista(origen: str, destino: str) -> None:
    """Renombra `vista_key`; si el par (rol, destino) ya existe, conserva el existente."""
    op.execute(
        f"""
        DELETE FROM levelup_vistas_rol v
         WHERE v.vista_key = '{origen}'
           AND EXISTS (
                 SELECT 1 FROM levelup_vistas_rol o
                  WHERE o.rol_id = v.rol_id AND o.vista_key = '{destino}'
               )
        """
    )
    op.execute(
        f"UPDATE levelup_vistas_rol SET vista_key = '{destino}' WHERE vista_key = '{origen}'"
    )


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    if table_exists("levelup_empleados_config"):
        _mover_clave_modulos(VIEJA, NUEVA)
    if table_exists("levelup_vistas_rol"):
        _mover_vista(VIEJA, NUEVA)


def downgrade() -> None:
    """Devuelve la clave a `comedor-gestion`.

    No puede distinguir a quien ya tenía `comedor-ajustes` de antes de la fusión: al
    revertir, todos vuelven con el permiso viejo. Es el comportamiento seguro (nadie se
    queda sin acceso) y coincide con el estado previo para el caso normal, en el que la
    pantalla de horarios acababa de nacer.
    """
    if op.get_bind().dialect.name != "postgresql":
        return
    if table_exists("levelup_empleados_config"):
        _mover_clave_modulos(NUEVA, VIEJA)
    if table_exists("levelup_vistas_rol"):
        _mover_vista(NUEVA, VIEJA)

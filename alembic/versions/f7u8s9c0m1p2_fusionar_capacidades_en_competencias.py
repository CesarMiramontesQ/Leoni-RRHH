"""fusionar_capacidades_en_competencias

Revision ID: f7u8s9c0m1p2
Revises: s1u2g3e4r5c6
Create Date: 2026-07-26 05:10:00.000000

Data migration sobre `levelup_empleados_config.modulos_rh` (tabla propia,
prefijo `levelup_`): el permiso `capacidades` (Matriz de multihabilidades) se
funde en `competencias`. Eran dos claves sobre el MISMO API
(`/api/v1/competencias/multihabilidades` es sub-recurso de
`/api/v1/competencias`) y sobre la misma tabla de datos.

Las dos PANTALLAS siguen existiendo (`#/capacidades` y `#/competencias`): lo
que se unifica es el permiso.

No toca esquema: solo reescribe el JSONB. El registro de módulos mantiene
`capacidades` como alias legacy, así que un token ya emitido o una fila que
esta migración no alcance siguen dando acceso en vez de un 403.
"""

import json
import logging
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.utils.modulos_rh_migracion import (
    fusionar_capacidades_en_competencias,
    revertir_fusion,
)

revision: str = "f7u8s9c0m1p2"
down_revision: Union[str, Sequence[str]] = "s1u2g3e4r5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

logger = logging.getLogger("alembic.runtime.migration")

TABLA = "levelup_empleados_config"


def _reescribir(transformar) -> None:
    conn = op.get_bind()
    filas = conn.execute(
        sa.text(f"SELECT empleado_id, modulos_rh FROM {TABLA} WHERE modulos_rh IS NOT NULL")
    ).fetchall()

    tocadas = 0
    ganan_acceso: list[int] = []
    for empleado_id, modulos in filas:
        if not isinstance(modulos, dict):
            continue
        nuevos, cambio = transformar(modulos)
        if not cambio:
            continue
        # Quien tenía la matriz sin el catálogo gana pantallas nuevas: se
        # registra por empleado para que quede en el log del despliegue.
        if modulos.get("capacidades") and not modulos.get("competencias"):
            ganan_acceso.append(empleado_id)
        conn.execute(
            sa.text(f"UPDATE {TABLA} SET modulos_rh = CAST(:m AS JSONB) WHERE empleado_id = :e"),
            {"m": json.dumps(nuevos, ensure_ascii=False), "e": empleado_id},
        )
        tocadas += 1

    logger.info("modulos_rh: %d fila(s) actualizada(s) de %d", tocadas, len(filas))
    if ganan_acceso:
        logger.warning(
            "modulos_rh: %d empleado(s) tenían 'capacidades' sin 'competencias' y ahora ven "
            "también el catálogo y las brechas: %s",
            len(ganan_acceso),
            ganan_acceso,
        )


def upgrade() -> None:
    _reescribir(fusionar_capacidades_en_competencias)


def downgrade() -> None:
    """Repone `capacidades` con el valor de `competencias`.

    No es un inverso exacto: la fusión pierde la distinción entre "solo la
    matriz" y "ambas". Reponer el valor combinado es lo que menos accesos
    rompe.
    """
    _reescribir(revertir_fusion)

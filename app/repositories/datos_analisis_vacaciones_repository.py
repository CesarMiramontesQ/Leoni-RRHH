"""
Repositorio de solo lectura sobre SQL Server datos-analisis (motor separado de la app).

Consulta los KPIs de vacaciones desde la función ``dbo.GET_SALDOS_VACACION(cb)`` (mucho
más rápida que la vista ``dbo.V_SALD_VAC``, que calcula para todos los empleados). La
consulta vive en ``sql/datos_analisis_kpis_vacaciones_ciclo.sql`` para facilitar ajustes
de esquema.

**Solo lo usa `sync_vacaciones_disponibles_service`**: ninguna carga de página pasa por
aquí, porque el saldo se lee de la caché `levelup_vacaciones_disponibles` en Bono.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

_SQL_KPIS_CICLO_FILE = (
    Path(__file__).resolve().parent / "sql" / "datos_analisis_kpis_vacaciones_ciclo.sql"
)


def load_kpis_ciclo_sql() -> str:
    return _SQL_KPIS_CICLO_FILE.read_text(encoding="utf-8")


@dataclass(frozen=True)
class KpisVacacionesCiclo:
    """Saldo total y ciclo (aniversario) vigente de un empleado en TRESS.

    ``aniversario`` es ``None`` cuando el empleado no tiene periodos registrados; en ese
    caso ``disponibles`` vale 0 y los demás campos quedan en ``None``.
    """

    disponibles: float
    aniversario: int | None
    derecho_ciclo: float | None
    tomados_ciclo: float | None
    vence: date | None


class DatosAnalisisVacacionesRepository:
    """Ejecuta los KPIs de vacaciones con parámetros enlazados (sin interpolación)."""

    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine

    async def get_kpis_ciclo(self, *, cb_codigo: int) -> KpisVacacionesCiclo:
        """Saldo total + derecho/tomados del aniversario vigente, en una sola consulta.

        Así las tarjetas «disponibles» y «tomadas» del dashboard salen del mismo cálculo
        de TRESS y no pueden contradecirse.
        """
        sql = load_kpis_ciclo_sql()
        async with self._engine.connect() as conn:
            result = await conn.execute(text(sql), {"cb_codigo": cb_codigo})
            row = result.mappings().first()

        if row is None:  # defensivo: el SQL siempre devuelve una fila
            return KpisVacacionesCiclo(
                disponibles=0.0,
                aniversario=None,
                derecho_ciclo=None,
                tomados_ciclo=None,
                vence=None,
            )

        def _num(valor) -> float | None:
            return float(valor) if valor is not None else None

        vence = row["vence"]
        return KpisVacacionesCiclo(
            disponibles=_num(row["saldo_total"]) or 0.0,
            aniversario=int(row["aniversario"]) if row["aniversario"] is not None else None,
            derecho_ciclo=_num(row["derecho_ciclo"]),
            tomados_ciclo=_num(row["tomados_ciclo"]),
            # La TVF devuelve datetime; el schema expone solo la fecha.
            vence=vence.date() if hasattr(vence, "date") else vence,
        )

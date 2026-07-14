"""
Repositorio de escritura de home office en SQL Server datos-analisis / TRESS.

Ejecuta el batch ``sql/datos_analisis_insertar_home_office.sql`` (transacción propia
con validaciones, INSERT PERMISO y bitácora).
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

from sqlalchemy.ext.asyncio import AsyncEngine

_SQL_FILE = Path(__file__).resolve().parent / "sql" / "datos_analisis_insertar_home_office.sql"
_USUARIO_RE = re.compile(r"^[0-9]{1,5}$")
logger = logging.getLogger(__name__)


def load_insertar_home_office_sql() -> str:
    return _SQL_FILE.read_text(encoding="utf-8")


@dataclass(frozen=True, slots=True)
class InsertarHomeOfficeResult:
    ok: bool
    codigo_error: str | None
    mensaje: str
    nueva_llave: int | None


def _render_insertar_home_office_sql(
    *,
    empleado: int,
    usuario: str,
    fecha_inicio: date,
    fecha_fin_mostrar: date,
    confirmar: bool,
) -> str:
    """Sustituye placeholders tipados. ODBC no admite binds en DECLARE @x = ?."""
    if not isinstance(empleado, int) or empleado <= 0:
        raise ValueError("empleado invalido")
    if not _USUARIO_RE.fullmatch(usuario):
        raise ValueError("usuario TRESS invalido")

    template = load_insertar_home_office_sql()
    replacements = {
        "{{empleado}}": str(empleado),
        "{{usuario}}": usuario,
        "{{fecha_inicio}}": fecha_inicio.isoformat(),
        "{{fecha_fin_mostrar}}": fecha_fin_mostrar.isoformat(),
        "{{confirmar}}": "1" if confirmar else "0",
    }
    sql = template
    for key, value in replacements.items():
        sql = sql.replace(key, value)
    if "{{" in sql:
        raise RuntimeError("quedaron placeholders sin sustituir en el SQL de home office")
    return sql


def _row_to_result(row: dict[str, Any]) -> InsertarHomeOfficeResult:
    ok_raw = row.get("ok")
    ok = bool(ok_raw) if ok_raw is not None else False
    codigo = row.get("codigo_error")
    mensaje = row.get("mensaje") or ""
    llave = row.get("nueva_llave")
    return InsertarHomeOfficeResult(
        ok=ok,
        codigo_error=str(codigo) if codigo else None,
        mensaje=str(mensaje),
        nueva_llave=int(llave) if llave is not None else None,
    )


def _normalize_colnames(description: Any) -> list[str]:
    if not description:
        return []
    return [str(col[0]).lower() for col in description]


async def _await_maybe(value: Any) -> Any:
    if hasattr(value, "__await__"):
        return await value
    return value


async def _drain_result_sets(cursor: Any) -> dict[str, Any] | None:
    """
    Consume todos los resultsets del batch (SPs pueden devolver filas intermedias).

    Devuelve la última fila cuyo resultset incluye la columna ``ok`` (contrato del script).
    """
    last_ok_row: dict[str, Any] | None = None
    while True:
        cols = _normalize_colnames(cursor.description)
        if cols:
            rows = await _await_maybe(cursor.fetchall())
            if rows and "ok" in cols:
                raw = rows[-1]
                last_ok_row = {
                    cols[i]: raw[i] for i in range(min(len(cols), len(raw)))
                }
        has_more = await _await_maybe(cursor.nextset())
        if not has_more:
            break
    return last_ok_row


class DatosAnalisisHomeOfficeWriteRepository:
    """Ejecuta el batch de inserción de home office en TRESS."""

    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine

    async def insertar_home_office(
        self,
        *,
        empleado: int,
        usuario: str,
        fecha_inicio: date,
        fecha_fin_mostrar: date,
        confirmar: bool,
    ) -> InsertarHomeOfficeResult:
        sql = _render_insertar_home_office_sql(
            empleado=empleado,
            usuario=usuario,
            fecha_inicio=fecha_inicio,
            fecha_fin_mostrar=fecha_fin_mostrar,
            confirmar=confirmar,
        )
        async with self._engine.connect() as conn:
            raw = await conn.get_raw_connection()
            dbapi = getattr(raw, "driver_connection", None) or getattr(
                raw, "dbapi_connection", None
            )
            if dbapi is None:
                raise RuntimeError("No se pudo obtener la conexion ODBC cruda (aioodbc).")

            try:
                underlying = getattr(dbapi, "_conn", dbapi)
                if hasattr(underlying, "autocommit"):
                    underlying.autocommit = True
            except Exception as exc:  # noqa: BLE001 — best-effort
                logger.debug("No se pudo forzar autocommit ODBC: %s", exc)

            cursor = await dbapi.cursor()
            try:
                await cursor.execute(sql)
                row = await _drain_result_sets(cursor)
            finally:
                await cursor.close()

        if row is None:
            return InsertarHomeOfficeResult(
                ok=False,
                codigo_error="SIN_RESULTADO",
                mensaje="TRESS no devolvio resultado al registrar home office.",
                nueva_llave=None,
            )
        return _row_to_result(row)

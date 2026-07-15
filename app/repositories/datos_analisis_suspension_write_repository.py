"""
Repositorio de escritura de suspension en SQL Server datos-analisis / TRESS.

Ejecuta el batch ``sql/datos_analisis_insertar_suspension.sql`` (transaccion propia
con validaciones, INSERT PERMISO, bitacora y SP_STATUS_INCIDENCIA).
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

from sqlalchemy.ext.asyncio import AsyncEngine

_SQL_FILE = Path(__file__).resolve().parent / "sql" / "datos_analisis_insertar_suspension.sql"
_USUARIO_RE = re.compile(r"^[0-9]{1,5}$")
_COMENTARIO_RE = re.compile(r"^[\w\s.,;:'/\-#%()+=@!?]*$", re.UNICODE)
logger = logging.getLogger(__name__)


def load_insertar_suspension_sql() -> str:
    return _SQL_FILE.read_text(encoding="utf-8")


@dataclass(frozen=True, slots=True)
class InsertarSuspensionResult:
    ok: bool
    codigo_error: str | None
    mensaje: str
    nueva_llave: int | None


def _escape_sql_varchar(value: str) -> str:
    """Escapa comilla simple para literales T-SQL (duplicar ')."""
    return value.replace("'", "''")


def _render_insertar_suspension_sql(
    *,
    empleado: int,
    usuario: str,
    fecha_inicio: date,
    fecha_fin_mostrar: date,
    comentario: str,
    confirmar: bool,
) -> str:
    """Sustituye placeholders tipados. ODBC no admite binds en DECLARE @x = ?."""
    if not isinstance(empleado, int) or empleado <= 0:
        raise ValueError("empleado invalido")
    if not _USUARIO_RE.fullmatch(usuario):
        raise ValueError("usuario TRESS invalido")
    if not isinstance(comentario, str):
        raise ValueError("comentario invalido")
    comentario_norm = comentario.strip()
    if not comentario_norm:
        raise ValueError("comentario vacío")
    if len(comentario_norm) > 30:
        raise ValueError("comentario excede 30 caracteres")
    if not _COMENTARIO_RE.fullmatch(comentario_norm):
        raise ValueError("comentario contiene caracteres no permitidos")

    template = load_insertar_suspension_sql()
    replacements = {
        "{{empleado}}": str(empleado),
        "{{usuario}}": usuario,
        "{{fecha_inicio}}": fecha_inicio.isoformat(),
        "{{fecha_fin_mostrar}}": fecha_fin_mostrar.isoformat(),
        "{{comentario}}": _escape_sql_varchar(comentario_norm),
        "{{confirmar}}": "1" if confirmar else "0",
    }
    sql = template
    for key, value in replacements.items():
        sql = sql.replace(key, value)
    if "{{" in sql:
        raise RuntimeError("quedaron placeholders sin sustituir en el SQL de suspension")
    return sql


def _row_to_result(row: dict[str, Any]) -> InsertarSuspensionResult:
    ok_raw = row.get("ok")
    ok = bool(ok_raw) if ok_raw is not None else False
    codigo = row.get("codigo_error")
    mensaje = row.get("mensaje") or ""
    llave = row.get("nueva_llave")
    return InsertarSuspensionResult(
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


class DatosAnalisisSuspensionWriteRepository:
    """Ejecuta el batch de inserción de suspensión en TRESS."""

    def __init__(self, engine: AsyncEngine) -> None:
        self._engine = engine

    async def insertar_suspension(
        self,
        *,
        empleado: int,
        usuario: str,
        fecha_inicio: date,
        fecha_fin_mostrar: date,
        comentario: str,
        confirmar: bool,
    ) -> InsertarSuspensionResult:
        sql = _render_insertar_suspension_sql(
            empleado=empleado,
            usuario=usuario,
            fecha_inicio=fecha_inicio,
            fecha_fin_mostrar=fecha_fin_mostrar,
            comentario=comentario,
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
            return InsertarSuspensionResult(
                ok=False,
                codigo_error="SIN_RESULTADO",
                mensaje="TRESS no devolvio resultado al registrar suspension.",
                nueva_llave=None,
            )
        return _row_to_result(row)

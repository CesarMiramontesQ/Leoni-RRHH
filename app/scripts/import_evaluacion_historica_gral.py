"""
Importa incidencias desde bono_productividad.evaluacion_historica_gral hacia incidencias.

Resuelve ``id_ponderacion`` vía ``ponderaciones_general.id`` → ``descripcion``.

Mapeo:
- ``origen`` / ``origen_id``: ``evaluacion_historica_gral`` + ``id``
- ``empleado_id`` (bono) → ``empleados.empleado_id`` local
- ``tipo``: ``ponderaciones_general.descripcion``
- ``categoria``: id de ponderación (texto)
- ``detalle``: ``comentarios``; si viene vacío, usa la descripción de ponderación
- ``area`` / ``subarea``: catálogos de bono

Uso:
    docker-compose exec backend python -m app.scripts.import_evaluacion_historica_gral
    docker-compose exec backend python -m app.scripts.import_evaluacion_historica_gral --execute
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, engine as main_engine
from app.integrations.bono_productividad_db import BonoProductividadReadClient
from app.models.empleados import Empleado
from app.models.incidencias import Incidencia

ORIGEN_TABLA_EVALUACION_HISTORICA_GRAL = "evaluacion_historica_gral"
_MAX_TIPO_LEN = 255

_SQL_EVALUACION_HISTORICA_GRAL = """
SELECT
    e.id AS bono_id,
    e.empleado_id AS bono_empleado_id,
    e.id_ponderacion,
    e.area_empleado,
    e.subarea_empleado,
    e.comentarios,
    pg.descripcion AS ponderacion_descripcion,
    a.descripcion AS area_nombre,
    s.descripcion AS subarea_nombre,
    emp.no_empleado AS bono_no_empleado,
    emp.nombre AS bono_nombre_empleado
FROM evaluacion_historica_gral e
LEFT JOIN ponderaciones_general pg ON pg.id = e.id_ponderacion
LEFT JOIN areas a ON a.area_id = e.area_empleado
LEFT JOIN subareas s ON s.subarea_id = e.subarea_empleado
LEFT JOIN empleados emp ON emp.empleado_id = e.empleado_id
ORDER BY e.id ASC
"""


@dataclass
class ImportStats:
    leidos: int = 0
    insertados: int = 0
    omitidos: int = 0
    errores: int = 0
    mensajes_error: list[str] = field(default_factory=list)

    def registrar_error(self, mensaje: str, *, max_errores: int = 200) -> None:
        self.errores += 1
        if len(self.mensajes_error) < max_errores:
            self.mensajes_error.append(mensaje)


def _safe_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _texto(val: Any) -> str | None:
    if val is None:
        return None
    t = str(val).strip()
    return t or None


def _truncar(s: str, max_len: int) -> str:
    if len(s) <= max_len:
        return s
    return s[: max_len - 1] + "…"


def validar_fila_evaluacion_historica_gral(
    row: dict[str, Any],
) -> tuple[bool, str | None, dict[str, Any] | None]:
    bono_id = _safe_int(row.get("bono_id"))
    if bono_id is None:
        return False, "id ausente o inválido", None

    bono_empleado_id = _safe_int(row.get("bono_empleado_id"))
    if bono_empleado_id is None:
        return False, "empleado_id ausente o inválido", None

    id_ponderacion = _safe_int(row.get("id_ponderacion"))
    if id_ponderacion is None:
        return False, "id_ponderacion ausente o inválido", None

    ponderacion_descripcion = _texto(row.get("ponderacion_descripcion"))
    if not ponderacion_descripcion:
        return False, (
            f"id_ponderacion sin relación en ponderaciones_general (id={id_ponderacion})"
        ), None

    comentarios = _texto(row.get("comentarios"))
    detalle = comentarios if comentarios else ponderacion_descripcion
    tipo_ui = _truncar(ponderacion_descripcion, _MAX_TIPO_LEN)

    no_empleado_raw = row.get("bono_no_empleado")
    no_empleado = _texto(str(no_empleado_raw)) if no_empleado_raw is not None else None

    payload = {
        "bono_id": bono_id,
        "bono_empleado_id": bono_empleado_id,
        "id_ponderacion": id_ponderacion,
        "tipo": tipo_ui,
        "categoria": str(id_ponderacion),
        "detalle": detalle,
        "comentarios": comentarios,
        "area": _texto(row.get("area_nombre")),
        "subarea": _texto(row.get("subarea_nombre")),
        "no_empleado": no_empleado,
        "nombre": _texto(row.get("bono_nombre_empleado")),
    }
    return True, None, payload


async def _leer_evaluacion_historica_gral(bono_engine) -> list[dict[str, Any]]:
    async with bono_engine.connect() as conn:
        result = await conn.execute(text(_SQL_EVALUACION_HISTORICA_GRAL))
        keys = list(result.keys())
        return [dict(zip(keys, row)) for row in result.fetchall()]


async def _cargar_empleados_por_bono_empleado_id(
    db: AsyncSession, bono_empleado_ids: set[int]
) -> dict[int, int]:
    if not bono_empleado_ids:
        return {}
    result = await db.execute(
        select(Empleado.id, Empleado.empleado_id).where(
            Empleado.empleado_id.in_(bono_empleado_ids)
        )
    )
    return {int(emp_id): int(local_id) for local_id, emp_id in result.all()}


async def _existe_duplicado(
    db: AsyncSession,
    *,
    origen_id: int,
    empleado_id: int,
    id_ponderacion: int,
    area: str | None,
    subarea: str | None,
    detalle: str,
    comentarios: str | None,
) -> bool:
    cat = str(id_ponderacion)
    result = await db.execute(
        select(Incidencia.id)
        .where(
            or_(
                and_(
                    Incidencia.origen == ORIGEN_TABLA_EVALUACION_HISTORICA_GRAL,
                    Incidencia.origen_id == origen_id,
                ),
                and_(
                    Incidencia.origen == ORIGEN_TABLA_EVALUACION_HISTORICA_GRAL,
                    Incidencia.empleado_id == empleado_id,
                    Incidencia.categoria == cat,
                    Incidencia.area == area,
                    Incidencia.subarea == subarea,
                    Incidencia.detalle == detalle,
                ),
                and_(
                    Incidencia.empleado_id == empleado_id,
                    Incidencia.categoria == cat,
                    Incidencia.area == area,
                    Incidencia.subarea == subarea,
                    Incidencia.detalle == (comentarios if comentarios else detalle),
                ),
            )
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def ejecutar_importacion(*, execute: bool, limit: int | None) -> ImportStats:
    stats = ImportStats()
    bono_engine = BonoProductividadReadClient.create_read_engine()
    if bono_engine is None:
        raise ConnectionError(
            "No se pudo conectar a bono_productividad: configure BONO_DB_HOST, "
            "BONO_DB_NAME y BONO_DB_USER."
        )

    try:
        try:
            rows = await _leer_evaluacion_historica_gral(bono_engine)
        except Exception as exc:
            raise ConnectionError(
                "Error leyendo evaluacion_historica_gral en bono_productividad: "
                f"{type(exc).__name__}: {exc}"
            ) from exc
    finally:
        await bono_engine.dispose()

    if limit is not None and limit > 0:
        rows = rows[:limit]

    stats.leidos = len(rows)
    bono_emp_ids = {
        emp
        for r in rows
        if (emp := _safe_int(r.get("bono_empleado_id"))) is not None
    }

    async with AsyncSessionLocal() as db:
        try:
            empleado_index = await _cargar_empleados_por_bono_empleado_id(db, bono_emp_ids)
        except Exception as exc:
            raise ConnectionError(
                f"Error conectando a la BD principal: {type(exc).__name__}: {exc}"
            ) from exc

        nuevos: list[Incidencia] = []
        synced_at_run = datetime.now(timezone.utc) if execute else None

        for row in rows:
            bono_id = _safe_int(row.get("bono_id"))
            ok, motivo_omision, payload = validar_fila_evaluacion_historica_gral(row)
            if not ok or payload is None:
                stats.omitidos += 1
                if motivo_omision and "ponderaciones_general" in motivo_omision:
                    stats.registrar_error(f"bono_id={bono_id}: {motivo_omision}")
                continue

            local_empleado_id = empleado_index.get(payload["bono_empleado_id"])
            if local_empleado_id is None:
                stats.omitidos += 1
                stats.registrar_error(
                    f"bono_id={bono_id}: empleado no encontrado en BD principal "
                    f"(empleado_id={payload['bono_empleado_id']})"
                )
                continue

            try:
                duplicado = await _existe_duplicado(
                    db,
                    origen_id=payload["bono_id"],
                    empleado_id=local_empleado_id,
                    id_ponderacion=payload["id_ponderacion"],
                    area=payload["area"],
                    subarea=payload["subarea"],
                    detalle=payload["detalle"],
                    comentarios=payload["comentarios"],
                )
            except Exception as exc:
                stats.registrar_error(
                    f"bono_id={bono_id}: error al buscar duplicado ({type(exc).__name__}: {exc})"
                )
                continue

            if duplicado:
                stats.omitidos += 1
                continue

            nuevos.append(
                Incidencia(
                    tipo=payload["tipo"],
                    empleado_id=local_empleado_id,
                    no_empleado=payload["no_empleado"],
                    nombre=payload["nombre"],
                    fecha=None,
                    categoria=payload["categoria"],
                    detalle=payload["detalle"],
                    area=payload["area"],
                    subarea=payload["subarea"],
                    origen=ORIGEN_TABLA_EVALUACION_HISTORICA_GRAL,
                    origen_id=payload["bono_id"],
                    synced_at=synced_at_run,
                )
            )

        if execute and nuevos:
            try:
                db.add_all(nuevos)
                await db.commit()
                stats.insertados = len(nuevos)
            except Exception as exc:
                await db.rollback()
                stats.registrar_error(
                    f"Error al insertar en incidencias: {type(exc).__name__}: {exc}"
                )
                raise
        elif nuevos:
            stats.insertados = len(nuevos)
        else:
            await db.rollback()

    return stats


def _imprimir_resumen(stats: ImportStats, *, execute: bool) -> None:
    modo = "EJECUCIÓN" if execute else "SIMULACIÓN (sin insertar; use --execute)"
    print(f"\n=== Importación evaluacion_historica_gral → incidencias [{modo}] ===")
    print(f"Total registros leídos:     {stats.leidos}")
    print(f"Total registros insertados: {stats.insertados}")
    print(f"Total registros omitidos:   {stats.omitidos}")
    print(f"Total errores encontrados:  {stats.errores}")
    if stats.mensajes_error:
        print("\nDetalle de errores (máx. 200):")
        for msg in stats.mensajes_error:
            print(f"  - {msg}")


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Importa evaluacion_historica_gral desde bono_productividad a incidencias."
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Persistir inserciones (por defecto solo simula).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        metavar="N",
        help="Procesar solo los primeros N registros leídos (orden por id).",
    )
    return parser.parse_args(argv)


async def _async_main(argv: list[str] | None) -> int:
    args = _parse_args(argv)
    try:
        stats = await ejecutar_importacion(execute=args.execute, limit=args.limit)
    except ConnectionError as exc:
        print(f"ERROR DE CONEXIÓN: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"ERROR: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1
    finally:
        await main_engine.dispose()

    _imprimir_resumen(stats, execute=args.execute)
    return 1 if stats.errores > 0 and args.execute else 0


def main(argv: list[str] | None = None) -> None:
    raise SystemExit(asyncio.run(_async_main(argv)))


if __name__ == "__main__":
    main()

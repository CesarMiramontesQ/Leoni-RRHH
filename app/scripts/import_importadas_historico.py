"""
Importa incidencias desde bono_productividad.importadas_historico hacia incidencias.

Resuelve ``tipo_inc`` vía ``ponderaciones.codigo`` → ``ponderaciones.descripcion``.

Mapeo:
- ``origen`` / ``origen_id``: tabla e id en bono
- ``no_empleado``: ``importadas_historico.no_empleado`` (texto)
- ``tipo``: descripción de ponderación (significado de ``tipo_inc``)
- ``categoria``: código ``tipo_inc``
- ``detalle``: misma descripción (motivo legible)
- ``area`` / ``subarea``: descripciones desde catálogos de bono
- ``fecha``: null (no existe en origen)

Uso:
    docker-compose exec backend python -m app.scripts.import_importadas_historico
    docker-compose exec backend python -m app.scripts.import_importadas_historico --execute
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

ORIGEN_TABLA_IMPORTADAS_HISTORICO = "importadas_historico"
_MAX_TIPO_LEN = 255

_SQL_IMPORTADAS_HISTORICO = """
SELECT
    ih.id AS bono_id,
    CAST(ih.no_empleado AS text) AS no_empleado,
    ih.tipo_inc,
    ih.area_empleado,
    ih.subarea_empleado,
    p.descripcion AS tipo_descripcion,
    a.descripcion AS area_nombre,
    s.descripcion AS subarea_nombre,
    e.nombre AS bono_nombre_empleado
FROM importadas_historico ih
LEFT JOIN ponderaciones p ON p.codigo = ih.tipo_inc
LEFT JOIN areas a ON a.area_id = ih.area_empleado
LEFT JOIN subareas s ON s.subarea_id = ih.subarea_empleado
LEFT JOIN empleados e ON CAST(e.no_empleado AS text) = CAST(ih.no_empleado AS text)
ORDER BY ih.id ASC
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


def _claves_no_empleado_lookup(no: str) -> list[str]:
    """Variantes de búsqueda (BD local a veces guarda ``1849.0`` en lugar de ``1849``)."""
    s = no.strip().lower()
    if not s:
        return []
    claves = {s}
    if s.endswith(".0") and s[:-2].isdigit():
        claves.add(s[:-2])
    elif s.isdigit():
        claves.add(f"{s}.0")
    return list(claves)


def validar_fila_importadas_historico(
    row: dict[str, Any],
) -> tuple[bool, str | None, dict[str, Any] | None]:
    bono_id = _safe_int(row.get("bono_id"))
    if bono_id is None:
        return False, "id ausente o inválido", None

    no_empleado = _texto(row.get("no_empleado"))
    if not no_empleado:
        return False, "no_empleado ausente o inválido", None

    tipo_inc = _texto(row.get("tipo_inc"))
    if not tipo_inc:
        return False, "tipo_inc vacío", None

    tipo_descripcion = _texto(row.get("tipo_descripcion"))
    if not tipo_descripcion:
        return False, f"tipo_inc sin relación en ponderaciones (codigo={tipo_inc})", None

    tipo_ui = _truncar(tipo_descripcion, _MAX_TIPO_LEN)

    payload = {
        "bono_id": bono_id,
        "no_empleado": no_empleado,
        "tipo_inc": tipo_inc,
        "tipo": tipo_ui,
        "categoria": tipo_inc,
        "detalle": tipo_descripcion,
        "area": _texto(row.get("area_nombre")),
        "subarea": _texto(row.get("subarea_nombre")),
        "nombre": _texto(row.get("bono_nombre_empleado")),
    }
    return True, None, payload


async def _leer_importadas_historico(bono_engine) -> list[dict[str, Any]]:
    async with bono_engine.connect() as conn:
        result = await conn.execute(text(_SQL_IMPORTADAS_HISTORICO))
        keys = list(result.keys())
        return [dict(zip(keys, row)) for row in result.fetchall()]


async def _cargar_empleados_por_no_empleado(
    db: AsyncSession, numeros: set[str]
) -> dict[str, int]:
    if not numeros:
        return {}
    claves_busqueda: set[str] = set()
    for n in numeros:
        claves_busqueda.update(_claves_no_empleado_lookup(n))
    if not claves_busqueda:
        return {}
    result = await db.execute(
        select(Empleado.id, Empleado.no_empleado).where(
            func.lower(Empleado.no_empleado).in_(list(claves_busqueda))
        )
    )
    index: dict[str, int] = {}
    for local_id, no_emp in result.all():
        if no_emp is None:
            continue
        for clave in _claves_no_empleado_lookup(str(no_emp)):
            index[clave] = int(local_id)
    return index


async def _existe_duplicado(
    db: AsyncSession,
    *,
    origen_id: int,
    no_empleado: str,
    tipo_inc: str,
    area: str | None,
    subarea: str | None,
    tipo: str,
) -> bool:
    result = await db.execute(
        select(Incidencia.id)
        .where(
            or_(
                and_(
                    Incidencia.origen == ORIGEN_TABLA_IMPORTADAS_HISTORICO,
                    Incidencia.origen_id == origen_id,
                ),
                and_(
                    Incidencia.origen == ORIGEN_TABLA_IMPORTADAS_HISTORICO,
                    Incidencia.no_empleado == no_empleado,
                    Incidencia.categoria == tipo_inc,
                    Incidencia.area == area,
                    Incidencia.subarea == subarea,
                    Incidencia.tipo == tipo,
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
            rows = await _leer_importadas_historico(bono_engine)
        except Exception as exc:
            raise ConnectionError(
                f"Error leyendo importadas_historico en bono_productividad: {type(exc).__name__}: {exc}"
            ) from exc
    finally:
        await bono_engine.dispose()

    if limit is not None and limit > 0:
        rows = rows[:limit]

    stats.leidos = len(rows)
    numeros = {_texto(r.get("no_empleado")) for r in rows}
    numeros = {n for n in numeros if n}

    async with AsyncSessionLocal() as db:
        try:
            empleado_index = await _cargar_empleados_por_no_empleado(db, numeros)
        except Exception as exc:
            raise ConnectionError(
                f"Error conectando a la BD principal: {type(exc).__name__}: {exc}"
            ) from exc

        nuevos: list[Incidencia] = []
        synced_at_run = datetime.now(timezone.utc) if execute else None

        for row in rows:
            bono_id = _safe_int(row.get("bono_id"))
            ok, motivo_omision, payload = validar_fila_importadas_historico(row)
            if not ok or payload is None:
                stats.omitidos += 1
                if motivo_omision and "ponderaciones" in motivo_omision:
                    stats.registrar_error(f"bono_id={bono_id}: {motivo_omision}")
                continue

            local_empleado_id = None
            for clave in _claves_no_empleado_lookup(payload["no_empleado"]):
                local_empleado_id = empleado_index.get(clave)
                if local_empleado_id is not None:
                    break
            if local_empleado_id is None:
                stats.omitidos += 1
                stats.registrar_error(
                    f"bono_id={bono_id}: empleado no encontrado en BD principal "
                    f"(no_empleado={payload['no_empleado']})"
                )
                continue

            try:
                duplicado = await _existe_duplicado(
                    db,
                    origen_id=payload["bono_id"],
                    no_empleado=payload["no_empleado"],
                    tipo_inc=payload["tipo_inc"],
                    area=payload["area"],
                    subarea=payload["subarea"],
                    tipo=payload["tipo"],
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
                    origen=ORIGEN_TABLA_IMPORTADAS_HISTORICO,
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
    print(f"\n=== Importación importadas_historico → incidencias [{modo}] ===")
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
        description="Importa importadas_historico desde bono_productividad a incidencias."
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

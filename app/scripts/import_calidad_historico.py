"""
Importa incidencias desde bono_productividad.calidad_historico hacia la tabla local incidencias.

Solo lectura en bono; inserciones en la BD principal (DATABASE_URL).
No modifica esquemas ni sobrescribe filas existentes equivalentes.

Mapeo de trazabilidad:
- ``origen``: nombre de la tabla fuente en bono (``calidad_historico``).
- ``origen_id``: ``calidad_historico.id`` (deduplicación con índice único ``origen`` + ``origen_id``).
- ``synced_at``: fecha/hora UTC en que se ejecuta el script con ``--execute`` (no la ``fecha`` del hecho).
- ``fecha``: fecha del registro en bono (columna ``calidad_historico.fecha``).

Uso:
    docker-compose exec backend python -m app.scripts.import_calidad_historico
    docker-compose exec backend python -m app.scripts.import_calidad_historico --execute
    docker-compose exec backend python -m app.scripts.import_calidad_historico --execute --limit 100
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import and_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, engine as main_engine
from app.integrations.bono_productividad_db import BonoProductividadReadClient
from app.models.empleados import Empleado
from app.models.incidencias import Incidencia

TIPO_INCIDENCIA_CALIDAD = "Calidad"
ORIGEN_TABLA_CALIDAD_HISTORICO = "calidad_historico"

_SQL_CALIDAD_HISTORICO = """
SELECT
    ch.id AS bono_id,
    ch.id_empleado,
    ch.motivo,
    ch.fecha,
    ch.area_empleado,
    ch.subarea_empleado,
    a.descripcion AS area_nombre,
    s.descripcion AS subarea_nombre,
    ch.incidencia_categoria_id,
    cat.nombre AS categoria_nombre,
    e.no_empleado AS bono_no_empleado,
    e.nombre AS bono_nombre_empleado
FROM calidad_historico ch
LEFT JOIN areas a ON a.area_id = ch.area_empleado
LEFT JOIN subareas s ON s.subarea_id = ch.subarea_empleado
LEFT JOIN incidencia_categoria cat ON cat.id = ch.incidencia_categoria_id
LEFT JOIN empleados e ON e.empleado_id = ch.id_empleado
ORDER BY ch.id ASC
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


def _safe_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        value = value.date()
    if isinstance(value, date):
        return value if 1900 <= value.year <= 2100 else None
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        base = s.replace("Z", "").split("+", 1)[0].split("T", 1)[0].strip()[:10]
        parts = base.split("-")
        if len(parts) != 3:
            return None
        try:
            y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
            if not (1900 <= y <= 2100):
                return None
            return date(y, m, d)
        except (TypeError, ValueError):
            return None
    return None


def _texto(val: Any) -> str | None:
    if val is None:
        return None
    t = str(val).strip()
    return t or None


def validar_fila_calidad_historico(row: dict[str, Any]) -> tuple[bool, str | None, dict[str, Any] | None]:
    """
    Valida y normaliza una fila de calidad_historico.

    Returns:
        (ok, motivo_omision, payload_normalizado)
    """
    bono_id = _safe_int(row.get("bono_id"))
    id_empleado = _safe_int(row.get("id_empleado"))
    if id_empleado is None:
        return False, "id_empleado ausente o inválido", None

    motivo = _texto(row.get("motivo"))
    if not motivo:
        return False, "motivo vacío", None

    fecha = _safe_date(row.get("fecha"))
    if fecha is None:
        return False, "fecha ausente o inválida", None

    cat_id = row.get("incidencia_categoria_id")
    categoria_nombre = _texto(row.get("categoria_nombre"))
    if cat_id is not None and _safe_int(cat_id) is not None and not categoria_nombre:
        return False, f"categoría inexistente (incidencia_categoria_id={cat_id})", None

    payload = {
        "bono_id": bono_id,
        "id_empleado": id_empleado,
        "motivo": motivo,
        "fecha": fecha,
        "area": _texto(row.get("area_nombre")),
        "subarea": _texto(row.get("subarea_nombre")),
        "categoria": categoria_nombre,
        "no_empleado": _texto(row.get("bono_no_empleado")),
        "nombre": _texto(row.get("bono_nombre_empleado")),
    }
    return True, None, payload


async def _leer_calidad_historico(bono_engine) -> list[dict[str, Any]]:
    async with bono_engine.connect() as conn:
        result = await conn.execute(text(_SQL_CALIDAD_HISTORICO))
        keys = list(result.keys())
        return [dict(zip(keys, row)) for row in result.fetchall()]


async def _cargar_empleados_por_bono_id(
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


async def _existe_por_origen_id(
    db: AsyncSession,
    *,
    origen_id: int,
) -> bool:
    """Duplicado si ya existe la misma fila importada (origen + id en bono)."""
    result = await db.execute(
        select(Incidencia.id)
        .where(
            and_(
                Incidencia.origen == ORIGEN_TABLA_CALIDAD_HISTORICO,
                Incidencia.origen_id == origen_id,
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
            rows = await _leer_calidad_historico(bono_engine)
        except Exception as exc:
            raise ConnectionError(
                f"Error leyendo calidad_historico en bono_productividad: {type(exc).__name__}: {exc}"
            ) from exc
    finally:
        await bono_engine.dispose()

    if limit is not None and limit > 0:
        rows = rows[:limit]

    stats.leidos = len(rows)
    bono_ids = {
        emp
        for r in rows
        if (emp := _safe_int(r.get("id_empleado"))) is not None
    }

    async with AsyncSessionLocal() as db:
        try:
            empleado_index = await _cargar_empleados_por_bono_id(db, bono_ids)
        except Exception as exc:
            raise ConnectionError(
                f"Error conectando a la BD principal: {type(exc).__name__}: {exc}"
            ) from exc

        nuevos: list[Incidencia] = []
        # Marca de sincronización: momento en que se ejecuta el script (solo al persistir).
        synced_at_run = datetime.now(timezone.utc) if execute else None

        for row in rows:
            bono_id = _safe_int(row.get("bono_id"))
            ok, motivo_omision, payload = validar_fila_calidad_historico(row)
            if not ok or payload is None:
                stats.omitidos += 1
                if motivo_omision and "categoría inexistente" in motivo_omision:
                    stats.registrar_error(
                        f"bono_id={bono_id}: {motivo_omision}"
                    )
                continue

            local_empleado_id = empleado_index.get(payload["id_empleado"])
            if local_empleado_id is None:
                stats.omitidos += 1
                stats.registrar_error(
                    f"bono_id={bono_id}: empleado no encontrado en BD principal "
                    f"(id_empleado={payload['id_empleado']})"
                )
                continue

            if bono_id is None:
                stats.omitidos += 1
                stats.registrar_error(f"bono_id ausente en fila leída (id_empleado={payload['id_empleado']})")
                continue

            try:
                duplicado = await _existe_por_origen_id(db, origen_id=bono_id)
            except Exception as exc:
                stats.registrar_error(
                    f"bono_id={bono_id}: error al buscar duplicado ({type(exc).__name__}: {exc})"
                )
                continue

            if duplicado:
                stats.omitidos += 1
                continue

            inc = Incidencia(
                tipo=TIPO_INCIDENCIA_CALIDAD,
                empleado_id=local_empleado_id,
                no_empleado=payload["no_empleado"],
                nombre=payload["nombre"],
                fecha=payload["fecha"],
                categoria=payload["categoria"],
                detalle=payload["motivo"],
                area=payload["area"],
                subarea=payload["subarea"],
                origen=ORIGEN_TABLA_CALIDAD_HISTORICO,
                origen_id=bono_id,
                synced_at=synced_at_run,
            )
            nuevos.append(inc)

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
    print(f"\n=== Importación calidad_historico → incidencias [{modo}] ===")
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
        description=(
            "Importa calidad_historico desde bono_productividad a la tabla incidencias "
            "de la BD principal."
        )
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

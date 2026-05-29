"""
Sincroniza empleados desde bono_productividad.empleados hacia la tabla local empleados.

Solo lectura en bono; upsert en la BD principal (DATABASE_URL).
Copia todas las columnas presentes en ambas tablas (excepto ``id``, PK local).
``lider_id`` se copia tal cual (``empleado_id`` del jefe en bono).

Clave de identificación: ``empleado_id``.

Uso:
    docker-compose exec backend python -m app.scripts.import_empleados_bono
    docker-compose exec backend python -m app.scripts.import_empleados_bono --execute
    docker-compose exec backend python -m app.scripts.import_empleados_bono --execute --limit 100
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import String, select, text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.core.database import AsyncSessionLocal, engine as main_engine
from app.core.security import SYNC_PLACEHOLDER_PASSWORD_HASH
from app.integrations.bono_productividad_db import BonoProductividadReadClient
from app.models.empleados import Empleado
from app.models.roles import Rol

logger = logging.getLogger(__name__)

_COLUMNA_PK_LOCAL = "id"

_SQL_COLUMNAS_BONO = """
SELECT column_name
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name = 'empleados'
ORDER BY ordinal_position
"""


@dataclass
class ImportStats:
    leidos: int = 0
    creados: int = 0
    actualizados: int = 0
    omitidos: int = 0
    errores: int = 0
    columnas_importadas: list[str] = field(default_factory=list)
    mensajes_error: list[str] = field(default_factory=list)

    def registrar_error(self, mensaje: str, *, max_errores: int = 200) -> None:
        self.errores += 1
        if len(self.mensajes_error) < max_errores:
            self.mensajes_error.append(mensaje)


def _columnas_locales() -> set[str]:
    return {col.name for col in Empleado.__table__.columns}


def _columnas_string_locales() -> frozenset[str]:
    return frozenset(
        col.name
        for col in Empleado.__table__.columns
        if isinstance(col.type, String)
    )


def _texto(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text if text else None


def _normalizar_no_empleado(value: Any) -> str | None:
    raw = _texto(value)
    if not raw:
        return None
    if raw.endswith(".0") and raw[:-2].isdigit():
        return raw[:-2]
    return raw


def _normalizar_valor_campo(campo: str, valor: Any) -> Any:
    if valor is None:
        return None
    if campo == "no_empleado":
        return _normalizar_no_empleado(valor)
    if campo in _columnas_string_locales():
        return _texto(valor)
    return valor


def resolver_columnas_importables(
    columnas_bono: set[str],
    columnas_locales: set[str] | None = None,
) -> list[str]:
    locales = columnas_locales if columnas_locales is not None else _columnas_locales()
    return sorted((columnas_bono & locales) - {_COLUMNA_PK_LOCAL})


async def _obtener_columnas_bono(engine: AsyncEngine) -> set[str]:
    async with engine.connect() as conn:
        result = await conn.execute(text(_SQL_COLUMNAS_BONO))
        return {row[0] for row in result.fetchall()}


async def _leer_empleados_bono(
    engine: AsyncEngine,
    columnas: list[str],
    *,
    limit: int | None,
) -> list[dict[str, Any]]:
    if not columnas:
        return []
    cols_sql = ", ".join(f'"{c}"' for c in columnas)
    sql = f"SELECT {cols_sql} FROM empleados ORDER BY empleado_id ASC"
    if limit is not None and limit > 0:
        sql += f" LIMIT {int(limit)}"
    async with engine.connect() as conn:
        result = await conn.execute(text(sql))
        return [dict(row) for row in result.mappings().all()]


def _normalizar_empleado_id(row: dict[str, Any]) -> int | None:
    empleado_id = row.get("empleado_id")
    try:
        return int(empleado_id) if empleado_id is not None else None
    except (TypeError, ValueError):
        return None


def _payload_desde_bono(row: dict[str, Any], columnas: list[str]) -> dict[str, Any]:
    return {
        col: _normalizar_valor_campo(col, row.get(col))
        for col in columnas
    }


def _validar_fila(empleado_id: int | None) -> tuple[bool, str | None]:
    if empleado_id is None:
        return False, "empleado_id inválido o ausente"
    return True, None


def _validar_payload(payload: dict[str, Any]) -> tuple[bool, str | None]:
    if "no_empleado" in payload and not payload.get("no_empleado"):
        return False, "no_empleado ausente o inválido"
    if "nombre" in payload and not payload.get("nombre"):
        return False, "nombre ausente"
    return True, None


async def _cargar_indice_empleado_id(db: AsyncSession) -> dict[int, Empleado]:
    result = await db.execute(select(Empleado))
    empleados = list(result.scalars().all())
    return {int(e.empleado_id): e for e in empleados}


def _aplicar_payload(empleado: Empleado, payload: dict[str, Any]) -> bool:
    hubo_cambio = False
    for campo, valor in payload.items():
        if getattr(empleado, campo) != valor:
            setattr(empleado, campo, valor)
            hubo_cambio = True
    return hubo_cambio


async def _rol_empleado_default(db: AsyncSession) -> Rol:
    result = await db.execute(select(Rol).where(Rol.nombre == "empleado"))
    rol = result.scalar_one_or_none()
    if rol is None:
        raise ConnectionError(
            "Rol 'empleado' no encontrado en BD principal — ejecutar seed de roles"
        )
    return rol


def _completar_defaults_insercion(payload: dict[str, Any], rol: Rol) -> None:
    if not payload.get("password_hash"):
        payload["password_hash"] = SYNC_PLACEHOLDER_PASSWORD_HASH
    if payload.get("rol_id") is None:
        payload["rol_id"] = rol.id


async def ejecutar_importacion(*, execute: bool, limit: int | None) -> ImportStats:
    stats = ImportStats()
    columnas_locales = _columnas_locales()

    bono_engine = BonoProductividadReadClient.create_read_engine()
    if bono_engine is None:
        raise ConnectionError(
            "No se pudo conectar a bono_productividad: configure BONO_DB_HOST, "
            "BONO_DB_NAME y BONO_DB_USER."
        )

    try:
        try:
            columnas_bono = await _obtener_columnas_bono(bono_engine)
        except Exception as exc:
            raise ConnectionError(
                f"Error leyendo esquema empleados en bono: {type(exc).__name__}: {exc}"
            ) from exc

        columnas_importables = resolver_columnas_importables(columnas_bono, columnas_locales)
        stats.columnas_importadas = list(columnas_importables)

        if not columnas_importables:
            stats.registrar_error(
                "No hay columnas compartidas entre bono.empleados y empleados local"
            )
            return stats

        try:
            rows = await _leer_empleados_bono(
                bono_engine,
                columnas_importables,
                limit=limit,
            )
        except Exception as exc:
            raise ConnectionError(
                f"Error leyendo empleados en bono_productividad: {type(exc).__name__}: {exc}"
            ) from exc
    finally:
        await bono_engine.dispose()

    stats.leidos = len(rows)
    logger.info(
        "Import empleados bono iniciado | leidos=%s columnas=%s execute=%s",
        stats.leidos,
        stats.columnas_importadas,
        execute,
    )

    async with AsyncSessionLocal() as db:
        try:
            by_empleado_id = await _cargar_indice_empleado_id(db)
        except Exception as exc:
            raise ConnectionError(
                f"Error conectando a la BD principal: {type(exc).__name__}: {exc}"
            ) from exc

        rol_default: Rol | None = None

        for row in rows:
            empleado_id = _normalizar_empleado_id(row)
            ok, motivo = _validar_fila(empleado_id)
            if not ok:
                stats.omitidos += 1
                stats.registrar_error(f"empleado_id={empleado_id}: {motivo}")
                continue

            payload = _payload_desde_bono(row, columnas_importables)
            ok_payload, motivo_payload = _validar_payload(payload)
            if not ok_payload:
                stats.omitidos += 1
                stats.registrar_error(f"empleado_id={empleado_id}: {motivo_payload}")
                continue

            existente = by_empleado_id.get(empleado_id)  # type: ignore[arg-type]

            if existente is None:
                if rol_default is None:
                    rol_default = await _rol_empleado_default(db)
                _completar_defaults_insercion(payload, rol_default)

                try:
                    nuevo = Empleado(**payload)
                except Exception as exc:
                    stats.omitidos += 1
                    stats.registrar_error(
                        f"empleado_id={empleado_id}: no se pudo crear ({type(exc).__name__}: {exc})"
                    )
                    continue

                db.add(nuevo)
                await db.flush()
                await db.refresh(nuevo)
                by_empleado_id[int(nuevo.empleado_id)] = nuevo
                stats.creados += 1
                continue

            if _aplicar_payload(existente, payload):
                stats.actualizados += 1
            else:
                stats.omitidos += 1

        if execute:
            try:
                await db.commit()
            except Exception as exc:
                await db.rollback()
                stats.registrar_error(
                    f"Error al persistir empleados: {type(exc).__name__}: {exc}"
                )
                raise
        else:
            await db.rollback()

    logger.info(
        "Import empleados bono finalizado | leidos=%s creados=%s actualizados=%s "
        "omitidos=%s errores=%s execute=%s",
        stats.leidos,
        stats.creados,
        stats.actualizados,
        stats.omitidos,
        stats.errores,
        execute,
    )
    return stats


def _imprimir_resumen(stats: ImportStats, *, execute: bool) -> None:
    modo = "EJECUCIÓN" if execute else "SIMULACIÓN (sin persistir; use --execute)"
    print(f"\n=== Sincronización bono.empleados → empleados [{modo}] ===")
    print(f"Columnas importadas:       {', '.join(stats.columnas_importadas) or '(ninguna)'}")
    print(f"Total registros leídos:    {stats.leidos}")
    print(f"Total registros creados:   {stats.creados}")
    print(f"Total registros actualizados: {stats.actualizados}")
    print(f"Total registros omitidos:  {stats.omitidos}")
    print(f"Total errores encontrados: {stats.errores}")
    if stats.mensajes_error:
        print("\nDetalle de errores (máx. 200):")
        for msg in stats.mensajes_error:
            print(f"  - {msg}")


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Sincroniza empleados desde bono_productividad.empleados hacia la tabla "
            "empleados de la BD principal (copia todas las columnas compartidas)."
        )
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Persistir cambios (por defecto solo simula).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        metavar="N",
        help="Procesar solo los primeros N registros leídos (orden por empleado_id).",
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

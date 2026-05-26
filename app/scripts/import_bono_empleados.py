"""
Importa empleados desde bono_productividad.empleados hacia la BD principal.

No importa ``email`` ni ``rol_id``. ``password_hash`` proviene de la columna ``password`` en bono.

Uso:
    docker-compose exec backend python -m app.scripts.import_bono_empleados
    docker-compose exec backend python -m app.scripts.import_bono_empleados --execute
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from app.core.database import AsyncSessionLocal
from app.integrations.bono_empleados_sync import BonoEmpleadosImportStats, BonoEmpleadosSyncService


async def ejecutar_importacion(*, execute: bool) -> BonoEmpleadosImportStats:
    async with AsyncSessionLocal() as db:
        service = BonoEmpleadosSyncService(db)
        return await service.sincronizar_empleados(execute=execute)


def _imprimir_resumen(stats: BonoEmpleadosImportStats, *, execute: bool) -> None:
    modo = "EJECUCIÓN" if execute else "SIMULACIÓN (sin persistir; use --execute)"
    print(f"\n=== Importación bono.empleados → empleados [{modo}] ===")
    print(f"Total leídos:      {stats.leidos}")
    print(f"Insertados:        {stats.insertados}")
    print(f"Actualizados:      {stats.actualizados}")
    print(f"Omitidos/sin cambio: {stats.omitidos}")
    print(f"Errores:           {stats.errores}")
    if stats.mensajes_error:
        print("\nDetalle:")
        for msg in stats.mensajes_error:
            print(f"  - {msg}")


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Importa empleados desde bono_productividad.empleados (sin email/rol_id)."
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Persiste cambios en la BD principal (por defecto solo simula).",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    try:
        stats = asyncio.run(ejecutar_importacion(execute=args.execute))
    except ConnectionError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"ERROR: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 2

    _imprimir_resumen(stats, execute=args.execute)
    return 1 if stats.errores else 0


if __name__ == "__main__":
    raise SystemExit(main())

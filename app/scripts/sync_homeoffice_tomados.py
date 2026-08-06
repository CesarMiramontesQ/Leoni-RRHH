"""
Sincroniza los días de home office tomados de datos-analisis (TRESS) hacia Bono
(`levelup_homeoffice_tomados`).

Es la misma función que corre el job diario de las 06:00 y la aprobación de solicitudes.
Sirve para el backfill inicial —al desplegar, la tabla está vacía hasta la primera
corrida— y para forzar un refresco puntual.

Uso:
    docker-compose exec backend python -m app.scripts.sync_homeoffice_tomados
    docker-compose exec backend python -m app.scripts.sync_homeoffice_tomados --execute
    docker-compose exec backend python -m app.scripts.sync_homeoffice_tomados \\
        --no-empleado 553 --execute
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from app.services.sync_homeoffice_tomados_service import (
    SyncHomeOfficeStats,
    sincronizar_homeoffice_tomados,
)


def _print_stats(stats: SyncHomeOfficeStats, *, execute: bool, alcance: str) -> None:
    modo = "EXECUTE" if execute else "DRY-RUN"
    print(f"\n=== Sync home office tomado → Bono [{modo}] ===")
    print(f"Alcance:      {alcance}")
    print(f"Consultados:  {stats.consultados}")
    print(f"Insertados:   {stats.insertados}")
    print(f"Actualizados: {stats.actualizados}")
    print(f"Omitidos:     {stats.omitidos}")


async def ejecutar(*, no_empleado: int | None, execute: bool) -> int:
    from app.core.database import AsyncSessionLocal, engine

    # Con APP_ENV=development el engine nace con echo=True y el volcado de SQL sepulta el
    # resumen (un IN con cientos de binds impreso entero). Bajar el nivel del logger no
    # basta: `echo` emite sin consultarlo, así que se apaga en el engine.
    engine.echo = False

    alcance = f"empleado {no_empleado}" if no_empleado is not None else "empleados activos"
    try:
        async with AsyncSessionLocal() as db:
            stats = await sincronizar_homeoffice_tomados(
                db,
                no_empleado=no_empleado,
                origen="manual",
                execute=execute,
            )
    except ConnectionError as exc:
        print(f"ERROR de conexión: {exc}", file=sys.stderr)
        return 1

    _print_stats(stats, execute=execute, alcance=alcance)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Sincroniza los días de home office tomados de TRESS hacia "
            "levelup_homeoffice_tomados (Bono)."
        )
    )
    parser.add_argument(
        "--no-empleado",
        type=int,
        default=None,
        help="Sincronizar solo ese número de empleado. Sin el flag: todos los activos.",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Persistir cambios. Sin este flag solo dry-run.",
    )
    args = parser.parse_args(argv)

    return asyncio.run(ejecutar(no_empleado=args.no_empleado, execute=args.execute))


if __name__ == "__main__":
    sys.exit(main())

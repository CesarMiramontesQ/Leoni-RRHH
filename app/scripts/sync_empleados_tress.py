"""
Sincroniza los datos generales del colaborador de datos-analisis (TRESS) hacia Bono
(`levelup_empleados_tress`).

Es la misma función que corre el job diario de las 04:10. Sirve para la carga inicial —sin
ella la Vista 360 muestra la fecha de ingreso vacía— y para forzar un refresco.

Uso:
    docker-compose exec backend python -m app.scripts.sync_empleados_tress
    docker-compose exec backend python -m app.scripts.sync_empleados_tress --execute
    docker-compose exec backend python -m app.scripts.sync_empleados_tress --no-empleado 553 --execute
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from app.services.sync_empleados_tress_service import (
    SyncEmpleadosTressStats,
    sincronizar_empleados_tress,
)


def _print_stats(stats: SyncEmpleadosTressStats, *, execute: bool) -> None:
    modo = "EXECUTE" if execute else "DRY-RUN"
    print(f"\n=== Sync datos generales del colaborador → Bono [{modo}] ===")
    print(f"Colaboradores en origen: {stats.empleados_origen}")
    print(f"Insertados:              {stats.insertados}")
    print(f"Actualizados:            {stats.actualizados}")
    print(f"Sin cambios:             {stats.omitidos}")
    print(f"Sin empleado en Bono:    {stats.sin_empleado_en_bono}")


async def ejecutar(*, execute: bool, no_empleado: int | None) -> int:
    from app.core.database import AsyncSessionLocal, engine

    # Con APP_ENV=development el engine nace con echo=True y el volcado de SQL sepulta el
    # resumen. Bajar el nivel del logger no basta: `echo` emite sin consultarlo.
    engine.echo = False

    try:
        async with AsyncSessionLocal() as db:
            stats = await sincronizar_empleados_tress(
                db, origen="manual", execute=execute, solo_no_empleado=no_empleado
            )
    except ConnectionError as exc:
        print(f"ERROR de conexión: {exc}", file=sys.stderr)
        return 1
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    _print_stats(stats, execute=execute)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Sincroniza los datos generales del colaborador desde datos-analisis (TRESS) "
            "hacia levelup_empleados_tress."
        )
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Persistir cambios. Sin este flag solo dry-run.",
    )
    parser.add_argument(
        "--no-empleado",
        type=int,
        default=None,
        help="Sincronizar un solo número de empleado, para depurar.",
    )
    args = parser.parse_args(argv)
    return asyncio.run(ejecutar(execute=args.execute, no_empleado=args.no_empleado))


if __name__ == "__main__":
    sys.exit(main())

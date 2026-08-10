"""
Sincroniza el personal activo por turno de datos-analisis (TRESS) hacia Bono
(`levelup_turnos_uso`).

Es la misma función que corre el job diario de las 04:00. Sirve para la carga inicial —al
desplegar, la tabla está vacía hasta la primera corrida y Ajustes Comedor cae de vuelta al
catálogo completo— y para forzar un refresco puntual tras un cambio de turnos en nómina.

Uso:
    docker-compose exec backend python -m app.scripts.sync_turnos_uso
    docker-compose exec backend python -m app.scripts.sync_turnos_uso --execute
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from app.services.sync_turnos_uso_service import (
    SyncTurnosUsoStats,
    sincronizar_turnos_uso,
)


def _print_stats(stats: SyncTurnosUsoStats, *, execute: bool) -> None:
    modo = "EXECUTE" if execute else "DRY-RUN"
    print(f"\n=== Sync turnos en uso → Bono [{modo}] ===")
    print(f"Turnos en origen: {stats.turnos_origen}")
    print(f"Insertados:       {stats.insertados}")
    print(f"Actualizados:     {stats.actualizados}")
    print(f"Omitidos:         {stats.omitidos}")
    print(f"Puestos a cero:   {stats.puestos_a_cero}")


async def ejecutar(*, execute: bool) -> int:
    from app.core.database import AsyncSessionLocal, engine

    # Con APP_ENV=development el engine nace con echo=True y el volcado de SQL sepulta el
    # resumen. Bajar el nivel del logger no basta: `echo` emite sin consultarlo.
    engine.echo = False

    try:
        async with AsyncSessionLocal() as db:
            stats = await sincronizar_turnos_uso(db, origen="manual", execute=execute)
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
            "Sincroniza el personal activo por turno desde datos-analisis (TRESS) hacia "
            "levelup_turnos_uso."
        )
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Persistir cambios. Sin este flag solo dry-run.",
    )
    args = parser.parse_args(argv)
    return asyncio.run(ejecutar(execute=args.execute))


if __name__ == "__main__":
    sys.exit(main())

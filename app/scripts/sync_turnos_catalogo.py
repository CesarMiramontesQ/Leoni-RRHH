"""
Sincroniza los catálogos de turnos y jornadas de datos-analisis (TRESS) hacia Bono
(`levelup_turnos` y `levelup_horarios`).

Es la misma función que corre el job diario de las 03:40. Sirve para la carga inicial
—`levelup_horarios` nace vacía y sin ella Ajustes Comedor no puede nombrar las jornadas—
y para forzar un refresco tras dar de alta o editar un turno en nómina.

Uso:
    docker-compose exec backend python -m app.scripts.sync_turnos_catalogo
    docker-compose exec backend python -m app.scripts.sync_turnos_catalogo --execute
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from app.services.sync_turnos_catalogo_service import (
    SyncCatalogoStats,
    sincronizar_catalogos_tress,
)


def _print_stats(resultado: list[SyncCatalogoStats], *, execute: bool) -> None:
    modo = "EXECUTE" if execute else "DRY-RUN"
    print(f"\n=== Sync catálogos TRESS → Bono [{modo}] ===")
    for stats in resultado:
        print(f"\n{stats.tabla}")
        print(f"  Filas en origen: {stats.filas_origen}")
        print(f"  Insertadas:      {stats.insertados}")
        print(f"  Actualizadas:    {stats.actualizados}")
        print(f"  Sin cambios:     {stats.omitidos}")
        if stats.ritmo_cambiado:
            # Es el único cambio capaz de mover la hora de comida de cientos de personas
            # de un día para otro sin que nadie lo pida.
            print(
                f"  AVISO: cambió el ritmo de {len(stats.ritmo_cambiado)} turno(s): "
                f"{', '.join(sorted(stats.ritmo_cambiado))}"
            )


async def ejecutar(*, execute: bool) -> int:
    from app.core.database import AsyncSessionLocal, engine

    # Con APP_ENV=development el engine nace con echo=True y el volcado de SQL sepulta el
    # resumen. Bajar el nivel del logger no basta: `echo` emite sin consultarlo.
    engine.echo = False

    try:
        async with AsyncSessionLocal() as db:
            resultado = await sincronizar_catalogos_tress(
                db, origen="manual", execute=execute
            )
    except ConnectionError as exc:
        print(f"ERROR de conexión: {exc}", file=sys.stderr)
        return 1
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    _print_stats(resultado, execute=execute)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Sincroniza los catálogos de turnos y jornadas desde datos-analisis (TRESS) "
            "hacia levelup_turnos y levelup_horarios."
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

"""
Sincroniza las incidencias de datos-analisis (TRESS) hacia Bono
(`levelup_incidencias_tress`).

Es el mismo servicio que corre el job semanal de los miércoles a las 10:00. Sirve para la
carga inicial —al desplegar, la tabla está vacía hasta la primera corrida— y para forzar
un refresco puntual.

Sin `--desde` ni `--hasta` hace la **carga inicial**, en dos pasadas contiguas:

1. el histórico congelado, hasta el domingo anterior (excluye la semana en curso);
2. la ventana viva —la misma que relee el job semanal—, que llega al horizonte futuro y
   por tanto trae lo ya capturado con fecha futura (matrimonio o paternidad registrados
   por adelantado).

Son dos porque un rango contiguo no puede excluir la semana en curso y a la vez llegar al
futuro; partirlo dejando un hueco rompería la reconciliación (lo del hueco se vería como
obsoleto). Cada pasada es una transacción propia e idempotente.

Uso:
    docker-compose exec backend python -m app.scripts.sync_incidencias_tress
    docker-compose exec backend python -m app.scripts.sync_incidencias_tress --execute
    docker-compose exec backend python -m app.scripts.sync_incidencias_tress \\
        --desde 2026-01-01 --hasta 2026-06-30 --execute
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import date

from app.core.config import settings
from app.services.sync_incidencias_tress_service import (
    SyncIncidenciasTressStats,
    rango_carga_inicial,
    rango_semanas,
    sincronizar_incidencias_tress,
)


def _fecha(valor: str) -> date:
    return date.fromisoformat(valor)


def pasadas_carga_inicial() -> list[tuple[str, date | None, date]]:
    """Las dos pasadas de la carga inicial: histórico congelado + ventana viva/futuro."""
    desde_hist, hasta_hist = rango_carga_inicial()
    desde_viva, hasta_viva = rango_semanas(settings.SYNC_INCIDENCIAS_TRESS_SEMANAS)
    return [
        ("histórico", desde_hist, hasta_hist),
        ("ventana viva + futuro", desde_viva, hasta_viva),
    ]


def _print_stats(
    stats: SyncIncidenciasTressStats, *, execute: bool, etiqueta: str | None = None
) -> None:
    modo = "EXECUTE" if execute else "DRY-RUN"
    sufijo = f" — {etiqueta}" if etiqueta else ""
    print(f"\n=== Sync incidencias TRESS → Bono [{modo}]{sufijo} ===")
    print(f"Rango:        {stats.desde or 'inicio del histórico'} → {stats.hasta}")
    print(f"Leídos:       {stats.leidos}")
    print(f"Empleados:    {stats.empleados}")
    print(f"Insertados:   {stats.insertados}")
    print(f"Actualizados: {stats.actualizados}")
    print(f"Omitidos:     {stats.omitidos}")
    print(f"Eliminados:   {stats.eliminados}")
    print(f"Errores:      {stats.errores}")
    print(f"Duración:     {stats.duracion_segundos:.2f}s")
    for mensaje in stats.mensajes_error[:10]:
        print(f"  - {mensaje}")


async def ejecutar(
    *, desde: date | None, hasta: date | None, execute: bool
) -> int:
    from app.core.database import AsyncSessionLocal, engine

    # Con APP_ENV=development el engine nace con echo=True y el volcado de SQL sepulta el
    # resumen. Bajar el nivel del logger no basta: `echo` emite sin consultarlo.
    engine.echo = False

    if desde is None and hasta is None:
        pasadas = pasadas_carga_inicial()
    else:
        pasadas = [(None, desde, hasta)]

    for etiqueta, pasada_desde, pasada_hasta in pasadas:
        try:
            async with AsyncSessionLocal() as db:
                stats = await sincronizar_incidencias_tress(
                    db,
                    desde=pasada_desde,
                    hasta=pasada_hasta,
                    origen="manual",
                    execute=execute,
                )
        except ConnectionError as exc:
            print(f"ERROR de conexión: {exc}", file=sys.stderr)
            return 1
        _print_stats(stats, execute=execute, etiqueta=etiqueta)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Sincroniza las incidencias de TRESS hacia levelup_incidencias_tress (Bono). "
            "Sin --desde ni --hasta hace la carga inicial en dos pasadas: el histórico "
            "hasta el domingo anterior y después la ventana viva (que llega al futuro)."
        )
    )
    parser.add_argument("--desde", type=_fecha, default=None, help="Fecha inicial (YYYY-MM-DD).")
    parser.add_argument("--hasta", type=_fecha, default=None, help="Fecha final (YYYY-MM-DD).")
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Persistir cambios. Sin este flag solo dry-run.",
    )
    args = parser.parse_args(argv)

    return asyncio.run(
        ejecutar(desde=args.desde, hasta=args.hasta, execute=args.execute)
    )


if __name__ == "__main__":
    sys.exit(main())

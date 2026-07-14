"""
Sincroniza FI/RE de dbo.AUSENCIA (datos-analisis) hacia importadas_historico (Bono).

Uso:
    docker-compose exec backend python -m app.scripts.sync_ausencias
    docker-compose exec backend python -m app.scripts.sync_ausencias --tipo RE --execute
    docker-compose exec backend python -m app.scripts.sync_ausencias --tipo ALL \\
        --fecha-inicio 2026-06-22 --fecha-fin 2026-07-14 --execute
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.integrations.sync_ausencias_fi_job import sync_ausencias_con_historial
from app.services.sync_ausencias_fi_service import SyncAusenciasStats

_TIPOS_VALIDOS = ("FI", "RE", "ALL")


def _hoy_app() -> date:
    return datetime.now(ZoneInfo(settings.APP_TIMEZONE)).date()


def _parse_fecha(value: str | None) -> date | None:
    if value is None:
        return None
    return date.fromisoformat(value)


def _print_stats(
    tipo: str,
    fecha_inicio: date,
    fecha_fin: date,
    stats: SyncAusenciasStats,
    *,
    execute: bool,
) -> None:
    modo = "EXECUTE" if execute else "DRY-RUN"
    rango = (
        fecha_inicio.isoformat()
        if fecha_inicio == fecha_fin
        else f"{fecha_inicio.isoformat()} .. {fecha_fin.isoformat()}"
    )
    print(f"\n=== Sync ausencias {tipo} → importadas_historico [{modo}] ===")
    print(f"Rango:  {rango} ({settings.APP_TIMEZONE})")
    print(f"Leídos:               {stats.leidos}")
    print(f"Insertados:           {stats.insertados}")
    print(f"Omitidos duplicado:   {stats.omitidos_duplicado}")
    print(f"Omitidos sin emp.:    {stats.omitidos_sin_empleado}")
    print(f"Omitidos sin semana:  {stats.omitidos_sin_semana}")
    print(f"Omitidos incompletos: {stats.omitidos_incompletos}")
    print(f"Errores:              {stats.errores}")
    for msg in stats.mensajes_error:
        print(f"  - {msg}")


def _print_totales(
    resultados: list[tuple[str, SyncAusenciasStats]],
    *,
    execute: bool,
) -> None:
    modo = "EXECUTE" if execute else "DRY-RUN"
    print("\n========================================")
    print(f" RESUMEN TOTAL [{modo}]")
    print("========================================")
    tot_leidos = tot_ins = tot_dup = tot_emp = tot_sem = tot_inc = tot_err = 0
    for tipo, s in resultados:
        print(
            f"  {tipo}: leídos={s.leidos} insertados={s.insertados} "
            f"dup={s.omitidos_duplicado} sin_emp={s.omitidos_sin_empleado} "
            f"sin_semana={s.omitidos_sin_semana} errores={s.errores}"
        )
        tot_leidos += s.leidos
        tot_ins += s.insertados
        tot_dup += s.omitidos_duplicado
        tot_emp += s.omitidos_sin_empleado
        tot_sem += s.omitidos_sin_semana
        tot_inc += s.omitidos_incompletos
        tot_err += s.errores
    print("----------------------------------------")
    print(f"  TOTAL leídos:           {tot_leidos}")
    print(f"  TOTAL insertados:       {tot_ins}")
    print(f"  TOTAL duplicados:       {tot_dup}")
    print(f"  TOTAL sin empleado:     {tot_emp}")
    print(f"  TOTAL sin semana:       {tot_sem}")
    print(f"  TOTAL incompletos:      {tot_inc}")
    print(f"  TOTAL errores:          {tot_err}")
    print("  Historial BD:          levelup_bono_historico_import_log")
    print("========================================\n")


async def ejecutar_sincronizacion(
    *,
    fecha_inicio: date,
    fecha_fin: date,
    execute: bool,
    tipo: str,
) -> int:
    if fecha_fin < fecha_inicio:
        print(
            f"ERROR: fecha-fin ({fecha_fin}) no puede ser anterior a "
            f"fecha-inicio ({fecha_inicio})",
            file=sys.stderr,
        )
        return 2

    tipos = ("FI", "RE") if tipo == "ALL" else (tipo.upper(),)
    resultados = await sync_ausencias_con_historial(
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        tipos=tipos,  # type: ignore[arg-type]
        execute=execute,
        origen_ejecucion="manual",
    )
    for t, stats in resultados:
        _print_stats(t, fecha_inicio, fecha_fin, stats, execute=execute)
    _print_totales(resultados, execute=execute)
    errores = sum(s.errores for _, s in resultados)
    return 1 if errores else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Sincroniza FI/RE de dbo.AUSENCIA hacia importadas_historico."
    )
    parser.add_argument(
        "--fecha",
        type=str,
        default=None,
        help="Día único (YYYY-MM-DD). Ignorado si usas --fecha-inicio/--fecha-fin.",
    )
    parser.add_argument(
        "--fecha-inicio",
        type=str,
        default=None,
        help="Inicio del rango (YYYY-MM-DD). Default: --fecha o hoy.",
    )
    parser.add_argument(
        "--fecha-fin",
        type=str,
        default=None,
        help="Fin del rango (YYYY-MM-DD). Default: --fecha o hoy.",
    )
    parser.add_argument(
        "--tipo",
        type=str,
        default="ALL",
        choices=_TIPOS_VALIDOS,
        help="FI, RE o ALL (default). RE inserta siempre inc_id=8.",
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Persistir inserts. Sin este flag solo dry-run.",
    )
    args = parser.parse_args(argv)

    fecha_unica = _parse_fecha(args.fecha)
    fecha_inicio = _parse_fecha(args.fecha_inicio)
    fecha_fin = _parse_fecha(args.fecha_fin)

    if fecha_inicio is None and fecha_fin is None:
        dia = fecha_unica or _hoy_app()
        fecha_inicio = dia
        fecha_fin = dia
    else:
        if fecha_inicio is None:
            fecha_inicio = fecha_unica or _hoy_app()
        if fecha_fin is None:
            fecha_fin = fecha_unica or _hoy_app()

    return asyncio.run(
        ejecutar_sincronizacion(
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            execute=args.execute,
            tipo=args.tipo,
        )
    )


if __name__ == "__main__":
    sys.exit(main())

"""
Importación masiva de saldos de vacaciones desde Excel.

Columnas esperadas: no_empleado, Nombre, Disponible

Uso:
    python -m app.utils.seed_vacaciones_disponibles                       # dry-run
    python -m app.utils.seed_vacaciones_disponibles --execute             # ejecutar
    python -m app.utils.seed_vacaciones_disponibles --file path/to.xlsx   # archivo custom
"""

from __future__ import annotations

import argparse
import asyncio
from pathlib import Path

import openpyxl
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.empleados import Empleado
from app.models.vacaciones_disponibles import VacacionesDisponibles

DEFAULT_FILE = (
    Path(__file__).resolve().parent.parent.parent
    / "data"
    / "vacaciones_disponibles_marzo_2022.xlsx"
)


def parse_excel(filepath: Path) -> list[tuple[int, int]]:
    wb = openpyxl.load_workbook(filepath, data_only=True, read_only=True)
    ws = wb.active
    rows: list[tuple[int, int]] = []

    for idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not row or row[0] is None:
            continue
        try:
            no_empleado = int(row[0])
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Fila {idx}: no_empleado inválido: {row[0]!r}") from exc

        dias_raw = row[2] if len(row) > 2 else None
        if dias_raw is None:
            continue
        try:
            dias = int(dias_raw)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Fila {idx}: dias inválido: {dias_raw!r}") from exc

        rows.append((no_empleado, dias))

    wb.close()
    return rows


async def import_vacaciones(
    records: list[tuple[int, int]],
    execute: bool,
    skip_missing: bool,
) -> dict[str, int | list[int]]:
    stats: dict[str, int | list[int]] = {
        "created": 0,
        "updated": 0,
        "skipped": 0,
        "missing_empleado": 0,
        "missing_no_empleado_list": [],
    }

    if not execute:
        print(
            f"\n[DRY-RUN] Se procesarían {len(records)} registros. "
            "Use --execute para aplicar."
        )
        return stats

    async with AsyncSessionLocal() as session:
        empleados_result = await session.execute(select(Empleado.no_empleado))
        empleados_validos = set(empleados_result.scalars().all())

        for no_empleado, dias in records:
            if no_empleado not in empleados_validos:
                stats["missing_empleado"] = int(stats["missing_empleado"]) + 1
                missing_list = stats["missing_no_empleado_list"]
                assert isinstance(missing_list, list)
                if len(missing_list) < 20:
                    missing_list.append(no_empleado)
                if skip_missing:
                    continue

            result = await session.execute(
                select(VacacionesDisponibles).where(
                    VacacionesDisponibles.no_empleado == no_empleado
                )
            )
            existing = result.scalar_one_or_none()

            if existing is None:
                session.add(VacacionesDisponibles(no_empleado=no_empleado, dias=dias))
                stats["created"] = int(stats["created"]) + 1
            elif existing.dias != dias:
                existing.dias = dias
                stats["updated"] = int(stats["updated"]) + 1
            else:
                stats["skipped"] = int(stats["skipped"]) + 1

        await session.commit()

    return stats


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Importar saldos de vacaciones disponibles desde Excel"
    )
    parser.add_argument("--file", type=str, default=str(DEFAULT_FILE), help="Ruta al Excel")
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Ejecutar la importación (sin esto es dry-run)",
    )
    parser.add_argument(
        "--fail-on-missing",
        action="store_true",
        help="Fallar si hay no_empleado inexistentes en empleados (default: omitirlos)",
    )
    args = parser.parse_args()

    filepath = Path(args.file)
    if not filepath.exists():
        print(f"ERROR: Archivo no encontrado: {filepath}")
        return

    print(f"Leyendo: {filepath}")
    records = parse_excel(filepath)
    print(f"Registros en Excel: {len(records)}")

    negativos = sum(1 for _, dias in records if dias < 0)
    if negativos:
        print(f"  Con saldo negativo: {negativos}")

    stats = asyncio.run(
        import_vacaciones(
            records,
            execute=args.execute,
            skip_missing=not args.fail_on_missing,
        )
    )

    if args.execute:
        print("\nResultados:")
        print(f"  Creados: {stats['created']}")
        print(f"  Actualizados: {stats['updated']}")
        print(f"  Sin cambios: {stats['skipped']}")
        print(f"  Sin empleado en BD: {stats['missing_empleado']}")
        missing_list = stats["missing_no_empleado_list"]
        if isinstance(missing_list, list) and missing_list:
            print(f"  Ejemplos omitidos: {missing_list}")


if __name__ == "__main__":
    main()

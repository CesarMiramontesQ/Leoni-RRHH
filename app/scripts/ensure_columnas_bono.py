"""Asegura las columnas que este proyecto necesita en tablas propias de Bono.

`importadas_historico` es del esquema de Bono, no lleva prefijo `levelup_`, y por eso
sus columnas **no** pueden viajar en una migración Alembic (ver CLAUDE.md). Pero el
INSERT del módulo de faltas y retardos las escribe, así que si faltan en el destino se
cae tanto el sync como el registro manual de RH.

Este script cubre ese hueco: es la excepción acotada y explícita a la regla, limitada a
una lista cerrada de columnas aditivas y nullables. No crea tablas, no las altera de otro
modo y no borra nada.

    python -m app.scripts.ensure_columnas_bono           # crea las que falten
    python -m app.scripts.ensure_columnas_bono --check   # solo reporta (exit 1 si falta)
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from dataclasses import dataclass

from sqlalchemy import text

from app.core.database import AsyncSessionLocal


@dataclass(frozen=True)
class ColumnaExterna:
    tabla: str
    columna: str
    tipo: str
    motivo: str


# Lista cerrada. Añadir aquí exige la misma autorización que cualquier cambio al esquema
# de Bono: son tablas de las que este proyecto no es dueño.
COLUMNAS_REQUERIDAS: tuple[ColumnaExterna, ...] = (
    ColumnaExterna(
        "importadas_historico",
        "estado",
        "integer",
        "el mirror de faltas y retardos marca con 1 lo que inserta",
    ),
    ColumnaExterna(
        "importadas_historico",
        "semana_incidencia",
        "integer",
        "semana de semana_historico a la que corresponde el evento",
    ),
)


async def _existe(db, tabla: str, columna: str) -> bool:
    fila = await db.execute(
        text(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = :tabla AND column_name = :columna
            """
        ),
        {"tabla": tabla, "columna": columna},
    )
    return fila.scalar() is not None


async def _tabla_existe(db, tabla: str) -> bool:
    fila = await db.execute(
        text("SELECT to_regclass(:tabla)"), {"tabla": f"public.{tabla}"}
    )
    return fila.scalar() is not None


async def ejecutar(*, solo_check: bool) -> int:
    faltantes: list[ColumnaExterna] = []
    creadas: list[ColumnaExterna] = []

    async with AsyncSessionLocal() as db:
        for col in COLUMNAS_REQUERIDAS:
            if not await _tabla_existe(db, col.tabla):
                # Sin la tabla no hay nada que asegurar: es una BD que no es Bono.
                print(f"  omitido  {col.tabla}.{col.columna} (la tabla no existe)")
                continue
            if await _existe(db, col.tabla, col.columna):
                print(f"  ok       {col.tabla}.{col.columna}")
                continue
            if solo_check:
                faltantes.append(col)
                print(f"  FALTA    {col.tabla}.{col.columna} — {col.motivo}")
                continue
            await db.execute(
                text(
                    f"ALTER TABLE {col.tabla} "
                    f"ADD COLUMN IF NOT EXISTS {col.columna} {col.tipo}"
                )
            )
            creadas.append(col)
            print(f"  CREADA   {col.tabla}.{col.columna} {col.tipo} — {col.motivo}")
        if creadas:
            await db.commit()

    if faltantes:
        print(f"\n{len(faltantes)} columna(s) faltante(s).", file=sys.stderr)
        print(
            "Corre `python -m app.scripts.ensure_columnas_bono` para crearlas.",
            file=sys.stderr,
        )
        return 1
    if creadas:
        print(f"\n{len(creadas)} columna(s) creada(s).")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Solo reporta; no altera nada. Sale con 1 si falta alguna.",
    )
    args = parser.parse_args(argv)
    print("=== Columnas requeridas en tablas de Bono ===")
    return asyncio.run(ejecutar(solo_check=args.check))


if __name__ == "__main__":
    raise SystemExit(main())

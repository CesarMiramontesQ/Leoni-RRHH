"""
Importación masiva de cursos desde el Excel "Cursos - Masivo.xlsx".

Extrae nombres únicos de cursos y calcula tipo/clasificacion/obligatorio/horas
a partir de la moda y mediana de los registros históricos.

Uso:
    python -m app.utils.seed_cursos_catalogo                       # dry-run
    python -m app.utils.seed_cursos_catalogo --execute             # ejecutar
    python -m app.utils.seed_cursos_catalogo --file path/to.xlsx   # archivo custom
"""

import argparse
import asyncio
import statistics
from collections import Counter
from pathlib import Path

import openpyxl
from sqlalchemy import func, select

from app.core.database import AsyncSessionLocal
from app.models.level_up import Curso


DEFAULT_FILE = Path(__file__).resolve().parent.parent.parent / "Cursos - Masivo.xlsx"


def parse_excel(filepath: Path) -> dict[str, list[dict]]:
    """Lee el Excel y agrupa rows por nombre de curso."""
    wb = openpyxl.load_workbook(filepath, data_only=True, read_only=True)
    ws = wb.active

    cursos: dict[str, list[dict]] = {}
    for idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not row or not row[3]:
            continue
        nombre = str(row[3]).strip()
        if not nombre:
            continue

        record = {
            "horas": row[5] if row[5] is not None else None,
            "tipo": str(row[7]).strip().lower() if row[7] else None,
            "clasificacion": str(row[8]).strip().lower() if row[8] else None,
            "obligatorio": str(row[9]).strip().lower() if row[9] else None,
        }
        cursos.setdefault(nombre, []).append(record)

    wb.close()
    return cursos


def compute_mode(values: list[str | None]) -> str | None:
    """Retorna la moda de una lista, ignorando Nones."""
    filtered = [v for v in values if v]
    if not filtered:
        return None
    counter = Counter(filtered)
    return counter.most_common(1)[0][0]


def compute_median_horas(records: list[dict]) -> float | None:
    """Retorna la mediana de horas, ignorando Nones y no numéricos."""
    horas = []
    for r in records:
        h = r.get("horas")
        if h is not None:
            try:
                val = float(h)
                if val > 0:
                    horas.append(val)
            except (ValueError, TypeError):
                pass
    if not horas:
        return None
    return round(statistics.median(horas), 2)


def build_catalog(grouped: dict[str, list[dict]]) -> list[dict]:
    """Construye la lista de cursos a insertar."""
    catalog = []
    for nombre, records in grouped.items():
        tipos = [r["tipo"] for r in records]
        clasificaciones = [r["clasificacion"] for r in records]
        obligatorios = [r["obligatorio"] for r in records]

        tipo_mode = compute_mode(tipos)
        if tipo_mode and tipo_mode not in ("interno", "externo"):
            tipo_mode = None

        clasif_mode = compute_mode(clasificaciones)
        if clasif_mode and clasif_mode not in ("adicional", "contemplado"):
            clasif_mode = None

        oblig_mode = compute_mode(obligatorios)
        obligatorio = oblig_mode in ("si", "sí", "yes", "true", "1") if oblig_mode else False

        catalog.append({
            "nombre": nombre,
            "duracion_horas": compute_median_horas(records),
            "tipo": tipo_mode,
            "clasificacion": clasif_mode,
            "obligatorio": obligatorio,
        })
    return catalog


async def import_cursos(catalog: list[dict], execute: bool) -> dict:
    """Inserta o actualiza cursos en la BD."""
    stats = {"created": 0, "updated": 0, "skipped": 0, "errors": 0}

    if not execute:
        print(f"\n[DRY-RUN] Se procesarían {len(catalog)} cursos. Use --execute para aplicar.")
        return stats

    async with AsyncSessionLocal() as session:
        for entry in catalog:
            try:
                result = await session.execute(
                    select(Curso).where(func.lower(Curso.nombre) == entry["nombre"].lower())
                )
                existing = result.scalar_one_or_none()

                if existing:
                    changed = False
                    if entry["duracion_horas"] and existing.duracion_horas != entry["duracion_horas"]:
                        existing.duracion_horas = entry["duracion_horas"]
                        changed = True
                    if entry["tipo"] and (not existing.tipo or existing.tipo.value != entry["tipo"]):
                        existing.tipo = entry["tipo"]
                        changed = True
                    if entry["clasificacion"] and (not existing.clasificacion or existing.clasificacion.value != entry["clasificacion"]):
                        existing.clasificacion = entry["clasificacion"]
                        changed = True
                    if existing.obligatorio != entry["obligatorio"]:
                        existing.obligatorio = entry["obligatorio"]
                        changed = True

                    if changed:
                        stats["updated"] += 1
                    else:
                        stats["skipped"] += 1
                else:
                    nuevo = Curso(
                        nombre=entry["nombre"],
                        duracion_horas=entry["duracion_horas"],
                        tipo=entry["tipo"],
                        clasificacion=entry["clasificacion"],
                        obligatorio=entry["obligatorio"],
                        activo=True,
                    )
                    session.add(nuevo)
                    stats["created"] += 1

            except Exception as e:
                stats["errors"] += 1
                print(f"  ERROR '{entry['nombre']}': {e}")

        await session.commit()

    return stats


def main():
    parser = argparse.ArgumentParser(description="Importar catalogo de cursos desde Excel")
    parser.add_argument("--file", type=str, default=str(DEFAULT_FILE), help="Ruta al archivo Excel")
    parser.add_argument("--execute", action="store_true", help="Ejecutar la importacion (sin esto es dry-run)")
    args = parser.parse_args()

    filepath = Path(args.file)
    if not filepath.exists():
        print(f"ERROR: Archivo no encontrado: {filepath}")
        return

    print(f"Leyendo: {filepath}")
    grouped = parse_excel(filepath)
    print(f"Cursos unicos encontrados: {len(grouped)}")

    catalog = build_catalog(grouped)

    # Stats preview
    con_tipo = sum(1 for c in catalog if c["tipo"])
    con_clasif = sum(1 for c in catalog if c["clasificacion"])
    obligatorios = sum(1 for c in catalog if c["obligatorio"])
    print(f"  Con tipo: {con_tipo}")
    print(f"  Con clasificacion: {con_clasif}")
    print(f"  Obligatorios: {obligatorios}")

    stats = asyncio.run(import_cursos(catalog, execute=args.execute))

    if args.execute:
        print(f"\nResultados:")
        print(f"  Creados: {stats['created']}")
        print(f"  Actualizados: {stats['updated']}")
        print(f"  Sin cambios: {stats['skipped']}")
        print(f"  Errores: {stats['errors']}")


if __name__ == "__main__":
    main()

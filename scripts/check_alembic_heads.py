#!/usr/bin/env python3
"""Falla si Alembic tiene más de un head (revisiones sin sucesor).

Uso:
  python3 scripts/check_alembic_heads.py
  docker compose exec backend python scripts/check_alembic_heads.py
"""
from __future__ import annotations

import re
import sys
from collections import defaultdict
from pathlib import Path

VERSIONS_DIR = Path(__file__).resolve().parent.parent / "alembic" / "versions"


def _parse_revisions() -> tuple[dict[str, list[str]], dict[str, str]]:
    parents_by_rev: dict[str, list[str]] = {}
    files_by_rev: dict[str, str] = {}

    for path in sorted(VERSIONS_DIR.glob("*.py")):
        text = path.read_text(encoding="utf-8")
        rev_m = re.search(r"^revision\s*[:=].*?['\"]([^'\"]+)['\"]", text, re.M)
        if not rev_m:
            continue
        rev = rev_m.group(1)
        files_by_rev[rev] = path.name

        if "down_revision" not in text:
            parents_by_rev[rev] = []
            continue

        block = text[text.find("down_revision") : text.find("branch_labels")]
        parents = re.findall(r"['\"]([^'\"]+)['\"]", block)
        parents_by_rev[rev] = [p for p in parents if p != rev]

    return parents_by_rev, files_by_rev


def main() -> int:
    if not VERSIONS_DIR.is_dir():
        print(f"No existe {VERSIONS_DIR}", file=sys.stderr)
        return 1

    parents_by_rev, files_by_rev = _parse_revisions()

    rev_to_files: dict[str, list[str]] = defaultdict(list)
    for rev, filename in files_by_rev.items():
        rev_to_files[rev].append(filename)
    dupes = {rev: names for rev, names in rev_to_files.items() if len(names) > 1}
    if dupes:
        print(f"ERROR: {len(dupes)} revision(es) duplicada(s) en Alembic:", file=sys.stderr)
        for rev, names in sorted(dupes.items()):
            print(f"  - {rev}: {', '.join(names)}", file=sys.stderr)
        return 1

    children: dict[str, list[str]] = defaultdict(list)
    for rev, parents in parents_by_rev.items():
        for parent in parents:
            children[parent].append(rev)

    heads = sorted(rev for rev in parents_by_rev if rev not in children)
    if len(heads) == 1:
        head = heads[0]
        print(f"OK: un solo head ({head} — {files_by_rev.get(head, '?')})")
        return 0

    print(f"ERROR: {len(heads)} heads de Alembic (se esperaba 1):", file=sys.stderr)
    for head in heads:
        print(f"  - {head} ({files_by_rev.get(head, '?')})", file=sys.stderr)
    print(
        "\nCrea una migración merge con: alembic merge -m 'descripcion' <rev1> <rev2>",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())

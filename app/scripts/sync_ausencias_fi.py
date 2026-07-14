"""
Compat: sincroniza FI de dbo.AUSENCIA hacia importadas_historico.

Preferir: python -m app.scripts.sync_ausencias --tipo FI
"""

from __future__ import annotations

import sys

from app.scripts.sync_ausencias import main as sync_main


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if "--tipo" not in args:
        args = ["--tipo", "FI", *args]
    return sync_main(args)


if __name__ == "__main__":
    sys.exit(main())

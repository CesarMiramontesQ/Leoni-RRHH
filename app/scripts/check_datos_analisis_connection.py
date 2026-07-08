"""
Comprueba la conexión de solo lectura a SQL Server datos-analisis sin usar DATABASE_URL.

    docker-compose exec backend python -m app.scripts.check_datos_analisis_connection
"""

from __future__ import annotations

import asyncio

from app.integrations.datos_analisis_db import DatosAnalisisReadClient


async def _main() -> int:
    ok, message = await DatosAnalisisReadClient.run_connection_self_test()
    print(message)
    return 0 if ok else 1


def main() -> None:
    raise SystemExit(asyncio.run(_main()))


if __name__ == "__main__":
    main()

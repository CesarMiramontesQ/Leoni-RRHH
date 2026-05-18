"""
Comprueba la segunda base PostgreSQL (bono_productividad) sin usar DATABASE_URL.

    docker-compose exec backend python -m app.scripts.check_bono_productividad_connection
"""

from __future__ import annotations

import asyncio

from app.integrations.bono_productividad_db import BonoProductividadReadClient


async def _main() -> int:
    ok, message = await BonoProductividadReadClient.run_connection_self_test()
    print(message)
    return 0 if ok else 1


def main() -> None:
    raise SystemExit(asyncio.run(_main()))


if __name__ == "__main__":
    main()

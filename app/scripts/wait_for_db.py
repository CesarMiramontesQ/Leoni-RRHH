"""Espera y valida la conexión a PostgreSQL externo antes del arranque en producción."""
from __future__ import annotations

import logging
import os
import sys
import time

import psycopg2

from app.core.config import settings

logger = logging.getLogger(__name__)


def _sync_dsn() -> str:
    url = settings.DATABASE_URL
    return url.replace("postgresql+asyncpg://", "postgresql://").replace(
        "postgresql+asyncpg+", "postgresql+"
    )


def wait_for_db(max_retries: int = 30, delay_seconds: float = 2.0) -> None:
    dsn = _sync_dsn()
    last_error: Exception | None = None

    for attempt in range(1, max_retries + 1):
        try:
            with psycopg2.connect(dsn, connect_timeout=5) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1")
                    cur.fetchone()
            logger.info(
                "Conexión a PostgreSQL verificada (intento %d/%d)",
                attempt,
                max_retries,
            )
            return
        except Exception as exc:
            last_error = exc
            logger.warning(
                "PostgreSQL no disponible (intento %d/%d): %s",
                attempt,
                max_retries,
                exc,
            )
            if attempt < max_retries:
                time.sleep(delay_seconds)

    logger.error("No se pudo conectar a PostgreSQL después de %d intentos", max_retries)
    if last_error:
        raise last_error
    sys.exit(1)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s",
    )
    wait_for_db(
        max_retries=int(os.getenv("DB_WAIT_MAX_RETRIES", "30")),
        delay_seconds=float(os.getenv("DB_WAIT_DELAY_SECONDS", "2")),
    )

from __future__ import annotations

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


def normalizar_url_y_connect_args(url: str) -> tuple[str, dict]:
    """
    Normaliza parámetros de conexión para URLs asyncpg.

    asyncpg no acepta `sslmode` como kwarg directo. Si viene en el query string,
    se remueve de la URL y se mapea a `connect_args["ssl"]`.
    """
    if "postgresql+asyncpg://" not in url:
        return url, {}

    parsed = urlsplit(url)
    query_params = parse_qsl(parsed.query, keep_blank_values=True)

    connect_args: dict = {}
    rebuilt_query: list[tuple[str, str]] = []

    for key, value in query_params:
        if key.lower() != "sslmode":
            rebuilt_query.append((key, value))
            continue

        mode = value.strip().lower()
        # `disable` => sin TLS; cualquier otro modo activa TLS en asyncpg.
        connect_args["ssl"] = mode != "disable"

    new_query = urlencode(rebuilt_query, doseq=True)
    sanitized_url = urlunsplit(
        (parsed.scheme, parsed.netloc, parsed.path, new_query, parsed.fragment)
    )

    return sanitized_url, connect_args

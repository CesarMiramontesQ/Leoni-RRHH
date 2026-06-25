from __future__ import annotations

from urllib.parse import parse_qsl, quote_plus, urlencode, urlsplit, urlunsplit


def build_asyncpg_url(
    host: str,
    port: int | str,
    name: str,
    user: str,
    password: str,
    engine: str = "postgresql",
) -> str | None:
    """
    Arma la URL asyncpg desde componentes individuales (host, puerto, BD, usuario,
    contraseña). Función pura sin dependencia de `config`, reutilizable desde
    `app.core.config` y el cliente de lectura de Bono.

    Devuelve ``None`` si faltan datos mínimos (host, nombre o usuario), de modo que
    el llamador decida el fallback. Aplica ``quote_plus`` a usuario y contraseña para
    soportar caracteres especiales (`@`, `:`, `/`).
    """
    if not (host and name and user):
        return None
    eng = (engine or "postgresql").strip().lower()
    if eng not in ("postgresql", "postgres"):
        raise ValueError(
            "BONO_DB_ENGINE debe ser 'postgresql' o 'postgres'; "
            f"recibido: {engine!r}"
        )
    return (
        f"postgresql+asyncpg://{quote_plus(user)}:{quote_plus(password)}"
        f"@{host.strip()}:{int(port)}/{name.strip()}"
    )


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

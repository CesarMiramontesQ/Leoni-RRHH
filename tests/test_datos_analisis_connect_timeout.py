"""La conexión a datos-analisis debe rendirse rápido cuando TRESS no responde.

Sin acotar el login aplica el default del driver (15 s), y el sync que llena
`levelup_homeoffice_tomados` y `levelup_vacaciones_disponibles` se quedaba
esperando ese tiempo completo por cada empleado.

Ojo con el mecanismo: el driver **ignora** `Connection Timeout=N` dentro de la
cadena ODBC (medido: tarda los 15 s igual). El que se respeta es `timeout` en
`connect_args`, que llega a `pyodbc.connect()` (medido: 3 s con valor 3). Por eso
estos tests afirman sobre `connect_args` y no sobre la URL.
"""

from unittest.mock import patch

from app.core.config import settings
from app.core.db_engine_utils import (
    DEFAULT_MSSQL_CONNECT_TIMEOUT,
    build_mssql_aioodbc_url,
    mssql_connect_args,
)
from app.integrations.datos_analisis_db import DatosAnalisisReadClient


def test_connect_args_acota_el_login():
    assert mssql_connect_args(5) == {"timeout": 5}


def test_connect_args_por_defecto_es_corto():
    assert 0 < DEFAULT_MSSQL_CONNECT_TIMEOUT <= 10
    assert mssql_connect_args()["timeout"] == DEFAULT_MSSQL_CONNECT_TIMEOUT


def test_connect_args_nunca_deja_timeout_cero():
    """Un 0 significa "esperar indefinidamente" en ODBC: justo lo que se evita."""
    assert mssql_connect_args(0)["timeout"] == 1
    assert mssql_connect_args(-3)["timeout"] == 1


def _con_datos_analisis_configurado(monkeypatch, timeout: int) -> None:
    monkeypatch.setattr(settings, "DATOS_ANALISIS_DB_HOST", "srv")
    monkeypatch.setattr(settings, "DATOS_ANALISIS_DB_NAME", "db")
    monkeypatch.setattr(settings, "DATOS_ANALISIS_DB_USER", "u")
    monkeypatch.setattr(settings, "DATOS_ANALISIS_DB_PASSWORD", "p")
    monkeypatch.setattr(settings, "DATOS_ANALISIS_DB_CONNECT_TIMEOUT", timeout)


def test_read_engine_pasa_el_timeout_configurado(monkeypatch):
    _con_datos_analisis_configurado(monkeypatch, 4)
    with patch("app.integrations.datos_analisis_db.create_async_engine") as mock_engine:
        DatosAnalisisReadClient.create_read_engine()
    assert mock_engine.call_args.kwargs["connect_args"] == {"timeout": 4}


def test_write_engine_tambien_pasa_el_timeout(monkeypatch):
    """La escritura a TRESS no debe colgarse más que la lectura."""
    _con_datos_analisis_configurado(monkeypatch, 6)
    with patch("app.integrations.datos_analisis_db.create_async_engine") as mock_engine:
        DatosAnalisisReadClient.create_write_engine()
    kwargs = mock_engine.call_args.kwargs
    assert kwargs["connect_args"] == {"timeout": 6}
    assert kwargs["isolation_level"] == "AUTOCOMMIT"


def test_la_url_no_lleva_connection_timeout():
    """Está en connect_args a propósito: en la cadena el driver lo ignora."""
    url = build_mssql_aioodbc_url(host="srv", port=1433, name="db", user="u", password="p")
    assert url is not None
    assert "Connection+Timeout" not in url and "Connection%20Timeout" not in url


def test_sigue_devolviendo_none_sin_configuracion():
    assert build_mssql_aioodbc_url(host="", port=1433, name="", user="", password="") is None

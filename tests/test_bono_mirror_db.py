"""Override opcional BONO_MIRROR_DB_NAME para el mirror FI/RE (job miércoles 08:30).

La app puede vivir en prueba_bono y el sync de importadas_historico escribir
en bono_productividad. Host/usuario/contraseña se reusan de BONO_DB_*.
"""

from unittest.mock import patch

from app.core.config import settings
from app.integrations.bono_productividad_db import BonoProductividadReadClient


def _con_bono_configurado(monkeypatch, *, name: str = "prueba_bono") -> None:
    monkeypatch.setattr(settings, "BONO_DB_HOST", "pg.local")
    monkeypatch.setattr(settings, "BONO_DB_PORT", 5432)
    monkeypatch.setattr(settings, "BONO_DB_NAME", name)
    monkeypatch.setattr(settings, "BONO_DB_USER", "bono_user")
    monkeypatch.setattr(settings, "BONO_DB_PASSWORD", "secret")
    monkeypatch.setattr(settings, "BONO_DB_ENGINE", "postgresql")
    monkeypatch.setattr(settings, "BONO_MIRROR_DB_NAME", "")


def test_mirror_url_cae_a_bono_db_name_si_no_hay_override(monkeypatch):
    _con_bono_configurado(monkeypatch)
    url = BonoProductividadReadClient.build_mirror_async_database_url()
    assert url is not None
    assert url.endswith("/prueba_bono")
    assert url == BonoProductividadReadClient.build_async_database_url()


def test_mirror_url_usa_bono_mirror_db_name(monkeypatch):
    _con_bono_configurado(monkeypatch)
    monkeypatch.setattr(settings, "BONO_MIRROR_DB_NAME", "bono_productividad")
    url = BonoProductividadReadClient.build_mirror_async_database_url()
    assert url is not None
    assert url.endswith("/bono_productividad")
    assert "/prueba_bono" not in url
    lectura = BonoProductividadReadClient.build_async_database_url()
    assert lectura is not None
    assert lectura.endswith("/prueba_bono")


def test_mirror_url_ignora_nombre_en_blanco(monkeypatch):
    _con_bono_configurado(monkeypatch)
    monkeypatch.setattr(settings, "BONO_MIRROR_DB_NAME", "  ")
    url = BonoProductividadReadClient.build_mirror_async_database_url()
    assert url is not None
    assert url.endswith("/prueba_bono")


def test_create_mirror_engine_apunta_al_override(monkeypatch):
    _con_bono_configurado(monkeypatch)
    monkeypatch.setattr(settings, "BONO_MIRROR_DB_NAME", "bono_productividad")
    with patch("app.integrations.bono_productividad_db.create_async_engine") as mock_engine:
        BonoProductividadReadClient.create_mirror_engine()
    url = mock_engine.call_args.args[0]
    assert "/bono_productividad" in url
    assert "/prueba_bono" not in url

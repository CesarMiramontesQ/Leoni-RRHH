import pytest

from app.core.config import Settings


def test_estados_activos_ids_default():
    settings = Settings()
    assert isinstance(settings.ESTADOS_ACTIVOS_IDS, list)
    assert 1 in settings.ESTADOS_ACTIVOS_IDS


@pytest.mark.parametrize(
    ("env_name", "env_value", "expected"),
    [
        ("ESTADOS_ACTIVOS_IDS", "1", [1]),
        ("ESTADOS_ACTIVOS_IDS", "1,5,7", [1, 5, 7]),
        ("ESTADOS_ACTIVOS_IDS", "[1,5]", [1, 5]),
        ("ESTADOS_PERMISO_IDS", "3", [3]),
        ("ESTADOS_PERMISO_IDS", "3,4", [3, 4]),
    ],
)
def test_estado_ids_from_env(monkeypatch, env_name, env_value, expected):
    monkeypatch.delenv("ESTADOS_ACTIVOS_IDS", raising=False)
    monkeypatch.delenv("ESTADOS_PERMISO_IDS", raising=False)
    monkeypatch.setenv(env_name, env_value)
    settings = Settings()
    assert getattr(settings, env_name) == expected


def test_estado_ids_scalar_int_before_validation():
    assert Settings._parse_estado_ids(1, [1]) == [1]
    assert Settings._parse_estado_ids(3, [3]) == [3]

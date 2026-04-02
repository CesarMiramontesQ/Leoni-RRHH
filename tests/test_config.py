def test_estados_activos_ids_default():
    from app.core.config import settings

    assert isinstance(settings.ESTADOS_ACTIVOS_IDS, list)
    assert 1 in settings.ESTADOS_ACTIVOS_IDS

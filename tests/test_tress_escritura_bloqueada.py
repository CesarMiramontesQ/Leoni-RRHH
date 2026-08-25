"""Con TRESS_ESCRITURA_BLOQUEADA la app sigue en local y no abre TRESS."""

from datetime import date

import pytest


def _boom_engine():
    raise AssertionError("create_write_engine no debe llamarse con escritura bloqueada")


@pytest.mark.asyncio
async def test_vacaciones_bloqueadas_sin_conectar(monkeypatch):
    from app.services import tress_vacaciones_service as svc

    monkeypatch.setattr(
        svc.DatosAnalisisWriteClient,
        "create_write_engine",
        staticmethod(_boom_engine),
    )
    monkeypatch.setattr(svc.settings, "TRESS_ESCRITURA_BLOQUEADA", True)

    result = await svc.registrar_vacaciones_en_tress(
        no_empleado=1,
        fecha_inicio=date(2026, 7, 15),
        fecha_fin=date(2026, 7, 17),
        dias_gozo=3,
    )
    assert result.ok is True
    assert result.nueva_llave is None


@pytest.mark.asyncio
async def test_home_office_bloqueado_sin_conectar(monkeypatch):
    from app.services import tress_home_office_service as svc

    monkeypatch.setattr(
        svc.DatosAnalisisWriteClient,
        "create_write_engine",
        staticmethod(_boom_engine),
    )
    monkeypatch.setattr(svc.settings, "TRESS_ESCRITURA_BLOQUEADA", True)

    result = await svc.registrar_home_office_en_tress(
        no_empleado=1,
        fecha_inicio=date(2026, 7, 20),
        fecha_fin=date(2026, 7, 21),
    )
    assert result.ok is True
    assert result.nueva_llave is None


@pytest.mark.asyncio
async def test_suspension_bloqueada_sin_conectar(monkeypatch):
    from app.services import tress_suspension_service as svc

    monkeypatch.setattr(
        svc.DatosAnalisisWriteClient,
        "create_write_engine",
        staticmethod(_boom_engine),
    )
    monkeypatch.setattr(svc.settings, "TRESS_ESCRITURA_BLOQUEADA", True)

    result = await svc.registrar_suspension_en_tress(
        no_empleado=1,
        fecha_inicio=date(2026, 7, 20),
        fecha_fin=date(2026, 7, 22),
        comentario="PRUEBA BLOQUEO",
    )
    assert result.ok is True
    assert result.nueva_llave is None


@pytest.mark.asyncio
async def test_goce_bloqueado_sin_conectar(monkeypatch):
    from app.services import tress_goce_service as svc

    monkeypatch.setattr(
        svc.DatosAnalisisWriteClient,
        "create_write_engine",
        staticmethod(_boom_engine),
    )
    monkeypatch.setattr(svc.settings, "TRESS_ESCRITURA_BLOQUEADA", True)

    result = await svc.registrar_permiso_goce_en_tress(
        no_empleado=1,
        fecha_inicio=date(2026, 5, 4),
        fecha_fin=date(2026, 5, 5),
        comentario="MATRIMONIO",
    )
    assert result.ok is True
    assert result.nueva_llave is None

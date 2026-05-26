"""Tests de validación y sync de empleados desde bono."""

import pytest
from sqlalchemy import select

from app.integrations.bono_empleados_sync import (
    BonoEmpleadosSyncService,
    validar_fila_empleado_bono,
)
from app.integrations.bono_empleados_import import importar_bono_empleados_job
from app.models.bono_historico_import_log import BonoHistoricoImportLog
from app.models.empleados import Empleado
from tests.conftest import make_empleado


def test_validar_fila_empleado_bono_ok():
    payload, err = validar_fila_empleado_bono(
        {
            "empleado_id": 1001,
            "no_empleado": "12345",
            "nombre": "Juan Pérez",
            "email": "no-debe-importarse@bono.com",
            "rol_id": 99,
            "password": "$2b$12$hashdesdebono",
        }
    )
    assert err is None
    assert payload is not None
    assert payload["empleado_id"] == 1001
    assert payload["no_empleado"] == "12345"
    assert payload["password_hash"] == "$2b$12$hashdesdebono"
    assert "email" not in payload
    assert "rol_id" not in payload


def test_validar_fila_empleado_bono_sin_empleado_id():
    payload, err = validar_fila_empleado_bono({"no_empleado": "1", "nombre": "X"})
    assert payload is None
    assert "empleado_id" in (err or "")


@pytest.mark.asyncio
async def test_sync_empleado_no_sobrescribe_email_ni_rol(db, monkeypatch):
    rh = await make_empleado(
        db,
        rol="rh",
        usuario="rh_bono_sync",
        empleado_id=5001,
        no_empleado="E-5001",
    )
    email_prev = rh.email
    rol_prev = rh.rol_id

    class _FakeBonoSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def execute(self, stmt):
            from types import SimpleNamespace

            sql = str(stmt)
            if "FROM empleados" in sql:
                rows = [
                    {
                        "empleado_id": 5001,
                        "no_empleado": "E-5001",
                        "no_sap": None,
                            "nombre": "Nombre Actualizado Bono",
                            "password": "clave-desde-bono",
                            "usuario": "user_bono",
                        "categoria_id": None,
                        "subarea_id": None,
                        "puesto_id": None,
                        "estado_id": 1,
                        "area_id": None,
                        "clasificacion_id": None,
                        "lider_id": None,
                        "centrocosto_id": None,
                        "foto": None,
                        "recibe_bono": None,
                        "brigada": None,
                        "registro": None,
                        "fecha_fin_contrato": None,
                        "a_restringido": None,
                        "requiere_cambio_password": None,
                    }
                ]

                class _R:
                    def mappings(self):
                        return self

                    def all(self):
                        return rows

                return _R()
            return SimpleNamespace(mappings=lambda: self, all=lambda: [])

    class _FakeEngine:
        async def dispose(self):
            pass

    def _fake_sessionmaker(engine, **kwargs):
        class _Factory:
            def __call__(self):
                return _FakeBonoSession()

        return _Factory()

    monkeypatch.setattr(
        "app.integrations.bono_empleados_sync.BonoProductividadReadClient.create_read_engine",
        lambda: _FakeEngine(),
    )
    monkeypatch.setattr(
        "app.integrations.bono_empleados_sync.async_sessionmaker",
        _fake_sessionmaker,
    )
    async def _noop_catalogos(*_a, **_k):
        return None

    monkeypatch.setattr(
        "app.integrations.bono_empleados_sync.sincronizar_catalogos_desde_bd",
        _noop_catalogos,
    )

    service = BonoEmpleadosSyncService(db)
    stats = await service.sincronizar_empleados(execute=True, commit=False)
    await db.flush()
    assert stats.actualizados == 1

    refreshed = (
        await db.execute(select(Empleado).where(Empleado.id == rh.id))
    ).scalar_one()
    assert refreshed.nombre == "Nombre Actualizado Bono"
    assert refreshed.password_hash == "clave-desde-bono"
    assert refreshed.email == email_prev
    assert refreshed.rol_id == rol_prev


@pytest.mark.asyncio
async def test_importar_bono_empleados_job_registra_log(db, monkeypatch):
    from app.integrations.bono_empleados_sync import BonoEmpleadosImportStats

    async def _fake_sync(self, *, execute=True, commit=True):
        return BonoEmpleadosImportStats(leidos=1, insertados=0, actualizados=1)

    monkeypatch.setattr(
        "app.integrations.bono_empleados_import.BonoEmpleadosSyncService.sincronizar_empleados",
        _fake_sync,
    )

    await importar_bono_empleados_job(corrida_id="test-corrida-emp", db=db)

    row = (
        await db.execute(
            select(BonoHistoricoImportLog).where(
                BonoHistoricoImportLog.fuente == "empleados"
            )
        )
    ).scalar_one()
    assert row.corrida_id == "test-corrida-emp"
    assert row.status == "ok"
    assert row.leidos == 1

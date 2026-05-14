# tests/test_capacitaciones_service.py
"""
Tests unitarios para CapacitacionService — logica de negocio de Capacitaciones.

Usa la DB SQLite en memoria del conftest.py (fixture `db`).
Se instancia el servicio directamente, sin pasar por HTTP.
"""

import pytest
import pytest_asyncio
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.services.capacitacion_service import CapacitacionService
from app.schemas.capacitaciones import (
    CapacitacionCreate,
    CapacitacionUpdate,
    InscripcionCreate,
    InscripcionUpdate,
)
from app.models.talento import Capacitacion, Inscripcion
from tests.conftest import make_empleado


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


async def make_capacitacion(db: AsyncSession, **kwargs) -> Capacitacion:
    """Crea una Capacitacion directamente en DB para setup de tests."""
    defaults = {
        "nombre": "Test Cap",
        "duracion_horas": 8,
        "modalidad": "presencial",
        "estado": "activa",
        "activo": True,
    }
    defaults.update(kwargs)
    cap = Capacitacion(**defaults)
    db.add(cap)
    await db.flush()
    await db.refresh(cap)
    return cap


# ---------------------------------------------------------------------------
# Tests: Capacitaciones CRUD
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_service_crear_capacitacion(db: AsyncSession):
    """Service crea una capacitacion y devuelve la respuesta correcta."""
    user = await make_empleado(db, rol="rh")
    service = CapacitacionService(db)

    data = CapacitacionCreate(
        nombre="Seguridad Industrial",
        duracion_horas=16,
        modalidad="presencial",
        instructor="Ing. López",
    )

    result = await service.crear(data, user)

    assert result.id is not None
    assert result.nombre == "Seguridad Industrial"
    assert result.duracion_horas == 16
    assert result.modalidad == "presencial"
    assert result.instructor == "Ing. López"
    assert result.estado == "activa"
    assert result.inscritos_count == 0


@pytest.mark.asyncio
async def test_service_crear_fecha_fin_antes_inicio(db: AsyncSession):
    """fecha_fin < fecha_inicio lanza HTTPException 400."""
    user = await make_empleado(db, rol="rh")
    service = CapacitacionService(db)

    data = CapacitacionCreate(
        nombre="Curso Invalido",
        duracion_horas=4,
        modalidad="online",
        fecha_inicio=datetime(2026, 6, 15, tzinfo=timezone.utc),
        fecha_fin=datetime(2026, 6, 10, tzinfo=timezone.utc),
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.crear(data, user)
    assert exc_info.value.status_code == 400
    assert "fecha_fin" in exc_info.value.detail


@pytest.mark.asyncio
async def test_service_listar_paginado(db: AsyncSession):
    """Crea 15 capacitaciones, pagina 1 tiene 10 items, pagina 2 tiene 5."""
    service = CapacitacionService(db)

    for i in range(15):
        await make_capacitacion(db, nombre=f"Cap {i:02d}")

    page1 = await service.listar(page=1, page_size=10)
    assert len(page1.items) == 10
    assert page1.total == 15
    assert page1.page == 1
    assert page1.page_size == 10

    page2 = await service.listar(page=2, page_size=10)
    assert len(page2.items) == 5
    assert page2.total == 15
    assert page2.page == 2


@pytest.mark.asyncio
async def test_service_listar_filtro_modalidad(db: AsyncSession):
    """Filtrar por modalidad devuelve solo las capacitaciones correspondientes."""
    service = CapacitacionService(db)

    await make_capacitacion(db, nombre="Presencial 1", modalidad="presencial")
    await make_capacitacion(db, nombre="Online 1", modalidad="online")
    await make_capacitacion(db, nombre="Online 2", modalidad="online")

    result = await service.listar(page=1, page_size=50, modalidad="online")

    assert result.total == 2
    assert all(item.modalidad == "online" for item in result.items)


@pytest.mark.asyncio
async def test_service_obtener_not_found(db: AsyncSession):
    """obtener(id=99999) lanza HTTPException 404."""
    service = CapacitacionService(db)

    with pytest.raises(HTTPException) as exc_info:
        await service.obtener(99999)
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_service_actualizar(db: AsyncSession):
    """Actualizar nombre y modalidad refleja los cambios."""
    user = await make_empleado(db, rol="rh")
    service = CapacitacionService(db)

    cap = await make_capacitacion(db, nombre="Original", modalidad="presencial")

    update_data = CapacitacionUpdate(nombre="Actualizado", modalidad="online")
    result = await service.actualizar(cap.id, update_data, user)

    assert result.nombre == "Actualizado"
    assert result.modalidad == "online"


@pytest.mark.asyncio
async def test_service_eliminar_soft_delete(db: AsyncSession):
    """Despues de eliminar (soft delete), obtener lanza 404."""
    user = await make_empleado(db, rol="rh")
    service = CapacitacionService(db)

    cap = await make_capacitacion(db, nombre="A Eliminar")

    await service.eliminar(cap.id, user)

    with pytest.raises(HTTPException) as exc_info:
        await service.obtener(cap.id)
    assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# Tests: Inscripciones
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_service_inscribir_ok(db: AsyncSession):
    """Empleado se inscribe exitosamente a una capacitacion activa."""
    user = await make_empleado(db, rol="rh")
    empleado = await make_empleado(db, rol="empleado", nombre="Juan Pérez")
    service = CapacitacionService(db)

    cap = await make_capacitacion(db, nombre="Lean Manufacturing", cupo_maximo=10)

    data = InscripcionCreate(capacitacion_id=cap.id, empleado_id=empleado.id)
    result = await service.inscribir(capacitacion_id=data.capacitacion_id, empleado_id=data.empleado_id, current_user=user)

    assert result.capacitacion_id == cap.id
    assert result.empleado_id == empleado.id
    assert result.estado == "inscrito"
    assert result.capacitacion_nombre == "Lean Manufacturing"


@pytest.mark.asyncio
async def test_service_inscribir_cupo_lleno(db: AsyncSession):
    """Cuando se alcanza cupo_maximo, inscribir lanza HTTPException 400."""
    user = await make_empleado(db, rol="rh")
    service = CapacitacionService(db)

    cap = await make_capacitacion(db, nombre="Curso Limitado", cupo_maximo=2)

    # Inscribir 2 empleados para llenar cupo
    emp1 = await make_empleado(db, rol="empleado", nombre="Emp 1")
    emp2 = await make_empleado(db, rol="empleado", nombre="Emp 2")
    emp3 = await make_empleado(db, rol="empleado", nombre="Emp 3")

    await service.inscribir(capacitacion_id=cap.id, empleado_id=emp1.id, current_user=user)
    await service.inscribir(capacitacion_id=cap.id, empleado_id=emp2.id, current_user=user)

    # Tercer intento debe fallar
    with pytest.raises(HTTPException) as exc_info:
        await service.inscribir(capacitacion_id=cap.id, empleado_id=emp3.id, current_user=user)
    assert exc_info.value.status_code == 400
    assert "llena" in exc_info.value.detail


@pytest.mark.asyncio
async def test_service_inscribir_duplicado(db: AsyncSession):
    """Inscribir al mismo empleado dos veces lanza HTTPException 409."""
    user = await make_empleado(db, rol="rh")
    empleado = await make_empleado(db, rol="empleado", nombre="Duplicado")
    service = CapacitacionService(db)

    cap = await make_capacitacion(db, nombre="Curso Duplicado")

    data = InscripcionCreate(capacitacion_id=cap.id, empleado_id=empleado.id)
    await service.inscribir(capacitacion_id=data.capacitacion_id, empleado_id=data.empleado_id, current_user=user)

    with pytest.raises(HTTPException) as exc_info:
        await service.inscribir(capacitacion_id=data.capacitacion_id, empleado_id=data.empleado_id, current_user=user)
    assert exc_info.value.status_code == 409
    assert "ya esta inscrito" in exc_info.value.detail


@pytest.mark.asyncio
async def test_service_inscribir_capacitacion_no_activa(db: AsyncSession):
    """Inscribir a una capacitacion con estado='finalizada' lanza HTTPException 400."""
    user = await make_empleado(db, rol="rh")
    empleado = await make_empleado(db, rol="empleado", nombre="Tardio")
    service = CapacitacionService(db)

    cap = await make_capacitacion(db, nombre="Curso Finalizado", estado="finalizada")

    data = InscripcionCreate(capacitacion_id=cap.id, empleado_id=empleado.id)

    with pytest.raises(HTTPException) as exc_info:
        await service.inscribir(capacitacion_id=data.capacitacion_id, empleado_id=data.empleado_id, current_user=user)
    assert exc_info.value.status_code == 400
    assert "finalizada" in exc_info.value.detail


@pytest.mark.asyncio
async def test_service_cancelar_inscripcion_completada(db: AsyncSession):
    """No se puede cancelar una inscripcion con estado='completado' — HTTPException 400."""
    user = await make_empleado(db, rol="rh")
    empleado = await make_empleado(db, rol="empleado", nombre="Completado")
    service = CapacitacionService(db)

    cap = await make_capacitacion(db, nombre="Curso Terminado")

    # Inscribir y luego marcar como completado
    insc_data = InscripcionCreate(capacitacion_id=cap.id, empleado_id=empleado.id)
    insc = await service.inscribir(capacitacion_id=insc_data.capacitacion_id, empleado_id=insc_data.empleado_id, current_user=user)

    # Actualizar estado a completado
    await service.actualizar_inscripcion(
        insc.id, InscripcionUpdate(estado="completado"), user
    )

    # Intentar cancelar debe fallar
    with pytest.raises(HTTPException) as exc_info:
        await service.cancelar_inscripcion(insc.id, user)
    assert exc_info.value.status_code == 400
    assert "completada" in exc_info.value.detail


@pytest.mark.asyncio
async def test_service_actualizar_inscripcion_estado_completado(db: AsyncSession):
    """Al actualizar estado a 'completado', se asigna fecha_completado automaticamente."""
    user = await make_empleado(db, rol="rh")
    empleado = await make_empleado(db, rol="empleado", nombre="Graduado")
    service = CapacitacionService(db)

    cap = await make_capacitacion(db, nombre="Curso Completable")

    insc_data = InscripcionCreate(capacitacion_id=cap.id, empleado_id=empleado.id)
    insc = await service.inscribir(capacitacion_id=insc_data.capacitacion_id, empleado_id=insc_data.empleado_id, current_user=user)

    assert insc.fecha_completado is None

    result = await service.actualizar_inscripcion(
        insc.id, InscripcionUpdate(estado="completado", calificacion=95), user
    )

    assert result.estado == "completado"
    assert result.fecha_completado is not None
    assert result.calificacion == 95


@pytest.mark.asyncio
async def test_service_mis_inscripciones(db: AsyncSession):
    """mis_inscripciones devuelve solo las inscripciones del empleado indicado."""
    user = await make_empleado(db, rol="rh")
    emp_a = await make_empleado(db, rol="empleado", nombre="Empleado A")
    emp_b = await make_empleado(db, rol="empleado", nombre="Empleado B")
    service = CapacitacionService(db)

    cap1 = await make_capacitacion(db, nombre="Curso A")
    cap2 = await make_capacitacion(db, nombre="Curso B")
    cap3 = await make_capacitacion(db, nombre="Curso C")

    # emp_a se inscribe a cap1 y cap2
    await service.inscribir(capacitacion_id=cap1.id, empleado_id=emp_a.id, current_user=user)
    await service.inscribir(capacitacion_id=cap2.id, empleado_id=emp_a.id, current_user=user)

    # emp_b se inscribe a cap3
    await service.inscribir(capacitacion_id=cap3.id, empleado_id=emp_b.id, current_user=user)

    # mis_inscripciones de emp_a debe devolver solo 2
    result_a = await service.mis_inscripciones(emp_a.id, page=1, page_size=50)
    assert result_a.total == 2
    assert all(item.empleado_id == emp_a.id for item in result_a.items)

    # mis_inscripciones de emp_b debe devolver solo 1
    result_b = await service.mis_inscripciones(emp_b.id, page=1, page_size=50)
    assert result_b.total == 1
    assert result_b.items[0].empleado_id == emp_b.id

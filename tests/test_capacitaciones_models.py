# tests/test_capacitaciones_models.py
"""
Tests unitarios para modelos y schemas de Capacitaciones — Modulo Talento Fase 3.

Cubre:
  - Modelo Capacitacion: defaults, campos, relaciones
  - Modelo Inscripcion: defaults, unique constraint, relacion con Capacitacion
  - Schema CapacitacionCreate: validacion de campos requeridos y restricciones
  - Schema CapacitacionUpdate: campos opcionales
  - Schema InscripcionCreate: payload valido
  - Schema InscripcionUpdate: validacion de calificacion (0-100) y estado
"""

import pytest
import pytest_asyncio
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from tests.conftest import make_empleado


# ===========================================================================
# Part 1: Model Tests — Capacitacion
# ===========================================================================


@pytest.mark.asyncio
async def test_capacitacion_model_defaults(db: AsyncSession):
    """Capacitacion model tiene defaults correctos (estado, activo, cupo_maximo)."""
    from app.models.talento import Capacitacion

    cap = Capacitacion(nombre="Test Cap", duracion_horas=8, modalidad="online")
    db.add(cap)
    await db.flush()
    await db.refresh(cap)

    assert cap.id is not None
    assert cap.estado == "activa"
    assert cap.activo is True
    assert cap.cupo_maximo is None
    assert cap.descripcion is None
    assert cap.instructor is None
    assert cap.area_id is None


@pytest.mark.asyncio
async def test_capacitacion_model_all_fields(db: AsyncSession):
    """Capacitacion model almacena todos los campos correctamente."""
    from app.models.talento import Capacitacion

    cap = Capacitacion(
        nombre="Seguridad Industrial",
        descripcion="Curso de seguridad en planta",
        duracion_horas=16,
        modalidad="presencial",
        instructor="Ing. Martinez",
        cupo_maximo=30,
        estado="activa",
        competencias_asociadas=[{"id": 1, "nombre": "Seguridad"}],
    )
    db.add(cap)
    await db.flush()
    await db.refresh(cap)

    assert cap.nombre == "Seguridad Industrial"
    assert cap.descripcion == "Curso de seguridad en planta"
    assert cap.duracion_horas == 16
    assert cap.modalidad == "presencial"
    assert cap.instructor == "Ing. Martinez"
    assert cap.cupo_maximo == 30
    assert cap.competencias_asociadas == [{"id": 1, "nombre": "Seguridad"}]


@pytest.mark.asyncio
async def test_inscripcion_model_defaults(db: AsyncSession):
    """Inscripcion model tiene defaults correctos (estado='inscrito')."""
    from app.models.talento import Capacitacion, Inscripcion

    cap = Capacitacion(nombre="Cap Inscripcion", duracion_horas=4, modalidad="online")
    db.add(cap)
    await db.flush()
    await db.refresh(cap)

    emp = await make_empleado(db, email="insc_default@leoni.test")

    inscripcion = Inscripcion(capacitacion_id=cap.id, empleado_id=emp.id)
    db.add(inscripcion)
    await db.flush()
    await db.refresh(inscripcion)

    assert inscripcion.id is not None
    assert inscripcion.estado == "inscrito"
    assert inscripcion.calificacion is None
    assert inscripcion.fecha_completado is None


@pytest.mark.asyncio
async def test_inscripcion_unique_constraint(db: AsyncSession):
    """Inscripcion duplicada (misma capacitacion + empleado) levanta IntegrityError."""
    from app.models.talento import Capacitacion, Inscripcion

    cap = Capacitacion(nombre="Cap Unique", duracion_horas=2, modalidad="mixta")
    db.add(cap)
    await db.flush()
    await db.refresh(cap)

    emp = await make_empleado(db, email="insc_unique@leoni.test")

    # Primera inscripcion — valida
    insc1 = Inscripcion(capacitacion_id=cap.id, empleado_id=emp.id)
    db.add(insc1)
    await db.flush()

    # Segunda inscripcion — duplicada → debe fallar
    insc2 = Inscripcion(capacitacion_id=cap.id, empleado_id=emp.id)
    db.add(insc2)
    with pytest.raises(IntegrityError):
        await db.flush()

    # Rollback para limpiar la sesion del error
    await db.rollback()


@pytest.mark.asyncio
async def test_capacitacion_inscripciones_relationship(db: AsyncSession):
    """Capacitacion.inscripciones retorna las inscripciones relacionadas."""
    from app.models.talento import Capacitacion, Inscripcion

    cap = Capacitacion(nombre="Cap Rel", duracion_horas=6, modalidad="presencial")
    db.add(cap)
    await db.flush()
    await db.refresh(cap)

    emp1 = await make_empleado(db, email="insc_rel1@leoni.test")
    emp2 = await make_empleado(db, email="insc_rel2@leoni.test")

    db.add(Inscripcion(capacitacion_id=cap.id, empleado_id=emp1.id))
    db.add(Inscripcion(capacitacion_id=cap.id, empleado_id=emp2.id))
    await db.flush()

    # Recargar con relacion
    result = await db.execute(
        select(Capacitacion)
        .where(Capacitacion.id == cap.id)
        .options(selectinload(Capacitacion.inscripciones))
    )
    cap_loaded = result.scalar_one()

    assert len(cap_loaded.inscripciones) == 2
    empleado_ids = {i.empleado_id for i in cap_loaded.inscripciones}
    assert emp1.id in empleado_ids
    assert emp2.id in empleado_ids


@pytest.mark.asyncio
async def test_inscripcion_capacitacion_relationship(db: AsyncSession):
    """Inscripcion.capacitacion retorna la capacitacion padre."""
    from app.models.talento import Capacitacion, Inscripcion

    cap = Capacitacion(nombre="Cap Back Rel", duracion_horas=3, modalidad="online")
    db.add(cap)
    await db.flush()
    await db.refresh(cap)

    emp = await make_empleado(db, email="insc_back_rel@leoni.test")
    insc = Inscripcion(capacitacion_id=cap.id, empleado_id=emp.id, estado="en_curso")
    db.add(insc)
    await db.flush()

    # Recargar con relacion
    result = await db.execute(
        select(Inscripcion)
        .where(Inscripcion.id == insc.id)
        .options(selectinload(Inscripcion.capacitacion))
    )
    insc_loaded = result.scalar_one()

    assert insc_loaded.capacitacion.nombre == "Cap Back Rel"
    assert insc_loaded.estado == "en_curso"


# ===========================================================================
# Part 2: Schema Validation Tests
# ===========================================================================


def test_capacitacion_create_valid():
    """Payload valido pasa validacion sin errores."""
    from app.schemas.capacitaciones import CapacitacionCreate

    data = CapacitacionCreate(
        nombre="Lean Manufacturing", duracion_horas=8, modalidad="presencial"
    )
    assert data.nombre == "Lean Manufacturing"
    assert data.duracion_horas == 8
    assert data.modalidad == "presencial"
    assert data.descripcion is None
    assert data.instructor is None
    assert data.cupo_maximo is None


def test_capacitacion_create_invalid_modalidad():
    """Modalidad invalida levanta ValidationError."""
    from app.schemas.capacitaciones import CapacitacionCreate

    with pytest.raises(ValidationError) as exc_info:
        CapacitacionCreate(nombre="Test", duracion_horas=8, modalidad="invalida")
    assert "modalidad" in str(exc_info.value).lower() or "literal" in str(exc_info.value).lower()


def test_capacitacion_create_zero_duracion():
    """duracion_horas=0 levanta ValidationError (ge=1)."""
    from app.schemas.capacitaciones import CapacitacionCreate

    with pytest.raises(ValidationError) as exc_info:
        CapacitacionCreate(nombre="Test", duracion_horas=0, modalidad="online")
    assert "duracion_horas" in str(exc_info.value).lower() or "greater" in str(exc_info.value).lower()


def test_capacitacion_create_negative_duracion():
    """duracion_horas negativa levanta ValidationError."""
    from app.schemas.capacitaciones import CapacitacionCreate

    with pytest.raises(ValidationError):
        CapacitacionCreate(nombre="Test", duracion_horas=-5, modalidad="online")


def test_capacitacion_create_empty_nombre():
    """nombre vacio levanta ValidationError (min_length=1)."""
    from app.schemas.capacitaciones import CapacitacionCreate

    with pytest.raises(ValidationError):
        CapacitacionCreate(nombre="", duracion_horas=8, modalidad="online")


def test_capacitacion_update_partial():
    """CapacitacionUpdate acepta campos parciales (todos opcionales)."""
    from app.schemas.capacitaciones import CapacitacionUpdate

    # Solo actualizar nombre
    data = CapacitacionUpdate(nombre="Nuevo Nombre")
    assert data.nombre == "Nuevo Nombre"
    assert data.duracion_horas is None
    assert data.modalidad is None
    assert data.estado is None

    # Solo actualizar estado
    data2 = CapacitacionUpdate(estado="finalizada")
    assert data2.estado == "finalizada"


def test_capacitacion_update_invalid_estado():
    """Estado invalido en CapacitacionUpdate levanta ValidationError."""
    from app.schemas.capacitaciones import CapacitacionUpdate

    with pytest.raises(ValidationError):
        CapacitacionUpdate(estado="invalid_state")


def test_inscripcion_create_valid():
    """InscripcionCreate valida con campos requeridos."""
    from app.schemas.capacitaciones import InscripcionCreate

    data = InscripcionCreate(capacitacion_id=1, empleado_id=42)
    assert data.capacitacion_id == 1
    assert data.empleado_id == 42


def test_inscripcion_update_calificacion_bounds():
    """Calificacion debe estar entre 0 y 100."""
    from app.schemas.capacitaciones import InscripcionUpdate

    # Calificacion mayor a 100 → error
    with pytest.raises(ValidationError):
        InscripcionUpdate(calificacion=101)

    # Calificacion negativa → error
    with pytest.raises(ValidationError):
        InscripcionUpdate(calificacion=-1)

    # Calificacion valida en los limites
    data_min = InscripcionUpdate(calificacion=0)
    assert data_min.calificacion == 0

    data_max = InscripcionUpdate(calificacion=100)
    assert data_max.calificacion == 100

    data_mid = InscripcionUpdate(calificacion=85)
    assert data_mid.calificacion == 85


def test_inscripcion_update_invalid_estado():
    """Estado invalido en InscripcionUpdate levanta ValidationError."""
    from app.schemas.capacitaciones import InscripcionUpdate

    with pytest.raises(ValidationError):
        InscripcionUpdate(estado="invalid_state")

    # Estados validos
    for estado in ("inscrito", "en_curso", "completado", "cancelado"):
        data = InscripcionUpdate(estado=estado)
        assert data.estado == estado

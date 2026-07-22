"""ActaRepository.count_por_empleado_por_estado — usado por el índice de Historial Objetivo."""

from datetime import date, datetime, timezone

from app.models.actas import ActaAdministrativa
from app.repositories.acta_repository import ActaRepository
from tests.conftest import make_empleado


async def _crear_acta(
    db,
    *,
    empleado_id: int,
    generado_por: int,
    estado: str = "draft",
    fecha_evento: date | None = None,
    created_at: datetime | None = None,
):
    acta = ActaAdministrativa(
        empleado_id=empleado_id,
        generado_por=generado_por,
        estado=estado,
        descripcion_hechos="Hechos de prueba",
        tipo_falta="Falta de prueba",
        fecha_evento=fecha_evento,
    )
    if created_at is not None:
        acta.created_at = created_at
    db.add(acta)
    await db.flush()
    await db.refresh(acta)
    return acta


async def test_agrupa_por_empleado_y_estado(db):
    rh = await make_empleado(db, rol="rh", email="rh_ho_actas_1@leoni.test")
    emp1 = await make_empleado(db, rol="empleado", email="emp_ho_actas_1@leoni.test")
    emp2 = await make_empleado(db, rol="empleado", email="emp_ho_actas_2@leoni.test")

    await _crear_acta(db, empleado_id=emp1.id, generado_por=rh.id, estado="draft")
    await _crear_acta(db, empleado_id=emp1.id, generado_por=rh.id, estado="draft")
    await _crear_acta(db, empleado_id=emp1.id, generado_por=rh.id, estado="signed")
    await _crear_acta(db, empleado_id=emp2.id, generado_por=rh.id, estado="archived")

    repo = ActaRepository(db)
    result = await repo.count_por_empleado_por_estado(
        empleado_ids=[emp1.id, emp2.id], fecha_inicio=None, fecha_fin=None
    )

    assert result[emp1.id] == {"draft": 2, "signed": 1}
    assert result[emp2.id] == {"archived": 1}


async def test_filtra_por_empleado_ids(db):
    rh = await make_empleado(db, rol="rh", email="rh_ho_actas_2@leoni.test")
    emp1 = await make_empleado(db, rol="empleado", email="emp_ho_actas_3@leoni.test")
    emp2 = await make_empleado(db, rol="empleado", email="emp_ho_actas_4@leoni.test")

    await _crear_acta(db, empleado_id=emp1.id, generado_por=rh.id, estado="draft")
    await _crear_acta(db, empleado_id=emp2.id, generado_por=rh.id, estado="draft")

    repo = ActaRepository(db)
    result = await repo.count_por_empleado_por_estado(
        empleado_ids=[emp1.id], fecha_inicio=None, fecha_fin=None
    )

    assert emp1.id in result
    assert emp2.id not in result


async def test_sin_filtro_empleado_ids_incluye_todos(db):
    rh = await make_empleado(db, rol="rh", email="rh_ho_actas_3@leoni.test")
    emp1 = await make_empleado(db, rol="empleado", email="emp_ho_actas_5@leoni.test")

    await _crear_acta(db, empleado_id=emp1.id, generado_por=rh.id, estado="draft")

    repo = ActaRepository(db)
    result = await repo.count_por_empleado_por_estado(
        empleado_ids=None, fecha_inicio=None, fecha_fin=None
    )

    assert result.get(emp1.id) == {"draft": 1}


async def test_filtro_fechas_usa_coalesce_fecha_evento_o_created_at(db):
    rh = await make_empleado(db, rol="rh", email="rh_ho_actas_4@leoni.test")
    emp = await make_empleado(db, rol="empleado", email="emp_ho_actas_6@leoni.test")

    # Dentro del rango por fecha_evento explícita.
    dentro_por_evento = await _crear_acta(
        db,
        empleado_id=emp.id,
        generado_por=rh.id,
        estado="draft",
        fecha_evento=date(2026, 2, 10),
    )
    # fecha_evento=None -> cae por created_at, dentro del rango.
    dentro_por_created_at = await _crear_acta(
        db,
        empleado_id=emp.id,
        generado_por=rh.id,
        estado="signed",
        fecha_evento=None,
        created_at=datetime(2026, 2, 15, tzinfo=timezone.utc),
    )
    # Fuera de rango (antes).
    await _crear_acta(
        db,
        empleado_id=emp.id,
        generado_por=rh.id,
        estado="archived",
        fecha_evento=date(2026, 1, 1),
    )
    # Fuera de rango (después), sin fecha_evento -> created_at también fuera.
    await _crear_acta(
        db,
        empleado_id=emp.id,
        generado_por=rh.id,
        estado="cancelled",
        fecha_evento=None,
        created_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
    )

    repo = ActaRepository(db)
    result = await repo.count_por_empleado_por_estado(
        empleado_ids=[emp.id],
        fecha_inicio=date(2026, 2, 1),
        fecha_fin=date(2026, 2, 28),
    )

    assert result[emp.id] == {"draft": 1, "signed": 1}
    assert dentro_por_evento.estado == "draft"
    assert dentro_por_created_at.estado == "signed"


async def test_empleado_sin_actas_no_aparece_en_el_dict(db):
    rh = await make_empleado(db, rol="rh", email="rh_ho_actas_5@leoni.test")
    con_actas = await make_empleado(db, rol="empleado", email="emp_ho_actas_7@leoni.test")
    sin_actas = await make_empleado(db, rol="empleado", email="emp_ho_actas_8@leoni.test")

    await _crear_acta(db, empleado_id=con_actas.id, generado_por=rh.id, estado="draft")

    repo = ActaRepository(db)
    result = await repo.count_por_empleado_por_estado(
        empleado_ids=[con_actas.id, sin_actas.id], fecha_inicio=None, fecha_fin=None
    )

    assert con_actas.id in result
    assert sin_actas.id not in result

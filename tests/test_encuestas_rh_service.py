# tests/test_encuestas_rh_service.py
"""Tests del service de Encuestas RH (Tarea 2).

Cubre ciclo de vida, audiencia, respuesta (con/sin anonimato) y plantillas.
No hay router aun (Tarea 3): todo se ejercita a nivel service con la sesion
de tests (SQLite in-memory, ver tests/conftest.py).
"""

from datetime import date, timedelta

import pytest
from sqlalchemy import select

from app.core.exceptions import ConflictError, DomainValidationError, ForbiddenError
from app.models.catalogos import Area, ClasificacionEmpleado
from app.models.encuestas_rh import (
    Encuesta,
    EncuestaParticipante,
    EncuestaPlantilla,
    EncuestaRespuestaGrupo,
)
from app.models.notificaciones import Notificacion
from app.models.turnos_empleados import TurnoEmpleado
from app.schemas.encuestas_rh import (
    AudienciaFiltros,
    EncuestaCreate,
    EncuestaUpdate,
    OpcionCreate,
    PreguntaCreate,
    PreguntaUpdate,
    PublicarRequest,
    ResponderItem,
    ResponderRequest,
)
from app.services.encuestas_rh_service import EncuestasRhService
from tests.conftest import make_empleado

pytestmark = pytest.mark.asyncio


# ── Helpers ──────────────────────────────────────────────────────────────


async def _make_area(db, area_id: int, descripcion: str = "Produccion") -> Area:
    area = Area(area_id=area_id, descripcion=descripcion, estatus_id=1)
    db.add(area)
    await db.flush()
    return area


async def _make_clasificacion(db, clasificacion_id: int, descripcion: str) -> ClasificacionEmpleado:
    clasif = ClasificacionEmpleado(
        clasificacion_id=clasificacion_id, descripcion=descripcion, estatus_id=1
    )
    db.add(clasif)
    await db.flush()
    return clasif


async def _make_turno(db, empleado, turno: str) -> TurnoEmpleado:
    from app.utils.turno_empleado_match import no_empleado_as_turno_str

    te = TurnoEmpleado(
        no_empleado=no_empleado_as_turno_str(empleado.no_empleado),
        nombre=empleado.nombre,
        turno=turno,
    )
    db.add(te)
    await db.flush()
    return te


def _pregunta_likert(orden=1, requerida=True, texto="Pregunta likert"):
    return PreguntaCreate(orden=orden, tipo="likert", texto=texto, requerida=requerida)


def _pregunta_opcion_multiple(orden=1, requerida=True, seleccion_multiple=False, n_opciones=2):
    return PreguntaCreate(
        orden=orden,
        tipo="opcion_multiple",
        texto="Pregunta opcion multiple",
        requerida=requerida,
        seleccion_multiple=seleccion_multiple,
        opciones=[OpcionCreate(texto=f"Opcion {i}") for i in range(1, n_opciones + 1)],
    )


def _pregunta_texto(orden=1, requerida=False, texto="Pregunta texto"):
    return PreguntaCreate(orden=orden, tipo="texto", texto=texto, requerida=requerida)


async def _crear_encuesta_basica(
    service: EncuestasRhService, creador, preguntas=None, es_anonima=False
):
    data = EncuestaCreate(
        titulo="Encuesta de prueba",
        descripcion="desc",
        tipo="clima",
        es_anonima=es_anonima,
        creado_por_id=creador.empleado_id,
        preguntas=[_pregunta_likert()] if preguntas is None else preguntas,
    )
    return await service.crear_encuesta(data)


# ── CRUD / creacion ──────────────────────────────────────────────────────


async def test_crear_encuesta_requiere_creado_por_id(db):
    service = EncuestasRhService(db)
    data = EncuestaCreate(
        titulo="Sin creador", es_anonima=False, creado_por_id=None, preguntas=[]
    )
    with pytest.raises(DomainValidationError):
        await service.crear_encuesta(data)


async def test_crear_encuesta_con_preguntas_y_opciones(db):
    creador = await make_empleado(db, rol="rh")
    service = EncuestasRhService(db)
    resp = await _crear_encuesta_basica(
        service, creador, preguntas=[_pregunta_likert(), _pregunta_opcion_multiple(orden=2)]
    )
    assert resp.estado == "borrador"
    assert len(resp.preguntas) == 2
    assert len(resp.preguntas[1].opciones) == 2


async def test_crud_preguntas_en_borrador_agregar_actualizar_reemplazar_opciones_eliminar(db):
    creador = await make_empleado(db, rol="rh")
    service = EncuestasRhService(db)
    resp = await _crear_encuesta_basica(service, creador, preguntas=[])

    agregada = await service.agregar_pregunta(resp.id, _pregunta_opcion_multiple(n_opciones=2))
    assert len(agregada.opciones) == 2

    actualizada = await service.actualizar_pregunta(
        resp.id,
        agregada.id,
        PreguntaUpdate(
            texto="Texto editado",
            opciones=[OpcionCreate(texto="Nueva A"), OpcionCreate(texto="Nueva B"), OpcionCreate(texto="Nueva C")],
        ),
    )
    assert actualizada.texto == "Texto editado"
    assert sorted(o.texto for o in actualizada.opciones) == ["Nueva A", "Nueva B", "Nueva C"]

    encuesta = await service.obtener_encuesta(resp.id)
    assert len(encuesta.preguntas[0].opciones) == 3

    await service.eliminar_pregunta(resp.id, agregada.id)
    encuesta = await service.obtener_encuesta(resp.id)
    assert encuesta.preguntas == []


# ── Ciclo de vida: publicar ───────────────────────────────────────────────


async def test_publicar_falla_sin_preguntas(db):
    creador = await make_empleado(db, rol="rh")
    service = EncuestasRhService(db)
    resp = await _crear_encuesta_basica(service, creador, preguntas=[])
    with pytest.raises(DomainValidationError):
        await service.publicar_encuesta(
            resp.id,
            PublicarRequest(
                filtros=AudienciaFiltros(), fecha_cierre_programada=date.today() + timedelta(days=7)
            ),
        )


async def test_publicar_falla_opcion_multiple_con_una_opcion(db):
    creador = await make_empleado(db, rol="rh")
    await make_empleado(db)  # audiencia no vacia
    service = EncuestasRhService(db)
    resp = await _crear_encuesta_basica(
        service, creador, preguntas=[_pregunta_opcion_multiple(n_opciones=1)]
    )
    with pytest.raises(DomainValidationError):
        await service.publicar_encuesta(
            resp.id,
            PublicarRequest(
                filtros=AudienciaFiltros(), fecha_cierre_programada=date.today() + timedelta(days=7)
            ),
        )


async def test_publicar_falla_audiencia_vacia(db):
    creador = await make_empleado(db, rol="rh")
    service = EncuestasRhService(db)
    resp = await _crear_encuesta_basica(service, creador)
    with pytest.raises(DomainValidationError):
        await service.publicar_encuesta(
            resp.id,
            PublicarRequest(
                filtros=AudienciaFiltros(areas=[999999]),
                fecha_cierre_programada=date.today() + timedelta(days=7),
            ),
        )


async def test_publicar_falla_fecha_cierre_no_futura(db):
    creador = await make_empleado(db, rol="rh")
    await make_empleado(db)
    service = EncuestasRhService(db)
    resp = await _crear_encuesta_basica(service, creador)
    with pytest.raises(DomainValidationError):
        await service.publicar_encuesta(
            resp.id,
            PublicarRequest(filtros=AudienciaFiltros(), fecha_cierre_programada=date.today()),
        )


async def test_publicar_ok_materializa_participantes_y_notifica(db):
    creador = await make_empleado(db, rol="rh")
    empleado = await make_empleado(db, rol="empleado")
    service = EncuestasRhService(db)
    resp = await _crear_encuesta_basica(service, creador)

    # Filtramos por rol "empleado" para aislar un unico participante esperado
    # (el creador tambien es un empleado activo y calificaria sin este filtro).
    filtros = AudienciaFiltros(roles=["empleado"])
    publicada = await service.publicar_encuesta(
        resp.id,
        PublicarRequest(
            filtros=filtros, fecha_cierre_programada=date.today() + timedelta(days=7)
        ),
    )
    assert publicada.estado == "publicada"
    assert publicada.fecha_publicacion is not None
    assert publicada.audiencia_criterios == {"areas": [], "turnos": [], "roles": ["empleado"]}

    result = await db.execute(
        select(EncuestaParticipante).where(EncuestaParticipante.encuesta_id == resp.id)
    )
    participantes = result.scalars().all()
    assert len(participantes) == 1
    assert participantes[0].empleado_id == empleado.empleado_id
    assert participantes[0].estado == "pendiente"

    result = await db.execute(
        select(Notificacion).where(Notificacion.user_id == empleado.empleado_id)
    )
    notif = result.scalar_one()
    assert notif.target_url == "#/talento/mis-encuestas"


async def test_publicada_no_permite_editar_preguntas_pero_si_titulo(db):
    creador = await make_empleado(db, rol="rh")
    await make_empleado(db)
    service = EncuestasRhService(db)
    resp = await _crear_encuesta_basica(service, creador)
    publicada = await service.publicar_encuesta(
        resp.id,
        PublicarRequest(
            filtros=AudienciaFiltros(), fecha_cierre_programada=date.today() + timedelta(days=7)
        ),
    )

    with pytest.raises(ConflictError):
        await service.agregar_pregunta(publicada.id, _pregunta_texto())

    pregunta_id = publicada.preguntas[0].id
    with pytest.raises(ConflictError):
        await service.actualizar_pregunta(
            publicada.id, pregunta_id, PreguntaUpdate(texto="Nuevo texto")
        )
    with pytest.raises(ConflictError):
        await service.eliminar_pregunta(publicada.id, pregunta_id)

    # es_anonima / umbral_minimo_respuestas inmutables
    with pytest.raises(DomainValidationError):
        await service.actualizar_encuesta(publicada.id, EncuestaUpdate(es_anonima=True))
    with pytest.raises(DomainValidationError):
        await service.actualizar_encuesta(
            publicada.id, EncuestaUpdate(umbral_minimo_respuestas=10)
        )

    # titulo y descripcion si son editables
    actualizada = await service.actualizar_encuesta(
        publicada.id, EncuestaUpdate(titulo="Titulo nuevo")
    )
    assert actualizada.titulo == "Titulo nuevo"

    # extender fecha_cierre_programada: ok si es posterior
    nueva_fecha = publicada.fecha_cierre_programada + timedelta(days=1)
    extendida = await service.actualizar_encuesta(
        publicada.id, EncuestaUpdate(fecha_cierre_programada=nueva_fecha)
    )
    assert extendida.fecha_cierre_programada == nueva_fecha

    # no permite retroceder la fecha
    with pytest.raises(DomainValidationError):
        await service.actualizar_encuesta(
            publicada.id,
            EncuestaUpdate(fecha_cierre_programada=nueva_fecha - timedelta(days=5)),
        )


async def test_publicada_no_es_borrable(db):
    creador = await make_empleado(db, rol="rh")
    await make_empleado(db)
    service = EncuestasRhService(db)
    resp = await _crear_encuesta_basica(service, creador)
    publicada = await service.publicar_encuesta(
        resp.id,
        PublicarRequest(
            filtros=AudienciaFiltros(), fecha_cierre_programada=date.today() + timedelta(days=7)
        ),
    )
    with pytest.raises(ConflictError):
        await service.eliminar_encuesta(publicada.id)


# ── Ciclo de vida: cerrar ─────────────────────────────────────────────────


async def test_cerrar_encuesta_manual(db):
    creador = await make_empleado(db, rol="rh")
    await make_empleado(db)
    service = EncuestasRhService(db)
    resp = await _crear_encuesta_basica(service, creador)
    publicada = await service.publicar_encuesta(
        resp.id,
        PublicarRequest(
            filtros=AudienciaFiltros(), fecha_cierre_programada=date.today() + timedelta(days=7)
        ),
    )
    cerrada = await service.cerrar_encuesta(publicada.id)
    assert cerrada.estado == "cerrada"
    assert cerrada.fecha_cierre_real is not None

    with pytest.raises(ConflictError):
        await service.cerrar_encuesta(cerrada.id)


async def test_procesar_cierres_vencidos(db):
    creador = await make_empleado(db, rol="rh")
    await make_empleado(db)
    service = EncuestasRhService(db)

    # Encuesta que se publica con cierre en el futuro y luego se "adelanta"
    # manualmente para simular que ya vencio.
    resp = await _crear_encuesta_basica(service, creador)
    publicada = await service.publicar_encuesta(
        resp.id,
        PublicarRequest(
            filtros=AudienciaFiltros(), fecha_cierre_programada=date.today() + timedelta(days=7)
        ),
    )
    encuesta_obj = await db.get(Encuesta, publicada.id)
    encuesta_obj.fecha_cierre_programada = date.today() - timedelta(days=1)
    await db.flush()

    # Otra encuesta publicada que NO ha vencido, no debe cerrarse.
    resp2 = await _crear_encuesta_basica(service, creador)
    publicada2 = await service.publicar_encuesta(
        resp2.id,
        PublicarRequest(
            filtros=AudienciaFiltros(), fecha_cierre_programada=date.today() + timedelta(days=7)
        ),
    )

    cerradas = await service.procesar_cierres_vencidos()
    assert cerradas == 1

    refrescada = await service.obtener_encuesta(publicada.id)
    assert refrescada.estado == "cerrada"
    refrescada2 = await service.obtener_encuesta(publicada2.id)
    assert refrescada2.estado == "publicada"


# ── Audiencia ─────────────────────────────────────────────────────────────


async def test_audiencia_filtra_por_area_turno_rol_y_preview_cuenta(db):
    creador = await make_empleado(db, rol="rh")
    area_a = await _make_area(db, 5001, "Area A")
    area_b = await _make_area(db, 5002, "Area B")

    emp_area_a_turno1 = await make_empleado(db, rol="empleado")
    emp_area_a_turno1.area_id = area_a.area_id
    await db.flush()
    await _make_turno(db, emp_area_a_turno1, "T1")

    emp_area_a_turno2 = await make_empleado(db, rol="supervisor")
    emp_area_a_turno2.area_id = area_a.area_id
    await db.flush()
    await _make_turno(db, emp_area_a_turno2, "T2")

    emp_area_b = await make_empleado(db, rol="empleado")
    emp_area_b.area_id = area_b.area_id
    await db.flush()
    await _make_turno(db, emp_area_b, "T1")

    service = EncuestasRhService(db)

    # Solo area A
    empleados = await service._resolver_audiencia(AudienciaFiltros(areas=[area_a.area_id]))
    ids = {e.empleado_id for e in empleados}
    assert ids == {emp_area_a_turno1.empleado_id, emp_area_a_turno2.empleado_id}

    # Area A + turno T1
    empleados = await service._resolver_audiencia(
        AudienciaFiltros(areas=[area_a.area_id], turnos=["t1"])
    )
    ids = {e.empleado_id for e in empleados}
    assert ids == {emp_area_a_turno1.empleado_id}

    # Solo rol supervisor
    empleados = await service._resolver_audiencia(AudienciaFiltros(roles=["supervisor"]))
    ids = {e.empleado_id for e in empleados}
    assert ids == {emp_area_a_turno2.empleado_id}

    # Preview sin filtros: cuenta los 3 activos + creador (rol rh)
    preview = await service.preview_audiencia(AudienciaFiltros())
    assert preview.total == 4
    areas_contadas = {p.area_id: p.total for p in preview.por_area}
    assert areas_contadas[area_a.area_id] == 2
    assert areas_contadas[area_b.area_id] == 1


async def test_materializar_participantes_es_idempotente(db):
    creador = await make_empleado(db, rol="rh")
    empleado = await make_empleado(db)
    service = EncuestasRhService(db)
    resp = await _crear_encuesta_basica(service, creador)
    encuesta_obj = await db.get(Encuesta, resp.id)

    empleados = await service._resolver_audiencia(AudienciaFiltros())
    nuevos1 = await service._materializar_participantes(encuesta_obj.id, empleados)
    nuevos2 = await service._materializar_participantes(encuesta_obj.id, empleados)
    assert len(nuevos1) == len(empleados)
    assert nuevos2 == []

    result = await db.execute(
        select(EncuestaParticipante).where(EncuestaParticipante.encuesta_id == encuesta_obj.id)
    )
    assert len(result.scalars().all()) == len(empleados)


# ── Responder ─────────────────────────────────────────────────────────────


async def _publicar_encuesta_con_participante(
    db, es_anonima=False, preguntas=None
):
    creador = await make_empleado(db, rol="rh")
    empleado = await make_empleado(db)
    area = await _make_area(db, 6001, "Area snapshot")
    clasif = await _make_clasificacion(db, 601, "Clasificacion X")
    empleado.area_id = area.area_id
    empleado.clasificacion_id = clasif.clasificacion_id
    await db.flush()
    await _make_turno(db, empleado, " t3 ")

    service = EncuestasRhService(db)
    resp = await _crear_encuesta_basica(
        service, creador, preguntas=preguntas, es_anonima=es_anonima
    )
    publicada = await service.publicar_encuesta(
        resp.id,
        PublicarRequest(
            filtros=AudienciaFiltros(), fecha_cierre_programada=date.today() + timedelta(days=7)
        ),
    )
    return service, publicada, empleado


async def test_responder_anonima_desasocia_empleado_y_pobla_snapshot(db):
    preguntas = [_pregunta_likert()]
    service, publicada, empleado = await _publicar_encuesta_con_participante(
        db, es_anonima=True, preguntas=preguntas
    )
    pregunta_id = publicada.preguntas[0].id

    await service.responder(
        publicada.id,
        empleado.empleado_id,
        ResponderRequest(respuestas=[ResponderItem(pregunta_id=pregunta_id, valor_likert=4)]),
    )

    result = await db.execute(
        select(EncuestaRespuestaGrupo).where(EncuestaRespuestaGrupo.encuesta_id == publicada.id)
    )
    grupo = result.scalar_one()
    assert grupo.empleado_id is None
    assert grupo.created_at is None
    assert grupo.segmento_area == "Area snapshot"
    assert grupo.segmento_turno == "T3"
    assert grupo.segmento_clasificacion == "Clasificacion X"

    result = await db.execute(
        select(EncuestaParticipante).where(
            EncuestaParticipante.encuesta_id == publicada.id,
            EncuestaParticipante.empleado_id == empleado.empleado_id,
        )
    )
    participante = result.scalar_one()
    assert participante.estado == "respondida"
    assert participante.fecha_respuesta is not None


async def test_responder_nominal_asocia_empleado_y_created_at(db):
    preguntas = [_pregunta_likert()]
    service, publicada, empleado = await _publicar_encuesta_con_participante(
        db, es_anonima=False, preguntas=preguntas
    )
    pregunta_id = publicada.preguntas[0].id

    await service.responder(
        publicada.id,
        empleado.empleado_id,
        ResponderRequest(respuestas=[ResponderItem(pregunta_id=pregunta_id, valor_likert=5)]),
    )

    result = await db.execute(
        select(EncuestaRespuestaGrupo).where(EncuestaRespuestaGrupo.encuesta_id == publicada.id)
    )
    grupo = result.scalar_one()
    assert grupo.empleado_id == empleado.empleado_id
    assert grupo.created_at is not None


async def test_responder_doble_respuesta_conflicto(db):
    preguntas = [_pregunta_likert(requerida=False)]
    service, publicada, empleado = await _publicar_encuesta_con_participante(
        db, preguntas=preguntas
    )
    pregunta_id = publicada.preguntas[0].id
    payload = ResponderRequest(
        respuestas=[ResponderItem(pregunta_id=pregunta_id, valor_likert=3)]
    )
    await service.responder(publicada.id, empleado.empleado_id, payload)
    with pytest.raises(ConflictError):
        await service.responder(publicada.id, empleado.empleado_id, payload)


async def test_responder_no_participante_forbidden(db):
    preguntas = [_pregunta_likert(requerida=False)]
    service, publicada, _empleado = await _publicar_encuesta_con_participante(
        db, preguntas=preguntas
    )
    otro = await make_empleado(db)
    with pytest.raises(ForbiddenError):
        await service.responder(publicada.id, otro.empleado_id, ResponderRequest(respuestas=[]))


async def test_responder_pregunta_requerida_faltante(db):
    preguntas = [_pregunta_likert(requerida=True)]
    service, publicada, empleado = await _publicar_encuesta_con_participante(
        db, preguntas=preguntas
    )
    with pytest.raises(DomainValidationError):
        await service.responder(publicada.id, empleado.empleado_id, ResponderRequest(respuestas=[]))


async def test_responder_likert_fuera_de_rango(db):
    preguntas = [_pregunta_likert(requerida=True)]
    service, publicada, empleado = await _publicar_encuesta_con_participante(
        db, preguntas=preguntas
    )
    pregunta_id = publicada.preguntas[0].id
    with pytest.raises(DomainValidationError):
        await service.responder(
            publicada.id,
            empleado.empleado_id,
            ResponderRequest(
                respuestas=[ResponderItem(pregunta_id=pregunta_id, valor_likert=9)]
            ),
        )


async def test_responder_opcion_de_otra_pregunta(db):
    preguntas = [
        _pregunta_opcion_multiple(orden=1, requerida=True, n_opciones=2),
        _pregunta_opcion_multiple(orden=2, requerida=False, n_opciones=2),
    ]
    service, publicada, empleado = await _publicar_encuesta_con_participante(
        db, preguntas=preguntas
    )
    pregunta_1 = publicada.preguntas[0]
    pregunta_2 = publicada.preguntas[1]
    opcion_de_pregunta_2 = pregunta_2.opciones[0].id

    with pytest.raises(DomainValidationError):
        await service.responder(
            publicada.id,
            empleado.empleado_id,
            ResponderRequest(
                respuestas=[
                    ResponderItem(pregunta_id=pregunta_1.id, opcion_ids=[opcion_de_pregunta_2])
                ]
            ),
        )


async def test_responder_opcion_multiple_seleccion_unica_rechaza_mas_de_una(db):
    preguntas = [_pregunta_opcion_multiple(orden=1, requerida=True, n_opciones=3)]
    service, publicada, empleado = await _publicar_encuesta_con_participante(
        db, preguntas=preguntas
    )
    pregunta = publicada.preguntas[0]
    opcion_ids = [o.id for o in pregunta.opciones[:2]]
    with pytest.raises(DomainValidationError):
        await service.responder(
            publicada.id,
            empleado.empleado_id,
            ResponderRequest(
                respuestas=[ResponderItem(pregunta_id=pregunta.id, opcion_ids=opcion_ids)]
            ),
        )


# ── Plantillas ────────────────────────────────────────────────────────────


async def test_crear_encuesta_desde_plantilla_copia_preguntas(db):
    creador = await make_empleado(db, rol="rh")
    plantilla = EncuestaPlantilla(
        nombre="Clima laboral",
        descripcion="Plantilla de clima",
        tipo="clima",
        es_predefinida=True,
        definicion=[
            {
                "orden": 1,
                "tipo": "likert",
                "texto": "Pregunta 1",
                "requerida": True,
                "seleccion_multiple": False,
                "opciones": [],
            },
            {
                "orden": 2,
                "tipo": "opcion_multiple",
                "texto": "Pregunta 2",
                "requerida": True,
                "seleccion_multiple": False,
                "opciones": ["Si", "No"],
            },
        ],
    )
    db.add(plantilla)
    await db.flush()

    service = EncuestasRhService(db)
    resp = await service.crear_encuesta_desde_plantilla(plantilla.id, creador.empleado_id)

    assert resp.estado == "borrador"
    assert resp.titulo == "Clima laboral"
    assert len(resp.preguntas) == 2
    pregunta_opcion = next(p for p in resp.preguntas if p.tipo == "opcion_multiple")
    assert [o.texto for o in pregunta_opcion.opciones] == ["Si", "No"]


async def test_crear_encuesta_desde_plantilla_requiere_creado_por_id(db):
    plantilla = EncuestaPlantilla(
        nombre="Pulso", tipo="pulso", es_predefinida=True, definicion=[]
    )
    db.add(plantilla)
    await db.flush()
    service = EncuestasRhService(db)
    with pytest.raises(DomainValidationError):
        await service.crear_encuesta_desde_plantilla(plantilla.id, None)


# ── Mis encuestas ─────────────────────────────────────────────────────────


async def test_listar_mis_encuestas_pendientes_y_respondidas(db):
    preguntas = [_pregunta_likert(requerida=False)]
    service, publicada, empleado = await _publicar_encuesta_con_participante(
        db, preguntas=preguntas
    )
    mis = await service.listar_mis_encuestas(empleado.empleado_id)
    assert len(mis) == 1
    assert mis[0].participante_estado == "pendiente"

    await service.responder(publicada.id, empleado.empleado_id, ResponderRequest(respuestas=[]))
    mis = await service.listar_mis_encuestas(empleado.empleado_id)
    assert mis[0].participante_estado == "respondida"


async def test_obtener_para_responder_valida_participante_y_estado(db):
    preguntas = [_pregunta_likert(requerida=False)]
    service, publicada, empleado = await _publicar_encuesta_con_participante(
        db, preguntas=preguntas
    )
    resp = await service.obtener_para_responder(publicada.id, empleado.empleado_id)
    assert resp.id == publicada.id

    otro = await make_empleado(db)
    with pytest.raises(ForbiddenError):
        await service.obtener_para_responder(publicada.id, otro.empleado_id)

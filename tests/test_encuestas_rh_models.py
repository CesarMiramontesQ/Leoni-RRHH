# tests/test_encuestas_rh_models.py
"""
Tests de modelos SQLAlchemy del modulo Encuestas RH (levelup_encuesta_*).

Cubre:
  1. Crear encuesta con preguntas/opciones y leerla (relaciones y orden).
  2. `respuesta_grupo` acepta empleado_id NULL y genera id UUID automatico.
  3. UNIQUE (encuesta_id, empleado_id) en participantes.
  4. UNIQUE (grupo_id, pregunta_id) en respuestas.
  5. Cascade: borrar encuesta borra preguntas/opciones/participantes/grupos/respuestas.
"""

import uuid
from datetime import date

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models.encuestas_rh import (
    Encuesta,
    EncuestaOpcion,
    EncuestaParticipante,
    EncuestaPlantilla,
    EncuestaPregunta,
    EncuestaRespuesta,
    EncuestaRespuestaGrupo,
    EncuestaRespuestaOpcion,
)
from tests.conftest import make_empleado


async def _make_encuesta_con_preguntas(db, *, creado_por_id: int, es_anonima: bool = False):
    """Crea una encuesta con 2 preguntas (likert + opcion_multiple con 2 opciones)."""
    encuesta = Encuesta(
        titulo="Clima laboral 2026",
        descripcion="Encuesta semestral de clima",
        tipo="clima",
        es_anonima=es_anonima,
        umbral_minimo_respuestas=5,
        creado_por_id=creado_por_id,
    )
    db.add(encuesta)
    await db.flush()

    pregunta_likert = EncuestaPregunta(
        encuesta_id=encuesta.id,
        orden=2,
        tipo="likert",
        texto="Me siento a gusto en mi area de trabajo",
    )
    pregunta_opcion = EncuestaPregunta(
        encuesta_id=encuesta.id,
        orden=1,
        tipo="opcion_multiple",
        texto="Que turno prefieres",
        seleccion_multiple=False,
    )
    db.add_all([pregunta_likert, pregunta_opcion])
    await db.flush()

    opcion_a = EncuestaOpcion(pregunta_id=pregunta_opcion.id, orden=1, texto="Matutino")
    opcion_b = EncuestaOpcion(pregunta_id=pregunta_opcion.id, orden=2, texto="Vespertino")
    db.add_all([opcion_a, opcion_b])
    await db.flush()

    return encuesta, pregunta_likert, pregunta_opcion, opcion_a, opcion_b


# ===========================================================================
# 1. Crear encuesta con preguntas/opciones y leerla (relaciones y orden)
# ===========================================================================


@pytest.mark.asyncio
async def test_crear_encuesta_con_preguntas_y_opciones_y_leer_relaciones(db):
    empleado = await make_empleado(db, rol="rh", nombre="RH Encuestas")

    encuesta, pregunta_likert, pregunta_opcion, opcion_a, opcion_b = (
        await _make_encuesta_con_preguntas(db, creado_por_id=empleado.empleado_id)
    )

    result = await db.execute(
        select(Encuesta).where(Encuesta.id == encuesta.id)
    )
    encuesta_db = result.scalar_one()

    # Defaults del modelo
    assert encuesta_db.estado == "borrador"
    assert encuesta_db.recordatorio_cada_dias == 3
    assert encuesta_db.umbral_minimo_respuestas == 5
    assert encuesta_db.creado_por_id == empleado.empleado_id
    assert encuesta_db.created_at is not None
    assert encuesta_db.updated_at is not None

    # Relacion preguntas ordenada por `orden` (pregunta_opcion orden=1 primero)
    await db.refresh(encuesta_db, attribute_names=["preguntas"])
    preguntas = encuesta_db.preguntas
    assert [p.id for p in preguntas] == [pregunta_opcion.id, pregunta_likert.id]
    assert preguntas[0].orden == 1
    assert preguntas[1].orden == 2

    await db.refresh(pregunta_opcion, attribute_names=["opciones"])
    opciones = pregunta_opcion.opciones
    assert [o.id for o in opciones] == [opcion_a.id, opcion_b.id]
    assert opciones[0].texto == "Matutino"


# ===========================================================================
# 2. respuesta_grupo acepta empleado_id NULL y genera id UUID automatico
# ===========================================================================


@pytest.mark.asyncio
async def test_respuesta_grupo_empleado_id_nulo_y_uuid_autogenerado(db):
    rh = await make_empleado(db, rol="rh", nombre="RH Anonima")
    encuesta, *_ = await _make_encuesta_con_preguntas(
        db, creado_por_id=rh.empleado_id, es_anonima=True
    )

    grupo = EncuestaRespuestaGrupo(
        encuesta_id=encuesta.id,
        empleado_id=None,
        segmento_area="Produccion",
        segmento_turno="Matutino",
        fecha_dia=date(2026, 7, 21),
    )
    db.add(grupo)
    await db.flush()
    await db.refresh(grupo)

    assert grupo.id is not None
    assert isinstance(grupo.id, uuid.UUID)
    assert grupo.empleado_id is None
    # created_at es nullable y sin server_default: no se llena en el modelo,
    # solo el service lo asigna para encuestas no anonimas.
    assert grupo.created_at is None


# ===========================================================================
# 3. UNIQUE (encuesta_id, empleado_id) en participantes
# ===========================================================================


@pytest.mark.asyncio
async def test_unique_encuesta_empleado_en_participante(db):
    rh = await make_empleado(db, rol="rh", nombre="RH Participantes")
    encuesta, *_ = await _make_encuesta_con_preguntas(db, creado_por_id=rh.empleado_id)
    empleado = await make_empleado(db, rol="empleado", nombre="Empleado Participante")

    participante_1 = EncuestaParticipante(
        encuesta_id=encuesta.id,
        empleado_id=empleado.empleado_id,
    )
    db.add(participante_1)
    await db.flush()

    participante_2 = EncuestaParticipante(
        encuesta_id=encuesta.id,
        empleado_id=empleado.empleado_id,
    )
    db.add(participante_2)
    with pytest.raises(IntegrityError):
        await db.flush()

    await db.rollback()


# ===========================================================================
# 4. UNIQUE (grupo_id, pregunta_id) en respuestas
# ===========================================================================


@pytest.mark.asyncio
async def test_unique_grupo_pregunta_en_respuesta(db):
    rh = await make_empleado(db, rol="rh", nombre="RH Respuestas")
    encuesta, pregunta_likert, _pregunta_opcion, _oa, _ob = (
        await _make_encuesta_con_preguntas(db, creado_por_id=rh.empleado_id)
    )

    grupo = EncuestaRespuestaGrupo(
        encuesta_id=encuesta.id,
        empleado_id=rh.empleado_id,
        fecha_dia=date(2026, 7, 21),
    )
    db.add(grupo)
    await db.flush()

    respuesta_1 = EncuestaRespuesta(
        grupo_id=grupo.id,
        pregunta_id=pregunta_likert.id,
        valor_likert=4,
    )
    db.add(respuesta_1)
    await db.flush()

    respuesta_2 = EncuestaRespuesta(
        grupo_id=grupo.id,
        pregunta_id=pregunta_likert.id,
        valor_likert=5,
    )
    db.add(respuesta_2)
    with pytest.raises(IntegrityError):
        await db.flush()

    await db.rollback()


# ===========================================================================
# 5. Cascade: borrar encuesta borra preguntas/opciones/participantes/
#    grupos/respuestas
# ===========================================================================


@pytest.mark.asyncio
async def test_cascade_borrar_encuesta_borra_dependencias(db):
    rh = await make_empleado(db, rol="rh", nombre="RH Cascade")
    empleado = await make_empleado(db, rol="empleado", nombre="Empleado Cascade")

    encuesta, pregunta_likert, pregunta_opcion, opcion_a, opcion_b = (
        await _make_encuesta_con_preguntas(db, creado_por_id=rh.empleado_id)
    )

    participante = EncuestaParticipante(
        encuesta_id=encuesta.id,
        empleado_id=empleado.empleado_id,
    )
    db.add(participante)
    await db.flush()

    grupo = EncuestaRespuestaGrupo(
        encuesta_id=encuesta.id,
        empleado_id=empleado.empleado_id,
        fecha_dia=date(2026, 7, 21),
    )
    db.add(grupo)
    await db.flush()

    respuesta = EncuestaRespuesta(
        grupo_id=grupo.id,
        pregunta_id=pregunta_likert.id,
        valor_likert=3,
    )
    db.add(respuesta)
    await db.flush()

    respuesta_opcion = EncuestaRespuestaOpcion(
        respuesta_id=respuesta.id,
        opcion_id=opcion_a.id,
    )
    db.add(respuesta_opcion)
    await db.flush()

    encuesta_id = encuesta.id
    pregunta_likert_id = pregunta_likert.id
    pregunta_opcion_id = pregunta_opcion.id
    opcion_a_id = opcion_a.id
    opcion_b_id = opcion_b.id
    participante_id = participante.id
    grupo_id = grupo.id
    respuesta_id = respuesta.id
    respuesta_opcion_id = respuesta_opcion.id

    await db.delete(encuesta)
    await db.flush()

    assert (await db.execute(
        select(EncuestaPregunta).where(EncuestaPregunta.id.in_(
            [pregunta_likert_id, pregunta_opcion_id]
        ))
    )).scalars().all() == []

    assert (await db.execute(
        select(EncuestaOpcion).where(EncuestaOpcion.id.in_([opcion_a_id, opcion_b_id]))
    )).scalars().all() == []

    assert (await db.execute(
        select(EncuestaParticipante).where(EncuestaParticipante.id == participante_id)
    )).scalar_one_or_none() is None

    assert (await db.execute(
        select(EncuestaRespuestaGrupo).where(EncuestaRespuestaGrupo.id == grupo_id)
    )).scalar_one_or_none() is None

    assert (await db.execute(
        select(EncuestaRespuesta).where(EncuestaRespuesta.id == respuesta_id)
    )).scalar_one_or_none() is None

    assert (await db.execute(
        select(EncuestaRespuestaOpcion).where(EncuestaRespuestaOpcion.id == respuesta_opcion_id)
    )).scalar_one_or_none() is None

    assert (await db.execute(
        select(Encuesta).where(Encuesta.id == encuesta_id)
    )).scalar_one_or_none() is None


# ===========================================================================
# Bonus: EncuestaPlantilla (definicion JSONB)
# ===========================================================================


@pytest.mark.asyncio
async def test_encuesta_plantilla_definicion_jsonb(db):
    plantilla = EncuestaPlantilla(
        nombre="Clima laboral",
        descripcion="Plantilla predefinida de clima laboral",
        tipo="clima",
        es_predefinida=True,
        definicion=[
            {
                "orden": 1,
                "tipo": "likert",
                "texto": "El ambiente de trabajo es agradable",
                "requerida": True,
                "seleccion_multiple": False,
            },
            {
                "orden": 2,
                "tipo": "texto",
                "texto": "Que es lo mejor de trabajar aqui",
                "requerida": False,
                "seleccion_multiple": False,
            },
        ],
    )
    db.add(plantilla)
    await db.flush()
    await db.refresh(plantilla)

    assert plantilla.es_predefinida is True
    assert len(plantilla.definicion) == 2
    assert plantilla.definicion[0]["tipo"] == "likert"

# tests/test_ciclo_desempeno_models.py
"""
Tests de la capa de datos del modulo Ciclo de Desempeno (orquestador).

Cubre: creacion de CicloDesempeno con defaults de estado/pesos/umbrales,
creacion de CicloDesempenoResultado con snapshot NULL-able leido via la
relacion inversa, UNIQUE (ciclo_id, empleado_id), cascade de borrado
(ciclo -> resultados) y que meta_ciclo_id/eval360_campana_id acepten NULL.
"""

from datetime import date, datetime
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.ciclo_desempeno import (
    CicloDesempeno,
    CicloDesempenoResultado,
    CICLO_DESEMPENO_BANDAS,
    CICLO_DESEMPENO_ESTADOS,
)
from tests.conftest import make_empleado


async def test_ciclo_desempeno_defaults_estado_pesos_umbrales(db):
    ciclo = CicloDesempeno(nombre="Ciclo Desempeno 2026")
    db.add(ciclo)
    await db.flush()

    assert ciclo.id is not None
    assert ciclo.estado == "borrador"
    assert ciclo.peso_metas == Decimal("60")
    assert ciclo.peso_competencias == Decimal("40")
    assert ciclo.umbral_medio == Decimal("50")
    assert ciclo.umbral_alto == Decimal("75")
    # FKs opcionales sin especificar
    assert ciclo.meta_ciclo_id is None
    assert ciclo.eval360_campana_id is None


async def test_ciclo_desempeno_acepta_fks_opcionales_y_fechas(db):
    ciclo = CicloDesempeno(
        nombre="Ciclo Desempeno con enlaces",
        descripcion="Ciclo ligado a metas y eval 360",
        fecha_inicio=date(2026, 1, 1),
        fecha_fin=date(2026, 12, 31),
        estado="activo",
        meta_ciclo_id=None,
        eval360_campana_id=None,
        config={"segmentacion": "9box"},
    )
    db.add(ciclo)
    await db.flush()

    await db.refresh(ciclo)
    assert ciclo.fecha_inicio == date(2026, 1, 1)
    assert ciclo.fecha_fin == date(2026, 12, 31)
    assert ciclo.estado == "activo"
    assert ciclo.meta_ciclo_id is None
    assert ciclo.eval360_campana_id is None
    assert ciclo.config == {"segmentacion": "9box"}


async def test_ciclo_desempeno_resultado_snapshot_nullable_y_relacion(db):
    empleado = await make_empleado(db)
    ciclo = CicloDesempeno(nombre="Ciclo Desempeno")
    db.add(ciclo)
    await db.flush()

    resultado = CicloDesempenoResultado(
        ciclo_id=ciclo.id,
        empleado_id=empleado.empleado_id,
    )
    db.add(resultado)
    await db.flush()

    assert resultado.id is not None
    # Snapshot fields aceptan NULL
    assert resultado.cumplimiento_metas is None
    assert resultado.calificacion_360_raw is None
    assert resultado.calificacion_360_norm is None
    assert resultado.escala_min is None
    assert resultado.escala_max is None
    assert resultado.calificacion_desempeno is None
    assert resultado.peso_metas_efectivo is None
    assert resultado.peso_competencias_efectivo is None
    assert resultado.potencial is None
    assert resultado.banda_desempeno is None
    assert resultado.banda_potencial is None
    assert resultado.segmento_9box is None
    assert resultado.potencial_capturado_por_id is None
    assert resultado.potencial_capturado_at is None
    assert resultado.snapshot_at is None

    await db.refresh(ciclo, attribute_names=["resultados"])
    assert [r.id for r in ciclo.resultados] == [resultado.id]
    assert resultado.ciclo.id == ciclo.id


async def test_ciclo_desempeno_resultado_con_snapshot_completo(db):
    empleado = await make_empleado(db)
    jefe = await make_empleado(db)
    ciclo = CicloDesempeno(nombre="Ciclo Desempeno")
    db.add(ciclo)
    await db.flush()

    ahora = datetime(2026, 7, 21, 12, 0, 0)
    resultado = CicloDesempenoResultado(
        ciclo_id=ciclo.id,
        empleado_id=empleado.empleado_id,
        cumplimiento_metas=Decimal("85.50"),
        calificacion_360_raw=Decimal("4.20"),
        calificacion_360_norm=Decimal("84.00"),
        escala_min=Decimal("1.00"),
        escala_max=Decimal("5.00"),
        calificacion_desempeno=Decimal("84.60"),
        peso_metas_efectivo=Decimal("60.00"),
        peso_competencias_efectivo=Decimal("40.00"),
        potencial=Decimal("70.00"),
        banda_desempeno="alto",
        banda_potencial="medio",
        segmento_9box="estrella_emergente",
        potencial_capturado_por_id=jefe.empleado_id,
        potencial_capturado_at=ahora,
        snapshot_at=ahora,
    )
    db.add(resultado)
    await db.flush()
    await db.refresh(resultado)

    assert resultado.cumplimiento_metas == Decimal("85.50")
    assert resultado.calificacion_desempeno == Decimal("84.60")
    assert resultado.banda_desempeno == "alto"
    assert resultado.banda_potencial == "medio"
    assert resultado.segmento_9box == "estrella_emergente"
    assert resultado.potencial_capturado_por_id == jefe.empleado_id
    assert resultado.potencial_capturado_at == ahora
    assert resultado.snapshot_at == ahora


async def test_ciclo_desempeno_resultado_unique_ciclo_empleado(db):
    empleado = await make_empleado(db)
    ciclo = CicloDesempeno(nombre="Ciclo Desempeno")
    db.add(ciclo)
    await db.flush()

    db.add(CicloDesempenoResultado(ciclo_id=ciclo.id, empleado_id=empleado.empleado_id))
    await db.flush()

    db.add(CicloDesempenoResultado(ciclo_id=ciclo.id, empleado_id=empleado.empleado_id))
    with pytest.raises(IntegrityError):
        await db.flush()


async def test_ciclo_desempeno_cascade_borra_resultados(db):
    empleado = await make_empleado(db)
    ciclo = CicloDesempeno(nombre="Ciclo Desempeno")
    db.add(ciclo)
    await db.flush()

    resultado = CicloDesempenoResultado(ciclo_id=ciclo.id, empleado_id=empleado.empleado_id)
    db.add(resultado)
    await db.flush()

    ciclo_id = ciclo.id
    resultado_id = resultado.id

    await db.delete(ciclo)
    await db.flush()

    assert (await db.get(CicloDesempeno, ciclo_id)) is None
    assert (await db.get(CicloDesempenoResultado, resultado_id)) is None


def test_constantes_de_dominio():
    assert CICLO_DESEMPENO_ESTADOS == ("borrador", "activo", "cerrado")
    assert CICLO_DESEMPENO_BANDAS == ("bajo", "medio", "alto")

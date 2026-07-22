# tests/test_ciclo_desempeno_schemas.py
"""
Tests unitarios de los validadores de los schemas Pydantic del modulo
Ciclo de Desempeno (app/schemas/ciclo_desempeno.py). Sin BD: son schemas
puros, no ejercitan service/router (eso va en Tarea 4/5).

Cubre: suma de pesos > 0, orden de umbrales, potencial en [0, 100],
fecha_fin >= fecha_inicio (Create y Update) y estado/banda validos en
los Response.
"""

from datetime import date, datetime
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas.ciclo_desempeno import (
    CicloDesempenoCreate,
    CicloDesempenoResponse,
    CicloDesempenoResultadoResponse,
    CicloDesempenoUpdate,
    MisResultadoResponse,
    PotencialUpdateItem,
    PotencialUpdateRequest,
)


def _base_create_kwargs(**overrides):
    kwargs = dict(
        nombre="Ciclo 2026",
        fecha_inicio=date(2026, 1, 1),
        fecha_fin=date(2026, 12, 31),
    )
    kwargs.update(overrides)
    return kwargs


# ── CicloDesempenoCreate ─────────────────────────────────────────────────


def test_create_ok_con_defaults():
    ciclo = CicloDesempenoCreate(**_base_create_kwargs())
    assert ciclo.peso_metas == Decimal("60")
    assert ciclo.peso_competencias == Decimal("40")
    assert ciclo.umbral_medio == Decimal("50")
    assert ciclo.umbral_alto == Decimal("75")


def test_create_exige_fecha_inicio_y_fin():
    with pytest.raises(ValidationError):
        CicloDesempenoCreate(nombre="Ciclo sin periodo")


def test_create_fecha_fin_menor_a_inicio_falla():
    with pytest.raises(ValidationError):
        CicloDesempenoCreate(
            **_base_create_kwargs(
                fecha_inicio=date(2026, 6, 1), fecha_fin=date(2026, 1, 1)
            )
        )


def test_create_pesos_suma_cero_falla():
    with pytest.raises(ValidationError):
        CicloDesempenoCreate(
            **_base_create_kwargs(peso_metas=Decimal("0"), peso_competencias=Decimal("0"))
        )


def test_create_pesos_suma_positiva_ok_aunque_uno_sea_cero():
    ciclo = CicloDesempenoCreate(
        **_base_create_kwargs(peso_metas=Decimal("100"), peso_competencias=Decimal("0"))
    )
    assert ciclo.peso_metas == Decimal("100")


@pytest.mark.parametrize(
    "umbral_medio,umbral_alto",
    [
        (Decimal("0"), Decimal("75")),      # umbral_medio no > 0
        (Decimal("80"), Decimal("75")),     # medio > alto
        (Decimal("50"), Decimal("50")),     # medio == alto
        (Decimal("50"), Decimal("100")),    # alto no < 100
    ],
)
def test_create_umbrales_invalidos_fallan(umbral_medio, umbral_alto):
    with pytest.raises(ValidationError):
        CicloDesempenoCreate(
            **_base_create_kwargs(umbral_medio=umbral_medio, umbral_alto=umbral_alto)
        )


def test_create_umbrales_validos_ok():
    ciclo = CicloDesempenoCreate(
        **_base_create_kwargs(umbral_medio=Decimal("40"), umbral_alto=Decimal("80"))
    )
    assert ciclo.umbral_medio == Decimal("40")
    assert ciclo.umbral_alto == Decimal("80")


# ── CicloDesempenoUpdate (validadores condicionales) ────────────────────


def test_update_sin_campos_no_falla():
    upd = CicloDesempenoUpdate()
    assert upd.nombre is None


def test_update_fecha_fin_menor_a_inicio_falla():
    with pytest.raises(ValidationError):
        CicloDesempenoUpdate(fecha_inicio=date(2026, 6, 1), fecha_fin=date(2026, 1, 1))


def test_update_solo_una_fecha_no_dispara_validacion():
    upd = CicloDesempenoUpdate(fecha_inicio=date(2026, 6, 1))
    assert upd.fecha_fin is None


def test_update_pesos_suma_cero_falla():
    with pytest.raises(ValidationError):
        CicloDesempenoUpdate(peso_metas=Decimal("0"), peso_competencias=Decimal("0"))


def test_update_umbrales_invalidos_fallan():
    with pytest.raises(ValidationError):
        CicloDesempenoUpdate(umbral_medio=Decimal("80"), umbral_alto=Decimal("75"))


def test_update_solo_un_umbral_no_dispara_validacion():
    upd = CicloDesempenoUpdate(umbral_medio=Decimal("90"))
    assert upd.umbral_alto is None


# ── Potencial (captura batch) ────────────────────────────────────────────


def test_potencial_item_en_rango_ok():
    item = PotencialUpdateItem(empleado_id=1, potencial=Decimal("55.5"))
    assert item.potencial == Decimal("55.5")


@pytest.mark.parametrize("valor", [Decimal("-1"), Decimal("100.01"), Decimal("101")])
def test_potencial_item_fuera_de_rango_falla(valor):
    with pytest.raises(ValidationError):
        PotencialUpdateItem(empleado_id=1, potencial=valor)


def test_potencial_request_lista_vacia_falla():
    with pytest.raises(ValidationError):
        PotencialUpdateRequest(items=[])


def test_potencial_request_ok():
    req = PotencialUpdateRequest(
        items=[PotencialUpdateItem(empleado_id=1, potencial=Decimal("10"))]
    )
    assert len(req.items) == 1


# ── Estado / banda invalidos en los Response ────────────────────────────


def _base_ciclo_response_kwargs(**overrides):
    kwargs = dict(
        id=1,
        nombre="Ciclo 2026",
        estado="borrador",
        peso_metas=Decimal("60"),
        peso_competencias=Decimal("40"),
        umbral_medio=Decimal("50"),
        umbral_alto=Decimal("75"),
        created_at=datetime(2026, 1, 1),
        updated_at=datetime(2026, 1, 1),
    )
    kwargs.update(overrides)
    return kwargs


def test_ciclo_response_estado_invalido_falla():
    with pytest.raises(ValidationError):
        CicloDesempenoResponse(**_base_ciclo_response_kwargs(estado="no-existe"))


def test_ciclo_response_estado_valido_ok():
    resp = CicloDesempenoResponse(**_base_ciclo_response_kwargs())
    assert resp.estado == "borrador"


def test_resultado_response_banda_invalida_falla():
    with pytest.raises(ValidationError):
        CicloDesempenoResultadoResponse(
            id=1, ciclo_id=1, empleado_id=1, banda_desempeno="extremo"
        )


def test_resultado_response_banda_none_ok():
    resp = CicloDesempenoResultadoResponse(id=1, ciclo_id=1, empleado_id=1)
    assert resp.banda_desempeno is None


def test_mis_resultado_response_banda_invalida_falla():
    with pytest.raises(ValidationError):
        MisResultadoResponse(ciclo_id=1, banda_desempeno="extremo")


def test_mis_resultado_response_ok():
    resp = MisResultadoResponse(ciclo_id=1, banda_desempeno="alto")
    assert resp.banda_desempeno == "alto"

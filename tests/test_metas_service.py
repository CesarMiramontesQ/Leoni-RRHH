# tests/test_metas_service.py
"""Tests del service de Metas (Tarea 2): formulas de calculo (avance de
resultado clave/meta, cumplimiento ponderado), ciclo de vida y validaciones.

No hay router aun (Tarea 3): todo se ejercita a nivel service con la sesion
de tests (SQLite in-memory, ver tests/conftest.py).
"""

from datetime import date
from decimal import Decimal

import pytest

from app.core.exceptions import ConflictError, DomainValidationError, NotFoundError
from app.models.metas import Meta, MetaResultadoClave
from app.schemas.metas import (
    MetaCicloCreate,
    MetaCreate,
    MetaFiltros,
    MetaUpdate,
    ResultadoClaveCreate,
    ResultadoClaveUpdate,
)
from app.services.metas_service import MetasService, calcular_avance_rc
from tests.conftest import make_empleado

# Sin `pytestmark = pytest.mark.asyncio`: `pytest.ini` usa asyncio_mode=auto
# (ver tests/conftest.py / otros test_*.py), y este modulo mezcla tests
# sincronos (formula pura / wrappers de calculo sobre objetos en memoria) con
# tests async (service + BD) — marcar el modulo entero como asyncio generaria
# un warning en cada test sincrono.


# ── Helpers ──────────────────────────────────────────────────────────────


async def _crear_ciclo_activo(service: MetasService, creador, **overrides) -> int:
    data = MetaCicloCreate(
        nombre=overrides.pop("nombre", "2026 Q1"),
        descripcion=overrides.pop("descripcion", None),
        fecha_inicio=overrides.pop("fecha_inicio", date(2026, 1, 1)),
        fecha_fin=overrides.pop("fecha_fin", date(2026, 3, 31)),
        creado_por_id=creador.empleado_id,
    )
    ciclo = await service.crear_ciclo(data)
    await service.activar_ciclo(ciclo.id)
    return ciclo.id


def _rc_data(
    titulo="OPLs",
    tipo_metrica="numero",
    direccion="subir",
    valor_inicial=Decimal("0"),
    valor_objetivo=Decimal("8"),
    valor_actual=None,
    orden=1,
) -> ResultadoClaveCreate:
    return ResultadoClaveCreate(
        orden=orden,
        titulo=titulo,
        tipo_metrica=tipo_metrica,
        direccion=direccion,
        valor_inicial=valor_inicial,
        valor_objetivo=valor_objetivo,
        valor_actual=valor_actual,
    )


async def _crear_meta_individual(
    service: MetasService, ciclo_id: int, empleado, jefe, peso="40", resultados_clave=None
):
    data = MetaCreate(
        ciclo_id=ciclo_id,
        nivel="individual",
        empleado_id=empleado.empleado_id,
        titulo="Calidad L3",
        peso=Decimal(peso),
        asignada_por_id=jefe.empleado_id,
        resultados_clave=resultados_clave if resultados_clave is not None else [_rc_data()],
    )
    return await service.crear_meta(data)


async def _crear_meta_equipo(
    service: MetasService, ciclo_id: int, jefe, peso="100", resultados_clave=None
):
    data = MetaCreate(
        ciclo_id=ciclo_id,
        nivel="equipo",
        area_id=10,
        lider_id=jefe.empleado_id,
        titulo="Meta de equipo produccion",
        peso=Decimal(peso),
        asignada_por_id=jefe.empleado_id,
        resultados_clave=resultados_clave if resultados_clave is not None else [],
    )
    return await service.crear_meta(data)


# ══════════════════════════════════════════════════════════════════════════
# Formula de avance de resultado clave (funcion pura)
# ══════════════════════════════════════════════════════════════════════════


@pytest.mark.parametrize(
    "tipo,direccion,ini,obj,act,esp",
    [
        ("porcentaje", "bajar", 5, 2, 3.5, 50),  # (5-3.5)/(5-2)=0.5
        ("numero", "subir", 0, 8, 5, 63),  # 5/8=0.625->63 (redondeo half-up documentado)
        ("numero", "subir", 0, 8, 10, 100),  # clamp superior
        ("numero", "bajar", 5, 2, 6, 0),  # clamp inferior
        ("booleano", "subir", 0, 1, 1, 100),
        ("booleano", "subir", 0, 1, 0, 0),
        ("numero", "subir", 4, 4, 4, 100),  # denom 0 y cumple -> 100 (borde documentado)
        ("numero", "subir", 4, 4, 3, 0),  # denom 0 y no cumple -> 0 (borde documentado)
        ("numero", "bajar", 4, 4, 4, 100),  # denom 0 (bajar) y cumple -> 100
    ],
)
def test_avance_rc_formula_pura(tipo, direccion, ini, obj, act, esp):
    assert calcular_avance_rc(tipo, direccion, ini, obj, act) == esp


def test_avance_rc_via_service_envuelve_la_funcion_pura(db):
    service = MetasService(db)
    rc = MetaResultadoClave(
        tipo_metrica="numero",
        direccion="subir",
        valor_inicial=Decimal("0"),
        valor_objetivo=Decimal("8"),
        valor_actual=Decimal("5"),
    )
    assert service.avance_rc(rc) == 63


# ══════════════════════════════════════════════════════════════════════════
# Avance de meta (promedio de RC / roll-up de equipo)
# ══════════════════════════════════════════════════════════════════════════


def test_avance_meta_individual_promedio_simple_de_rc(db):
    service = MetasService(db)
    meta = Meta(nivel="individual")
    meta.resultados_clave = [
        MetaResultadoClave(
            tipo_metrica="numero", direccion="subir",
            valor_inicial=Decimal("0"), valor_objetivo=Decimal("10"), valor_actual=Decimal("10"),
        ),  # 100
        MetaResultadoClave(
            tipo_metrica="numero", direccion="subir",
            valor_inicial=Decimal("0"), valor_objetivo=Decimal("10"), valor_actual=Decimal("0"),
        ),  # 0
    ]
    assert service.avance_meta(meta) == 50


def test_avance_meta_sin_resultados_clave_es_cero(db):
    service = MetasService(db)
    meta = Meta(nivel="individual")
    meta.resultados_clave = []
    assert service.avance_meta(meta) == 0.0


def test_avance_meta_equipo_usa_rc_propios_si_existen(db):
    service = MetasService(db)
    meta_equipo = Meta(nivel="equipo")
    meta_equipo.resultados_clave = [
        MetaResultadoClave(
            tipo_metrica="numero", direccion="subir",
            valor_inicial=Decimal("0"), valor_objetivo=Decimal("10"), valor_actual=Decimal("6"),
        ),  # 60
    ]
    meta_equipo.submetas = [Meta(nivel="individual", resultados_clave=[])]  # avance 0
    # Si tuviera que hacer roll-up de submetas, daria 0; como tiene RC propios, usa esos (60).
    assert service.avance_meta(meta_equipo) == 60


def test_avance_meta_equipo_rollup_submetas_si_no_tiene_rc_propios(db):
    service = MetasService(db)

    submeta_a = Meta(nivel="individual")
    submeta_a.resultados_clave = [
        MetaResultadoClave(
            tipo_metrica="numero", direccion="subir",
            valor_inicial=Decimal("0"), valor_objetivo=Decimal("10"), valor_actual=Decimal("10"),
        ),  # 100
    ]
    submeta_b = Meta(nivel="individual")
    submeta_b.resultados_clave = [
        MetaResultadoClave(
            tipo_metrica="numero", direccion="subir",
            valor_inicial=Decimal("0"), valor_objetivo=Decimal("10"), valor_actual=Decimal("0"),
        ),  # 0
    ]

    meta_equipo = Meta(nivel="equipo")
    meta_equipo.resultados_clave = []
    meta_equipo.submetas = [submeta_a, submeta_b]

    assert service.avance_meta(meta_equipo) == 50


def test_avance_meta_equipo_sin_rc_ni_submetas_es_cero(db):
    service = MetasService(db)
    meta_equipo = Meta(nivel="equipo")
    meta_equipo.resultados_clave = []
    meta_equipo.submetas = []
    assert service.avance_meta(meta_equipo) == 0.0


# ══════════════════════════════════════════════════════════════════════════
# Cumplimiento ponderado del empleado
# ══════════════════════════════════════════════════════════════════════════


async def test_cumplimiento_empleado_ponderado(db):
    jefe = await make_empleado(db, rol="supervisor")
    empleado = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)
    service = MetasService(db)
    ciclo_id = await _crear_ciclo_activo(service, jefe)

    meta1 = await _crear_meta_individual(service, ciclo_id, empleado, jefe, peso="40")
    meta2 = await _crear_meta_individual(
        service, ciclo_id, empleado, jefe, peso="60",
        resultados_clave=[_rc_data(titulo="RC2")],
    )
    await service.cerrar_meta(meta1.id, calificacion=80, actor_id=jefe.empleado_id)
    await service.cerrar_meta(meta2.id, calificacion=50, actor_id=jefe.empleado_id)

    cumplimiento = await service.cumplimiento_empleado(ciclo_id, empleado.empleado_id)
    # (40*80 + 60*50) / 100 = 62
    assert cumplimiento == 62


async def test_cumplimiento_empleado_sin_metas_cerradas_es_cero(db):
    jefe = await make_empleado(db, rol="supervisor")
    empleado = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)
    service = MetasService(db)
    ciclo_id = await _crear_ciclo_activo(service, jefe)
    await _crear_meta_individual(service, ciclo_id, empleado, jefe)

    cumplimiento = await service.cumplimiento_empleado(ciclo_id, empleado.empleado_id)
    assert cumplimiento == 0.0


# ══════════════════════════════════════════════════════════════════════════
# Ciclo: creacion, activacion, cierre
# ══════════════════════════════════════════════════════════════════════════


async def test_crear_ciclo_valida_fecha_fin_posterior_a_inicio(db):
    jefe = await make_empleado(db, rol="rh")
    service = MetasService(db)
    data = MetaCicloCreate(
        nombre="Ciclo invalido",
        fecha_inicio=date(2026, 3, 31),
        fecha_fin=date(2026, 1, 1),
        creado_por_id=jefe.empleado_id,
    )
    with pytest.raises(DomainValidationError):
        await service.crear_ciclo(data)


async def test_crear_ciclo_inicia_en_borrador(db):
    jefe = await make_empleado(db, rol="rh")
    service = MetasService(db)
    ciclo = await service.crear_ciclo(
        MetaCicloCreate(
            nombre="Ciclo nuevo",
            fecha_inicio=date(2026, 1, 1),
            fecha_fin=date(2026, 3, 31),
            creado_por_id=jefe.empleado_id,
        )
    )
    assert ciclo.estado == "borrador"


async def test_activar_ciclo_que_no_esta_en_borrador_falla(db):
    jefe = await make_empleado(db, rol="rh")
    service = MetasService(db)
    ciclo_id = await _crear_ciclo_activo(service, jefe)
    with pytest.raises(ConflictError):
        await service.activar_ciclo(ciclo_id)


async def test_activar_ciclo_inexistente_404(db):
    service = MetasService(db)
    with pytest.raises(NotFoundError):
        await service.activar_ciclo(999999)


async def test_cerrar_ciclo_requiere_calificacion_previa_de_metas_individuales(db):
    jefe = await make_empleado(db, rol="supervisor")
    empleado = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)
    service = MetasService(db)
    ciclo_id = await _crear_ciclo_activo(service, jefe)
    await _crear_meta_individual(service, ciclo_id, empleado, jefe)

    with pytest.raises(ConflictError):
        await service.cerrar_ciclo(ciclo_id)


async def test_cerrar_ciclo_congela_metas_de_equipo_sin_exigir_calificacion(db):
    jefe = await make_empleado(db, rol="supervisor")
    service = MetasService(db)
    ciclo_id = await _crear_ciclo_activo(service, jefe)
    meta_equipo = await _crear_meta_equipo(service, ciclo_id, jefe)
    assert meta_equipo.estado == "asignada"

    ciclo = await service.cerrar_ciclo(ciclo_id)
    assert ciclo.estado == "cerrado"

    meta_equipo_final = await service.get_meta(meta_equipo.id)
    assert meta_equipo_final.estado == "cerrada"
    assert meta_equipo_final.calificacion_cierre is None


async def test_cerrar_ciclo_calcula_cumplimiento_end_to_end(db):
    jefe = await make_empleado(db, rol="supervisor")
    empleado = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)
    service = MetasService(db)
    ciclo_id = await _crear_ciclo_activo(service, jefe)

    meta1 = await _crear_meta_individual(service, ciclo_id, empleado, jefe, peso="40")
    meta2 = await _crear_meta_individual(
        service, ciclo_id, empleado, jefe, peso="60",
        resultados_clave=[_rc_data(titulo="RC2")],
    )
    await service.cerrar_meta(meta1.id, calificacion=80, actor_id=jefe.empleado_id)
    await service.cerrar_meta(meta2.id, calificacion=50, actor_id=jefe.empleado_id)

    ciclo = await service.cerrar_ciclo(ciclo_id)
    assert ciclo.estado == "cerrado"

    cumplimiento = await service.cumplimiento_empleado(ciclo_id, empleado.empleado_id)
    assert cumplimiento == 62


async def test_cerrar_ciclo_que_no_esta_activo_falla(db):
    jefe = await make_empleado(db, rol="rh")
    service = MetasService(db)
    ciclo = await service.crear_ciclo(
        MetaCicloCreate(
            nombre="Ciclo borrador",
            fecha_inicio=date(2026, 1, 1),
            fecha_fin=date(2026, 3, 31),
            creado_por_id=jefe.empleado_id,
        )
    )
    with pytest.raises(ConflictError):
        await service.cerrar_ciclo(ciclo.id)


# ══════════════════════════════════════════════════════════════════════════
# Meta: creacion y validaciones
# ══════════════════════════════════════════════════════════════════════════


async def test_crear_meta_individual_requiere_empleado_id(db):
    jefe = await make_empleado(db, rol="supervisor")
    service = MetasService(db)
    ciclo_id = await _crear_ciclo_activo(service, jefe)
    data = MetaCreate(
        ciclo_id=ciclo_id,
        nivel="individual",
        titulo="Sin empleado",
        peso=Decimal("100"),
        asignada_por_id=jefe.empleado_id,
    )
    with pytest.raises(DomainValidationError):
        await service.crear_meta(data)


async def test_crear_meta_equipo_requiere_area_y_lider(db):
    jefe = await make_empleado(db, rol="supervisor")
    service = MetasService(db)
    ciclo_id = await _crear_ciclo_activo(service, jefe)
    data = MetaCreate(
        ciclo_id=ciclo_id,
        nivel="equipo",
        titulo="Sin area ni lider",
        peso=Decimal("100"),
        asignada_por_id=jefe.empleado_id,
    )
    with pytest.raises(DomainValidationError):
        await service.crear_meta(data)


async def test_crear_meta_en_ciclo_no_activo_falla(db):
    jefe = await make_empleado(db, rol="rh")
    empleado = await make_empleado(db, rol="empleado")
    service = MetasService(db)
    ciclo = await service.crear_ciclo(
        MetaCicloCreate(
            nombre="Ciclo borrador",
            fecha_inicio=date(2026, 1, 1),
            fecha_fin=date(2026, 3, 31),
            creado_por_id=jefe.empleado_id,
        )
    )
    with pytest.raises(ConflictError):
        await _crear_meta_individual(service, ciclo.id, empleado, jefe)


async def test_crear_meta_padre_debe_ser_nivel_equipo(db):
    jefe = await make_empleado(db, rol="supervisor")
    empleado = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)
    service = MetasService(db)
    ciclo_id = await _crear_ciclo_activo(service, jefe)
    meta_individual = await _crear_meta_individual(service, ciclo_id, empleado, jefe)

    data = MetaCreate(
        ciclo_id=ciclo_id,
        nivel="individual",
        empleado_id=empleado.empleado_id,
        titulo="Con padre invalido",
        peso=Decimal("10"),
        asignada_por_id=jefe.empleado_id,
        meta_padre_id=meta_individual.id,
    )
    with pytest.raises(DomainValidationError):
        await service.crear_meta(data)


async def test_crear_meta_padre_debe_ser_del_mismo_ciclo(db):
    jefe = await make_empleado(db, rol="supervisor")
    empleado = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)
    service = MetasService(db)
    ciclo_id_1 = await _crear_ciclo_activo(service, jefe, nombre="Ciclo 1")
    ciclo_id_2 = await _crear_ciclo_activo(
        service, jefe, nombre="Ciclo 2", fecha_inicio=date(2026, 4, 1), fecha_fin=date(2026, 6, 30)
    )
    meta_equipo_ciclo1 = await _crear_meta_equipo(service, ciclo_id_1, jefe)

    data = MetaCreate(
        ciclo_id=ciclo_id_2,
        nivel="individual",
        empleado_id=empleado.empleado_id,
        titulo="Con padre de otro ciclo",
        peso=Decimal("10"),
        asignada_por_id=jefe.empleado_id,
        meta_padre_id=meta_equipo_ciclo1.id,
    )
    with pytest.raises(DomainValidationError):
        await service.crear_meta(data)


async def test_crear_meta_con_meta_padre_equipo_valido_enlaza_submeta(db):
    jefe = await make_empleado(db, rol="supervisor")
    empleado = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)
    service = MetasService(db)
    ciclo_id = await _crear_ciclo_activo(service, jefe)
    meta_equipo = await _crear_meta_equipo(service, ciclo_id, jefe)

    meta = await _crear_meta_individual(
        service, ciclo_id, empleado, jefe,
    )
    meta_actualizada = await service.actualizar_meta(
        meta.id, MetaUpdate(meta_padre_id=meta_equipo.id)
    )
    assert meta_actualizada.meta_padre_id == meta_equipo.id


async def test_crear_meta_padre_hijo_debe_ser_nivel_individual(db):
    """Fix (revision Tarea 2): meta_padre_id solo aplica a una meta hija de
    nivel individual. Una meta de equipo con meta_padre_id a otra meta de
    equipo (equipo-de-equipos) debe rechazarse: el spec describe las
    submetas como "metas individuales enlazadas por meta_padre_id", y
    permitir un padre de equipo evitaba la recursion de un solo nivel de
    `avance_meta` (equipo -> equipo -> ...)."""
    jefe = await make_empleado(db, rol="supervisor")
    service = MetasService(db)
    ciclo_id = await _crear_ciclo_activo(service, jefe)
    meta_equipo_padre = await _crear_meta_equipo(service, ciclo_id, jefe)

    data = MetaCreate(
        ciclo_id=ciclo_id,
        nivel="equipo",
        area_id=11,
        lider_id=jefe.empleado_id,
        titulo="Equipo hijo invalido",
        peso=Decimal("50"),
        asignada_por_id=jefe.empleado_id,
        meta_padre_id=meta_equipo_padre.id,
    )
    with pytest.raises(DomainValidationError):
        await service.crear_meta(data)


async def test_actualizar_meta_padre_hijo_debe_ser_nivel_individual(db):
    """Mismo guard que crear_meta, pero via actualizar_meta (MetaUpdate no
    permite cambiar `nivel`, asi que se valida contra el nivel existente de
    la meta)."""
    jefe = await make_empleado(db, rol="supervisor")
    service = MetasService(db)
    ciclo_id = await _crear_ciclo_activo(service, jefe)
    meta_equipo_padre = await _crear_meta_equipo(service, ciclo_id, jefe, peso="50")
    meta_equipo_hijo = await _crear_meta_equipo(service, ciclo_id, jefe, peso="50")

    with pytest.raises(DomainValidationError):
        await service.actualizar_meta(
            meta_equipo_hijo.id, MetaUpdate(meta_padre_id=meta_equipo_padre.id)
        )


async def test_agregar_rc_valor_objetivo_igual_inicial_no_booleano_falla(db):
    jefe = await make_empleado(db, rol="supervisor")
    empleado = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)
    service = MetasService(db)
    ciclo_id = await _crear_ciclo_activo(service, jefe)
    meta = await _crear_meta_individual(service, ciclo_id, empleado, jefe, resultados_clave=[])

    with pytest.raises(DomainValidationError):
        await service.agregar_rc(
            meta.id,
            ResultadoClaveCreate(
                titulo="RC invalido",
                tipo_metrica="numero",
                direccion="subir",
                valor_inicial=Decimal("5"),
                valor_objetivo=Decimal("5"),
            ),
        )


async def test_agregar_rc_booleano_permite_valor_objetivo_igual_inicial(db):
    jefe = await make_empleado(db, rol="supervisor")
    empleado = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)
    service = MetasService(db)
    ciclo_id = await _crear_ciclo_activo(service, jefe)
    meta = await _crear_meta_individual(service, ciclo_id, empleado, jefe, resultados_clave=[])

    rc = await service.agregar_rc(
        meta.id,
        ResultadoClaveCreate(
            titulo="RC booleano",
            tipo_metrica="booleano",
            direccion="subir",
            valor_inicial=Decimal("0"),
            valor_objetivo=Decimal("0"),
        ),
    )
    assert rc.tipo_metrica == "booleano"


# ══════════════════════════════════════════════════════════════════════════
# Ciclo de vida de la meta: check-in, edicion/eliminacion, cierre
# ══════════════════════════════════════════════════════════════════════════


async def test_registrar_checkin_primer_checkin_pasa_meta_a_en_progreso(db):
    jefe = await make_empleado(db, rol="supervisor")
    empleado = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)
    service = MetasService(db)
    ciclo_id = await _crear_ciclo_activo(service, jefe)
    meta = await _crear_meta_individual(service, ciclo_id, empleado, jefe)
    assert meta.estado == "asignada"
    rc_id = meta.resultados_clave[0].id

    checkin = await service.registrar_checkin(
        rc_id, autor_id=empleado.empleado_id, valor=Decimal("5"), nota="Avance inicial"
    )
    assert checkin.avance_resultante == 63  # (5-0)/(8-0)=0.625 -> 63

    meta_actualizada = await service.get_meta(meta.id)
    assert meta_actualizada.estado == "en_progreso"


async def test_registrar_checkin_en_meta_cerrada_falla(db):
    jefe = await make_empleado(db, rol="supervisor")
    empleado = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)
    service = MetasService(db)
    ciclo_id = await _crear_ciclo_activo(service, jefe)
    meta = await _crear_meta_individual(service, ciclo_id, empleado, jefe)
    rc_id = meta.resultados_clave[0].id
    await service.cerrar_meta(meta.id, calificacion=90)

    with pytest.raises(ConflictError):
        await service.registrar_checkin(rc_id, autor_id=empleado.empleado_id, valor=Decimal("3"))


async def test_actualizar_meta_de_ciclo_cerrado_falla_409(db):
    jefe = await make_empleado(db, rol="supervisor")
    empleado = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)
    service = MetasService(db)
    ciclo_id = await _crear_ciclo_activo(service, jefe)
    meta = await _crear_meta_individual(service, ciclo_id, empleado, jefe)
    await service.cerrar_meta(meta.id, calificacion=90)
    await service.cerrar_ciclo(ciclo_id)

    with pytest.raises(ConflictError):
        await service.actualizar_meta(meta.id, MetaUpdate(titulo="Nuevo titulo"))


async def test_cerrar_meta_calificacion_fuera_de_rango_falla_422(db):
    jefe = await make_empleado(db, rol="supervisor")
    empleado = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)
    service = MetasService(db)
    ciclo_id = await _crear_ciclo_activo(service, jefe)
    meta = await _crear_meta_individual(service, ciclo_id, empleado, jefe)

    with pytest.raises(DomainValidationError):
        await service.cerrar_meta(meta.id, calificacion=101)
    with pytest.raises(DomainValidationError):
        await service.cerrar_meta(meta.id, calificacion=-1)


async def test_cerrar_meta_ya_cerrada_falla(db):
    jefe = await make_empleado(db, rol="supervisor")
    empleado = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)
    service = MetasService(db)
    ciclo_id = await _crear_ciclo_activo(service, jefe)
    meta = await _crear_meta_individual(service, ciclo_id, empleado, jefe)
    await service.cerrar_meta(meta.id, calificacion=90)

    with pytest.raises(ConflictError):
        await service.cerrar_meta(meta.id, calificacion=50)


async def test_eliminar_meta_con_checkins_falla(db):
    jefe = await make_empleado(db, rol="supervisor")
    empleado = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)
    service = MetasService(db)
    ciclo_id = await _crear_ciclo_activo(service, jefe)
    meta = await _crear_meta_individual(service, ciclo_id, empleado, jefe)
    rc_id = meta.resultados_clave[0].id
    await service.registrar_checkin(rc_id, autor_id=empleado.empleado_id, valor=Decimal("2"))

    with pytest.raises(ConflictError):
        await service.eliminar_meta(meta.id)


async def test_eliminar_meta_sin_checkins_ok(db):
    jefe = await make_empleado(db, rol="supervisor")
    empleado = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)
    service = MetasService(db)
    ciclo_id = await _crear_ciclo_activo(service, jefe)
    meta = await _crear_meta_individual(service, ciclo_id, empleado, jefe)

    await service.eliminar_meta(meta.id)
    with pytest.raises(NotFoundError):
        await service.get_meta(meta.id)


# ══════════════════════════════════════════════════════════════════════════
# Self-service / listados
# ══════════════════════════════════════════════════════════════════════════


async def test_list_mis_metas_solo_devuelve_metas_del_empleado(db):
    jefe = await make_empleado(db, rol="supervisor")
    empleado_a = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)
    empleado_b = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)
    service = MetasService(db)
    ciclo_id = await _crear_ciclo_activo(service, jefe)
    await _crear_meta_individual(service, ciclo_id, empleado_a, jefe)
    await _crear_meta_individual(service, ciclo_id, empleado_b, jefe)

    mis_metas = await service.list_mis_metas(empleado_a.empleado_id, ciclo_id=ciclo_id)
    assert len(mis_metas) == 1
    assert mis_metas[0].empleado_id == empleado_a.empleado_id


async def test_get_mi_meta_de_otro_empleado_no_encontrada(db):
    jefe = await make_empleado(db, rol="supervisor")
    empleado_a = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)
    empleado_b = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)
    service = MetasService(db)
    ciclo_id = await _crear_ciclo_activo(service, jefe)
    meta = await _crear_meta_individual(service, ciclo_id, empleado_a, jefe)

    with pytest.raises(NotFoundError):
        await service.get_mi_meta(meta.id, empleado_b.empleado_id)

    encontrada = await service.get_mi_meta(meta.id, empleado_a.empleado_id)
    assert encontrada.id == meta.id


async def test_list_metas_filtra_por_ciclo_empleado_y_nivel(db):
    jefe = await make_empleado(db, rol="supervisor")
    empleado = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)
    service = MetasService(db)
    ciclo_id = await _crear_ciclo_activo(service, jefe)
    await _crear_meta_individual(service, ciclo_id, empleado, jefe)
    await _crear_meta_equipo(service, ciclo_id, jefe)

    solo_individuales = await service.list_metas(
        MetaFiltros(ciclo_id=ciclo_id, nivel="individual")
    )
    assert len(solo_individuales) == 1
    assert solo_individuales[0].nivel == "individual"

    todas = await service.list_metas(MetaFiltros(ciclo_id=ciclo_id))
    assert len(todas) == 2


async def test_list_ciclos_filtra_por_estado(db):
    jefe = await make_empleado(db, rol="rh")
    service = MetasService(db)
    await service.crear_ciclo(
        MetaCicloCreate(
            nombre="Borrador", fecha_inicio=date(2026, 1, 1), fecha_fin=date(2026, 3, 31),
            creado_por_id=jefe.empleado_id,
        )
    )
    await _crear_ciclo_activo(service, jefe, nombre="Activo")

    activos = await service.list_ciclos(estado="activo")
    assert len(activos) == 1
    assert activos[0].nombre == "Activo"

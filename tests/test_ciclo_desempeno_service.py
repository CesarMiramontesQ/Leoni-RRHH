# tests/test_ciclo_desempeno_service.py
"""Tests del service de Ciclo de Desempeno (Tarea 4): formulas puras de
calculo (normalizacion 360, combinacion de senales, bandas), ciclo de vida
(activar materializa universo, cerrar congela snapshot) y captura de
potencial / matriz 9-Box.

Sin router aun (Tarea 5): todo se ejercita a nivel service con la sesion de
tests (SQLite in-memory, ver tests/conftest.py). Reutiliza `MetasService`
para la senal de metas (mismo patron que `tests/test_metas_service.py`) y
construye entidades de Evaluacion 360 (`Eval360Campana`/`Eval360Escala`/
`Eval360Participante`/`Eval360Resultado`) directamente via ORM para la senal
360 -- el flujo completo de activar/responder/cerrar una campana pertenece
al dominio de otro modulo (ya cubierto en `tests/test_evaluacion360.py`);
aqui solo se necesita la fila resumen `Eval360Resultado` en la forma que
`CicloDesempenoService` consume.
"""

from datetime import date
from decimal import Decimal

import pytest

from app.core.exceptions import ConflictError, DomainValidationError, ForbiddenError, NotFoundError
from app.models.ciclo_desempeno import CICLO_DESEMPENO_BANDAS, CicloDesempeno
from app.models.evaluacion360 import (
    Eval360Campana,
    Eval360Escala,
    Eval360Participante,
    Eval360Resultado,
)
from app.repositories.ciclo_desempeno_repository import CicloDesempenoRepository
from app.schemas.ciclo_desempeno import (
    CicloDesempenoCreate,
    CicloDesempenoUpdate,
    PotencialUpdateItem,
)
from app.schemas.metas import MetaCicloCreate, MetaCreate, ResultadoClaveCreate
from app.services.ciclo_desempeno_service import (
    CicloDesempenoService,
    banda,
    combinar_score,
    normalizar_360,
)
from app.services.metas_service import MetasService
from tests.conftest import make_empleado

# Sin `pytestmark = pytest.mark.asyncio`: pytest.ini usa asyncio_mode=auto
# (ver otros test_*.py del repo); este modulo mezcla tests sincronos
# (funciones puras) con tests async (service + BD).


# ══════════════════════════════════════════════════════════════════════════
# Helpers — Metas (senal 1)
# ══════════════════════════════════════════════════════════════════════════


async def _crear_meta_ciclo_activo(metas_service: MetasService, creador, **overrides) -> int:
    data = MetaCicloCreate(
        nombre=overrides.pop("nombre", "Metas 2026 Q1"),
        fecha_inicio=overrides.pop("fecha_inicio", date(2026, 1, 1)),
        fecha_fin=overrides.pop("fecha_fin", date(2026, 3, 31)),
        creado_por_id=creador.empleado_id,
    )
    ciclo = await metas_service.crear_ciclo(data)
    await metas_service.activar_ciclo(ciclo.id)
    return ciclo.id


async def _crear_meta_individual_cerrada(
    metas_service: MetasService, meta_ciclo_id: int, empleado, jefe, *, peso="100", calificacion=80
) -> None:
    meta = await metas_service.crear_meta(
        MetaCreate(
            ciclo_id=meta_ciclo_id,
            nivel="individual",
            empleado_id=empleado.empleado_id,
            titulo="Meta calidad",
            peso=Decimal(peso),
            asignada_por_id=jefe.empleado_id,
            resultados_clave=[
                ResultadoClaveCreate(
                    titulo="RC", tipo_metrica="numero", direccion="subir",
                    valor_inicial=Decimal("0"), valor_objetivo=Decimal("10"),
                )
            ],
        )
    )
    await metas_service.cerrar_meta(meta.id, calificacion=calificacion, actor_id=jefe.empleado_id)


async def _crear_meta_individual_abierta(
    metas_service: MetasService, meta_ciclo_id: int, empleado, jefe, *, peso="100"
) -> None:
    await metas_service.crear_meta(
        MetaCreate(
            ciclo_id=meta_ciclo_id,
            nivel="individual",
            empleado_id=empleado.empleado_id,
            titulo="Meta sin cerrar",
            peso=Decimal(peso),
            asignada_por_id=jefe.empleado_id,
            resultados_clave=[
                ResultadoClaveCreate(
                    titulo="RC", tipo_metrica="numero", direccion="subir",
                    valor_inicial=Decimal("0"), valor_objetivo=Decimal("10"),
                )
            ],
        )
    )


# ══════════════════════════════════════════════════════════════════════════
# Helpers — Evaluacion 360 (senal 2), construidas directo via ORM
# ══════════════════════════════════════════════════════════════════════════


async def _crear_campana_360(db, *, estado="activa", vmin=1, vmax=5, con_escala=True) -> Eval360Campana:
    escala = None
    if con_escala:
        escala = Eval360Escala(nombre=f"Escala {vmin}-{vmax}", valor_min=vmin, valor_max=vmax)
        db.add(escala)
        await db.flush()
    campana = Eval360Campana(
        nombre="Campana 360 2026", estado=estado,
        escala_id=escala.id if escala else None,
    )
    db.add(campana)
    await db.flush()
    return campana


async def _agregar_participante_360(
    db, campana_id: int, empleado_id: int, *, calificacion_general=None
) -> Eval360Participante:
    participante = Eval360Participante(
        campana_id=campana_id, empleado_id=empleado_id, estado="completada",
    )
    db.add(participante)
    await db.flush()
    if calificacion_general is not None:
        db.add(Eval360Resultado(
            participante_id=participante.id, competencia_id=None,
            calificacion_general=calificacion_general,
        ))
        await db.flush()
    return participante


# ══════════════════════════════════════════════════════════════════════════
# Helpers — Ciclo de Desempeno
# ══════════════════════════════════════════════════════════════════════════


async def _crear_cd_ciclo(service: CicloDesempenoService, **overrides):
    data = CicloDesempenoCreate(
        nombre=overrides.pop("nombre", "Ciclo Desempeno 2026"),
        fecha_inicio=overrides.pop("fecha_inicio", date(2026, 1, 1)),
        fecha_fin=overrides.pop("fecha_fin", date(2026, 6, 30)),
        meta_ciclo_id=overrides.pop("meta_ciclo_id", None),
        eval360_campana_id=overrides.pop("eval360_campana_id", None),
        peso_metas=overrides.pop("peso_metas", Decimal("60")),
        peso_competencias=overrides.pop("peso_competencias", Decimal("40")),
        umbral_medio=overrides.pop("umbral_medio", Decimal("50")),
        umbral_alto=overrides.pop("umbral_alto", Decimal("75")),
    )
    return await service.crear_ciclo(data)


# ══════════════════════════════════════════════════════════════════════════
# Normalizacion 360 -> 0-100 (funcion pura)
# ══════════════════════════════════════════════════════════════════════════


def test_normalizar_360_likert_4_de_1_a_5_da_75():
    assert normalizar_360(4, 1, 5) == 75.0


def test_normalizar_360_bordes_vmin_da_0_vmax_da_100():
    assert normalizar_360(1, 1, 5) == 0.0
    assert normalizar_360(5, 1, 5) == 100.0


def test_normalizar_360_calificacion_none_es_ausente():
    assert normalizar_360(None, 1, 5) is None


def test_normalizar_360_escala_degenerada_es_ausente():
    """Borde defensivo: vmax <= vmin (no deberia ocurrir con escalas reales
    del catalogo, pero evita ZeroDivisionError)."""
    assert normalizar_360(3, 5, 5) is None


def test_normalizar_360_clamp_fuera_de_rango():
    assert normalizar_360(6, 1, 5) == 100.0
    assert normalizar_360(0, 1, 5) == 0.0


# ══════════════════════════════════════════════════════════════════════════
# Combinacion de senales (funcion pura)
# ══════════════════════════════════════════════════════════════════════════


def test_combinar_score_ambas_senales_60_40():
    # (60*80 + 40*60) / 100 = 72.0
    score, pm_ef, pc_ef = combinar_score(80, 60, 60, 40)
    assert score == 72.0
    assert (pm_ef, pc_ef) == (60.0, 40.0)


def test_combinar_score_solo_metas_presente():
    score, pm_ef, pc_ef = combinar_score(80, None, 60, 40)
    assert score == 80.0
    assert (pm_ef, pc_ef) == (100.0, 0.0)


def test_combinar_score_solo_360_presente():
    score, pm_ef, pc_ef = combinar_score(None, 60, 60, 40)
    assert score == 60.0
    assert (pm_ef, pc_ef) == (0.0, 100.0)


def test_combinar_score_ninguna_senal_presente_es_none():
    score, pm_ef, pc_ef = combinar_score(None, None, 60, 40)
    assert (score, pm_ef, pc_ef) == (None, None, None)


def test_combinar_score_metas_en_cero_real_cuenta_distinto_de_ausente():
    """Distingue "metas ausente" (None, se renormaliza a solo-360) de
    "metas=0 real" (cuenta como 0 en la ponderacion, no se descarta)."""
    solo_360, _, _ = combinar_score(None, 60, 60, 40)
    con_cero_real, pm_ef, pc_ef = combinar_score(0, 60, 60, 40)
    assert solo_360 == 60.0
    # (60*0 + 40*60)/100 = 24.0 -- muy distinto de tratar el 0 como ausente.
    assert con_cero_real == 24.0
    assert (pm_ef, pc_ef) == (60.0, 40.0)


# ══════════════════════════════════════════════════════════════════════════
# Bandas y segmentos 9-Box (funcion pura)
# ══════════════════════════════════════════════════════════════════════════


@pytest.mark.parametrize(
    "valor,esperado",
    [(49.9, "bajo"), (50, "medio"), (74.9, "medio"), (75, "alto")],
)
def test_banda_umbrales_exactos(valor, esperado):
    assert banda(valor, 50, 75) == esperado


def test_banda_genera_9_segmentos_posibles():
    segmentos = {f"{bd}_{bp}" for bd in CICLO_DESEMPENO_BANDAS for bp in CICLO_DESEMPENO_BANDAS}
    assert len(segmentos) == 9


# ══════════════════════════════════════════════════════════════════════════
# Ciclo de vida: crear / actualizar (borrador)
# ══════════════════════════════════════════════════════════════════════════


async def test_crear_ciclo_inicia_en_borrador(db):
    service = CicloDesempenoService(db)
    ciclo = await _crear_cd_ciclo(service)
    assert ciclo.estado == "borrador"
    assert ciclo.total_participantes == 0


async def test_actualizar_ciclo_en_borrador_ok(db):
    service = CicloDesempenoService(db)
    ciclo = await _crear_cd_ciclo(service)
    actualizado = await service.actualizar_ciclo(
        ciclo.id, CicloDesempenoUpdate(nombre="Renombrado", peso_metas=Decimal("70"))
    )
    assert actualizado.nombre == "Renombrado"
    assert actualizado.peso_metas == Decimal("70")


async def test_actualizar_ciclo_fuera_de_borrador_falla_409(db):
    service = CicloDesempenoService(db)
    campana = await _crear_campana_360(db)
    ciclo = await _crear_cd_ciclo(service, eval360_campana_id=campana.id)
    await service.activar_ciclo(ciclo.id)

    with pytest.raises(ConflictError):
        await service.actualizar_ciclo(ciclo.id, CicloDesempenoUpdate(nombre="No deberia aplicar"))


async def test_actualizar_ciclo_deja_pesos_en_cero_falla_422(db):
    """`CicloDesempenoUpdate` valida la suma de pesos SOLO cuando ambos campos
    vienen en la misma peticion; el service debe revalidar el resultado final
    tras el merge para el caso "un update toca un solo lado del par y deja el
    otro en un estado invalido" (aqui: ciclo ya en peso_competencias=0, un
    update que solo envia peso_metas=0 deja la suma en 0 sin que el
    validador cruzado del schema lo vea)."""
    service = CicloDesempenoService(db)
    ciclo = await _crear_cd_ciclo(
        service, peso_metas=Decimal("100"), peso_competencias=Decimal("0")
    )
    with pytest.raises(DomainValidationError):
        await service.actualizar_ciclo(
            ciclo.id, CicloDesempenoUpdate(peso_metas=Decimal("0"))
        )


# ══════════════════════════════════════════════════════════════════════════
# Ciclo de vida: activar
# ══════════════════════════════════════════════════════════════════════════


async def test_activar_ciclo_materializa_universo_union_metas_y_360(db):
    jefe = await make_empleado(db, rol="supervisor")
    solo_metas = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)
    solo_360 = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)
    ambas = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)

    metas_service = MetasService(db)
    meta_ciclo_id = await _crear_meta_ciclo_activo(metas_service, jefe)
    await _crear_meta_individual_cerrada(metas_service, meta_ciclo_id, solo_metas, jefe, calificacion=90)
    await _crear_meta_individual_cerrada(metas_service, meta_ciclo_id, ambas, jefe, calificacion=70)

    campana = await _crear_campana_360(db)
    await _agregar_participante_360(db, campana.id, solo_360.empleado_id, calificacion_general=4)
    await _agregar_participante_360(db, campana.id, ambas.empleado_id, calificacion_general=3)

    service = CicloDesempenoService(db)
    ciclo = await _crear_cd_ciclo(
        service, meta_ciclo_id=meta_ciclo_id, eval360_campana_id=campana.id
    )
    activado = await service.activar_ciclo(ciclo.id)
    assert activado.estado == "activo"
    assert activado.total_participantes == 3

    resultados = await service.resultados_ciclo(ciclo.id)
    empleado_ids = {r.empleado_id for r in resultados}
    assert empleado_ids == {solo_metas.empleado_id, solo_360.empleado_id, ambas.empleado_id}


async def test_activar_ciclo_que_no_esta_en_borrador_falla(db):
    service = CicloDesempenoService(db)
    campana = await _crear_campana_360(db)
    ciclo = await _crear_cd_ciclo(service, eval360_campana_id=campana.id)
    await service.activar_ciclo(ciclo.id)

    with pytest.raises(ConflictError):
        await service.activar_ciclo(ciclo.id)


async def test_activar_ciclo_inexistente_404(db):
    service = CicloDesempenoService(db)
    with pytest.raises(NotFoundError):
        await service.activar_ciclo(999999)


async def test_activar_ciclo_sin_periodo_falla_422(db):
    """El schema `CicloDesempenoCreate` exige fecha_inicio/fecha_fin, pero el
    modelo las deja nullable (Tarea 1) -- se construye el ciclo directo via
    repositorio (bypass del schema) para forzar el borde y confirmar que
    `activar_ciclo` lo rechaza."""
    service = CicloDesempenoService(db)
    repo = CicloDesempenoRepository(db)
    campana = await _crear_campana_360(db)
    ciclo = await repo.create_ciclo(
        CicloDesempeno(
            nombre="Sin periodo", estado="borrador",
            fecha_inicio=None, fecha_fin=None,
            eval360_campana_id=campana.id,
        )
    )
    with pytest.raises(DomainValidationError):
        await service.activar_ciclo(ciclo.id)


async def test_activar_ciclo_sin_senal_vinculada_falla_422(db):
    service = CicloDesempenoService(db)
    ciclo = await _crear_cd_ciclo(service)  # sin meta_ciclo_id ni eval360_campana_id
    with pytest.raises(DomainValidationError):
        await service.activar_ciclo(ciclo.id)


# ══════════════════════════════════════════════════════════════════════════
# Ciclo de vida: cerrar (snapshot / congelado)
# ══════════════════════════════════════════════════════════════════════════


async def _armar_ciclo_activo_con_ambas_senales(db, *, calificacion_meta=80, calificacion_360=4):
    """Arma un ciclo activo con un empleado con ambas senales presentes
    (metas cerradas + resultado 360), meta_ciclo YA cerrado y campana 360 YA
    finalizada -- listo para `cerrar_ciclo` sin necesitar `forzar`."""
    jefe = await make_empleado(db, rol="supervisor")
    empleado = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)

    metas_service = MetasService(db)
    meta_ciclo_id = await _crear_meta_ciclo_activo(metas_service, jefe)
    await _crear_meta_individual_cerrada(
        metas_service, meta_ciclo_id, empleado, jefe, calificacion=calificacion_meta
    )
    await metas_service.cerrar_ciclo(meta_ciclo_id)

    campana = await _crear_campana_360(db, estado="finalizada")
    await _agregar_participante_360(
        db, campana.id, empleado.empleado_id, calificacion_general=calificacion_360
    )

    service = CicloDesempenoService(db)
    ciclo = await _crear_cd_ciclo(
        service, meta_ciclo_id=meta_ciclo_id, eval360_campana_id=campana.id
    )
    await service.activar_ciclo(ciclo.id)
    return service, ciclo.id, empleado, meta_ciclo_id, campana


async def test_cerrar_ciclo_calcula_y_congela_snapshot(db):
    service, ciclo_id, empleado, _, _ = await _armar_ciclo_activo_con_ambas_senales(
        db, calificacion_meta=80, calificacion_360=4
    )
    cerrado = await service.cerrar_ciclo(ciclo_id)
    assert cerrado.estado == "cerrado"

    resultados = await service.resultados_ciclo(ciclo_id)
    r = next(x for x in resultados if x.empleado_id == empleado.empleado_id)
    assert r.cumplimiento_metas == Decimal("80.00")
    assert r.calificacion_360_raw == Decimal("4.00")
    assert r.calificacion_360_norm == Decimal("75.00")
    # (60*80 + 40*75)/100 = 78.0 -> "alto" (umbral_alto default = 75, 78 >= 75)
    assert r.calificacion_desempeno == Decimal("78.00")
    assert r.banda_desempeno == "alto"
    assert r.snapshot_at is not None


async def test_cerrar_ciclo_snapshot_no_cambia_si_mutan_senales_fuente(db):
    service, ciclo_id, empleado, meta_ciclo_id, campana = (
        await _armar_ciclo_activo_con_ambas_senales(db, calificacion_meta=80, calificacion_360=4)
    )
    await service.cerrar_ciclo(ciclo_id)
    antes = await service.resultados_ciclo(ciclo_id)
    r_antes = next(x for x in antes if x.empleado_id == empleado.empleado_id)
    assert r_antes.calificacion_desempeno == Decimal("78.00")

    # Mutar las fuentes DESPUES del cierre: reabrir/recalificar la meta y
    # borrar el resultado 360.
    metas_repo = MetasService(db).repo
    metas = await metas_repo.list_metas(ciclo_id=meta_ciclo_id, empleado_id=empleado.empleado_id)
    metas[0].estado = "en_progreso"
    metas[0].calificacion_cierre = Decimal("10")
    from sqlalchemy import delete
    await db.execute(delete(Eval360Resultado))
    await db.flush()

    despues = await service.resultados_ciclo(ciclo_id)
    r_despues = next(x for x in despues if x.empleado_id == empleado.empleado_id)
    assert r_despues.calificacion_desempeno == Decimal("78.00")
    assert r_despues.cumplimiento_metas == Decimal("80.00")
    assert r_despues.calificacion_360_raw == Decimal("4.00")


async def test_cerrar_ciclo_con_meta_ciclo_no_cerrado_falla_422(db):
    jefe = await make_empleado(db, rol="supervisor")
    empleado = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)
    metas_service = MetasService(db)
    meta_ciclo_id = await _crear_meta_ciclo_activo(metas_service, jefe)
    await _crear_meta_individual_cerrada(metas_service, meta_ciclo_id, empleado, jefe)
    # meta_ciclo se deja "activo" (no se cierra).

    service = CicloDesempenoService(db)
    ciclo = await _crear_cd_ciclo(service, meta_ciclo_id=meta_ciclo_id)
    await service.activar_ciclo(ciclo.id)

    with pytest.raises(DomainValidationError):
        await service.cerrar_ciclo(ciclo.id)

    forzado = await service.cerrar_ciclo(ciclo.id, forzar=True)
    assert forzado.estado == "cerrado"


async def test_cerrar_ciclo_con_campana_360_no_finalizada_falla_422_y_override(db):
    jefe = await make_empleado(db, rol="supervisor")
    empleado = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)
    campana = await _crear_campana_360(db, estado="activa")  # no finalizada/cerrada
    await _agregar_participante_360(db, campana.id, empleado.empleado_id, calificacion_general=4)

    service = CicloDesempenoService(db)
    ciclo = await _crear_cd_ciclo(service, eval360_campana_id=campana.id)
    await service.activar_ciclo(ciclo.id)

    with pytest.raises(DomainValidationError):
        await service.cerrar_ciclo(ciclo.id)

    forzado = await service.cerrar_ciclo(ciclo.id, forzar=True)
    assert forzado.estado == "cerrado"


async def test_cerrar_ciclo_que_no_esta_activo_falla_409(db):
    service = CicloDesempenoService(db)
    campana = await _crear_campana_360(db)
    ciclo = await _crear_cd_ciclo(service, eval360_campana_id=campana.id)
    with pytest.raises(ConflictError):
        await service.cerrar_ciclo(ciclo.id)


# ══════════════════════════════════════════════════════════════════════════
# Resultados en vivo (ciclo activo): distinguir ausente vs cero real
# ══════════════════════════════════════════════════════════════════════════


async def test_resultados_ciclo_activo_distingue_metas_ausente_de_solo_360(db):
    jefe = await make_empleado(db, rol="supervisor")
    sin_metas_cerradas = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)

    metas_service = MetasService(db)
    meta_ciclo_id = await _crear_meta_ciclo_activo(metas_service, jefe)
    # Meta asignada pero NUNCA cerrada -> cumplimiento_empleado ausente (None),
    # no "0 real".
    await _crear_meta_individual_abierta(metas_service, meta_ciclo_id, sin_metas_cerradas, jefe)

    campana = await _crear_campana_360(db)
    await _agregar_participante_360(
        db, campana.id, sin_metas_cerradas.empleado_id, calificacion_general=5
    )

    service = CicloDesempenoService(db)
    ciclo = await _crear_cd_ciclo(
        service, meta_ciclo_id=meta_ciclo_id, eval360_campana_id=campana.id
    )
    await service.activar_ciclo(ciclo.id)

    resultados = await service.resultados_ciclo(ciclo.id)
    r = next(x for x in resultados if x.empleado_id == sin_metas_cerradas.empleado_id)
    assert r.cumplimiento_metas is None
    assert r.calificacion_360_norm == Decimal("100.00")
    # Solo 360 presente -> score = norm (no se diluye por la ausencia de metas).
    assert r.calificacion_desempeno == Decimal("100.00")
    assert r.peso_metas_efectivo == Decimal("0.00")
    assert r.peso_competencias_efectivo == Decimal("100.00")


async def test_resultados_ciclo_sin_ninguna_senal_no_tiene_banda(db):
    jefe = await make_empleado(db, rol="supervisor")
    empleado = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)
    metas_service = MetasService(db)
    meta_ciclo_id = await _crear_meta_ciclo_activo(metas_service, jefe)
    await _crear_meta_individual_abierta(metas_service, meta_ciclo_id, empleado, jefe)

    service = CicloDesempenoService(db)
    ciclo = await _crear_cd_ciclo(service, meta_ciclo_id=meta_ciclo_id)
    await service.activar_ciclo(ciclo.id)

    resultados = await service.resultados_ciclo(ciclo.id)
    r = next(x for x in resultados if x.empleado_id == empleado.empleado_id)
    assert r.calificacion_desempeno is None
    assert r.banda_desempeno is None


# ══════════════════════════════════════════════════════════════════════════
# Potencial: activo ok, cerrado 409
# ══════════════════════════════════════════════════════════════════════════


async def test_set_potencial_en_ciclo_activo_recalcula_banda_y_segmento(db):
    service, ciclo_id, empleado, _, _ = await _armar_ciclo_activo_con_ambas_senales(
        db, calificacion_meta=80, calificacion_360=4
    )
    admin = await make_empleado(db, rol="rh")

    resultados = await service.set_potencial(
        ciclo_id,
        [PotencialUpdateItem(empleado_id=empleado.empleado_id, potencial=Decimal("90"))],
        current_user_id=admin.empleado_id,
    )
    r = resultados[0]
    assert r.potencial == Decimal("90")
    assert r.banda_potencial == "alto"
    # Desempeno en vivo (78.0 -> "alto", 78 >= umbral_alto=75) + potencial "alto" -> segmento.
    assert r.banda_desempeno == "alto"
    assert r.segmento_9box == "alto_alto"
    assert r.potencial_capturado_por_id == admin.empleado_id
    assert r.potencial_capturado_at is not None


async def test_set_potencial_en_ciclo_cerrado_falla_409(db):
    service, ciclo_id, empleado, _, _ = await _armar_ciclo_activo_con_ambas_senales(db)
    admin = await make_empleado(db, rol="rh")
    await service.cerrar_ciclo(ciclo_id)

    with pytest.raises(ConflictError):
        await service.set_potencial(
            ciclo_id,
            [PotencialUpdateItem(empleado_id=empleado.empleado_id, potencial=Decimal("50"))],
            current_user_id=admin.empleado_id,
        )


async def test_set_potencial_empleado_fuera_de_scope_falla_403(db):
    service, ciclo_id, empleado, _, _ = await _armar_ciclo_activo_con_ambas_senales(db)
    admin = await make_empleado(db, rol="rh")

    with pytest.raises(ForbiddenError):
        await service.set_potencial(
            ciclo_id,
            [PotencialUpdateItem(empleado_id=empleado.empleado_id, potencial=Decimal("50"))],
            current_user_id=admin.empleado_id,
            empleado_ids_scope={999999},
        )


async def test_set_potencial_empleado_sin_resultado_en_ciclo_404(db):
    service, ciclo_id, _, _, _ = await _armar_ciclo_activo_con_ambas_senales(db)
    otro = await make_empleado(db, rol="empleado")
    admin = await make_empleado(db, rol="rh")

    with pytest.raises(NotFoundError):
        await service.set_potencial(
            ciclo_id,
            [PotencialUpdateItem(empleado_id=otro.empleado_id, potencial=Decimal("50"))],
            current_user_id=admin.empleado_id,
        )


# ══════════════════════════════════════════════════════════════════════════
# Matriz 9-Box
# ══════════════════════════════════════════════════════════════════════════


async def test_construir_9box_agrupa_por_celda_y_excluye_sin_banda(db):
    jefe = await make_empleado(db, rol="supervisor")
    alto_alto = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)
    sin_senales = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)

    metas_service = MetasService(db)
    meta_ciclo_id = await _crear_meta_ciclo_activo(metas_service, jefe)
    await _crear_meta_individual_cerrada(metas_service, meta_ciclo_id, alto_alto, jefe, calificacion=95)
    # sin_senales: ni metas cerradas ni 360 -> sin banda.
    await _crear_meta_individual_abierta(metas_service, meta_ciclo_id, sin_senales, jefe)

    campana = await _crear_campana_360(db)
    await _agregar_participante_360(db, campana.id, alto_alto.empleado_id, calificacion_general=5)

    service = CicloDesempenoService(db)
    ciclo = await _crear_cd_ciclo(
        service, meta_ciclo_id=meta_ciclo_id, eval360_campana_id=campana.id
    )
    await service.activar_ciclo(ciclo.id)
    admin = await make_empleado(db, rol="rh")
    await service.set_potencial(
        ciclo.id,
        [PotencialUpdateItem(empleado_id=alto_alto.empleado_id, potencial=Decimal("95"))],
        current_user_id=admin.empleado_id,
    )

    nueve_box = await service.construir_9box(ciclo.id)
    assert len(nueve_box.celdas) == 9

    celda_alto_alto = next(
        c for c in nueve_box.celdas if c.banda_desempeno == "alto" and c.banda_potencial == "alto"
    )
    assert [e.empleado_id for e in celda_alto_alto.empleados] == [alto_alto.empleado_id]
    assert celda_alto_alto.segmento == "alto_alto"

    # sin_senales no aparece en NINGUNA celda (sin banda_desempeno).
    todos_los_empleados_en_celdas = {
        e.empleado_id for c in nueve_box.celdas for e in c.empleados
    }
    assert sin_senales.empleado_id not in todos_los_empleados_en_celdas


# ══════════════════════════════════════════════════════════════════════════
# Self-service: mis_resultados
# ══════════════════════════════════════════════════════════════════════════


async def test_mis_resultados_solo_incluye_ciclos_cerrados(db):
    service, ciclo_id, empleado, _, _ = await _armar_ciclo_activo_con_ambas_senales(
        db, calificacion_meta=80, calificacion_360=4
    )

    # Ciclo activo: aun no debe aparecer en mis_resultados.
    antes = await service.mis_resultados(empleado.empleado_id)
    assert antes == []

    await service.cerrar_ciclo(ciclo_id)

    despues = await service.mis_resultados(empleado.empleado_id)
    assert len(despues) == 1
    assert despues[0].ciclo_id == ciclo_id
    assert despues[0].calificacion_desempeno == Decimal("78.00")
    assert despues[0].banda_desempeno == "alto"


async def test_mis_resultados_empleado_sin_resultados_es_lista_vacia(db):
    service = CicloDesempenoService(db)
    otro = await make_empleado(db, rol="empleado")
    assert await service.mis_resultados(otro.empleado_id) == []

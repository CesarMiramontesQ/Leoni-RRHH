"""Tests del modulo de Calibracion de Desempeno."""
from datetime import date, datetime, timezone
from decimal import Decimal

import pydantic
import pytest

from app.core.exceptions import ConflictError, DomainValidationError, NotFoundError
from app.models.ciclo_desempeno import CicloDesempeno, CicloDesempenoResultado
from app.repositories.ciclo_desempeno_repository import CicloDesempenoRepository
from app.schemas.ciclo_desempeno import (
    BandaAjusteItem,
    CicloDesempenoCreate,
    PotencialUpdateItem,
)
from app.schemas.metas import MetaCicloCreate, MetaCreate, ResultadoClaveCreate
from app.services.ciclo_desempeno_service import (
    DISTRIBUCION_OBJETIVO_DEFAULT,
    CicloDesempenoService,
    banda_efectiva,
    distribucion_bandas,
)
from app.services.metas_service import MetasService
from tests.conftest import auth_headers, make_empleado


def test_modelo_resultado_tiene_columnas_de_ajuste():
    r = CicloDesempenoResultado(ciclo_id=1, empleado_id=10)
    r.banda_desempeno_ajustada = "alto"
    r.banda_ajuste_motivo = "corrige sesgo del jefe"
    r.banda_ajustada_por_id = 99
    r.banda_ajustada_at = datetime.now(timezone.utc)
    assert r.banda_desempeno_ajustada == "alto"
    assert r.banda_ajuste_motivo == "corrige sesgo del jefe"
    assert r.banda_ajustada_por_id == 99
    assert r.banda_ajustada_at is not None

    cols = set(CicloDesempenoResultado.__table__.columns.keys())
    assert {
        "banda_desempeno_ajustada",
        "banda_ajuste_motivo",
        "banda_ajustada_por_id",
        "banda_ajustada_at",
    } <= cols


def test_banda_efectiva_ajustada_gana():
    assert banda_efectiva("bajo", "alto") == "alto"


def test_banda_efectiva_sin_ajuste_usa_calculada():
    assert banda_efectiva("medio", None) == "medio"


def test_banda_efectiva_ambas_none():
    assert banda_efectiva(None, None) is None


def test_distribucion_bandas_mezcla():
    d = distribucion_bandas(["alto", "alto", "medio", "bajo", None])
    assert d["alto"] == 2 and d["medio"] == 1 and d["bajo"] == 1
    assert d["total"] == 4  # None se ignora
    assert d["pct"]["alto"] == 50.0
    assert d["pct"]["medio"] == 25.0
    assert d["pct"]["bajo"] == 25.0


def test_distribucion_bandas_vacia():
    d = distribucion_bandas([])
    assert d["total"] == 0
    assert d["pct"] == {"bajo": 0.0, "medio": 0.0, "alto": 0.0}


def test_distribucion_objetivo_default_suma_100():
    assert sum(DISTRIBUCION_OBJETIVO_DEFAULT.values()) == 100.0


async def _ciclo_activo_con_resultado(db, banda="medio", potencial=None, banda_potencial=None):
    """Crea un ciclo activo con un resultado ya poblado (banda_desempeno set)
    sin depender de fuentes metas/360."""
    ciclo = CicloDesempeno(nombre="C1", estado="activo", umbral_medio=50, umbral_alto=75)
    db.add(ciclo)
    await db.flush()
    repo = CicloDesempenoRepository(db)
    await repo.upsert_resultado(
        ciclo.id, 10,
        calificacion_desempeno=60,
        banda_desempeno=banda,
        potencial=potencial,
        banda_potencial=banda_potencial,
        segmento_9box=(f"{banda}_{banda_potencial}" if banda_potencial else None),
    )
    await db.commit()
    return ciclo


@pytest.mark.asyncio
async def test_ajustar_banda_sube_banda_y_audita(db):
    ciclo = await _ciclo_activo_con_resultado(db, banda="medio")
    svc = CicloDesempenoService(db)
    out = await svc.ajustar_banda(
        ciclo.id,
        [BandaAjusteItem(empleado_id=10, banda_ajustada="alto", motivo="corrige sesgo")],
        current_user_id=99,
    )
    assert out[0].banda_desempeno_ajustada == "alto"
    assert out[0].banda_desempeno_efectiva == "alto"
    # Sin meta_ciclo_id/eval360_campana_id vinculados, la banda CALCULADA en
    # vivo es None (sin senales); la efectiva viene del override.
    assert out[0].banda_desempeno is None
    assert out[0].banda_ajuste_motivo == "corrige sesgo"
    assert out[0].banda_ajustada_por_id == 99
    assert out[0].banda_ajustada_at is not None


@pytest.mark.asyncio
async def test_ajustar_banda_reversion_limpia_columnas(db):
    ciclo = await _ciclo_activo_con_resultado(db, banda="medio")
    svc = CicloDesempenoService(db)
    await svc.ajustar_banda(
        ciclo.id, [BandaAjusteItem(empleado_id=10, banda_ajustada="alto", motivo="x")],
        current_user_id=99,
    )
    out = await svc.ajustar_banda(
        ciclo.id, [BandaAjusteItem(empleado_id=10, banda_ajustada=None, motivo=None)],
        current_user_id=99,
    )
    assert out[0].banda_desempeno_ajustada is None
    assert out[0].banda_ajuste_motivo is None
    assert out[0].banda_ajustada_por_id is None
    assert out[0].banda_ajustada_at is None
    # Sin override y sin senales vinculadas, la efectiva vuelve a la
    # calculada en vivo, que es None (mismo motivo que el test anterior).
    assert out[0].banda_desempeno_efectiva is None


@pytest.mark.asyncio
async def test_ajustar_banda_motivo_vacio_rechaza(db):
    ciclo = await _ciclo_activo_con_resultado(db, banda="medio")
    svc = CicloDesempenoService(db)
    with pytest.raises(DomainValidationError):
        await svc.ajustar_banda(
            ciclo.id, [BandaAjusteItem(empleado_id=10, banda_ajustada="alto", motivo="  ")],
            current_user_id=99,
        )


def test_bandaajusteitem_banda_invalida_rechaza():
    """`banda_ajustada` invalida se rechaza al CONSTRUIR el schema (field_validator,
    autoridad unica), sin llegar al service."""
    with pytest.raises(pydantic.ValidationError):
        BandaAjusteItem(empleado_id=10, banda_ajustada="excelente", motivo="x")


@pytest.mark.asyncio
async def test_ajustar_banda_ciclo_no_activo_rechaza(db):
    ciclo = await _ciclo_activo_con_resultado(db, banda="medio")
    ciclo.estado = "cerrado"
    db.add(ciclo)
    await db.commit()
    svc = CicloDesempenoService(db)
    with pytest.raises(ConflictError):
        await svc.ajustar_banda(
            ciclo.id, [BandaAjusteItem(empleado_id=10, banda_ajustada="alto", motivo="x")],
            current_user_id=99,
        )


@pytest.mark.asyncio
async def test_ajustar_banda_empleado_fuera_del_ciclo_404(db):
    ciclo = await _ciclo_activo_con_resultado(db, banda="medio")
    svc = CicloDesempenoService(db)
    with pytest.raises(NotFoundError):
        await svc.ajustar_banda(
            ciclo.id, [BandaAjusteItem(empleado_id=777, banda_ajustada="alto", motivo="x")],
            current_user_id=99,
        )


@pytest.mark.asyncio
async def test_ajustar_banda_recompone_segmento_con_efectiva(db):
    ciclo = await _ciclo_activo_con_resultado(db, banda="medio", potencial=90, banda_potencial="alto")
    svc = CicloDesempenoService(db)
    out = await svc.ajustar_banda(
        ciclo.id, [BandaAjusteItem(empleado_id=10, banda_ajustada="alto", motivo="x")],
        current_user_id=99,
    )
    assert out[0].segmento_9box == "alto_alto"  # banda efectiva (alto), no la calculada (medio)


@pytest.mark.asyncio
async def test_distribucion_ciclo_cuenta_bandas_efectivas(db):
    ciclo = await _ciclo_activo_con_resultado(db, banda="bajo")
    svc = CicloDesempenoService(db)
    await svc.ajustar_banda(
        ciclo.id, [BandaAjusteItem(empleado_id=10, banda_ajustada="alto", motivo="x")],
        current_user_id=99,
    )
    dist = await svc.distribucion_ciclo(ciclo.id)
    assert dist.actual.alto == 1
    assert dist.actual.bajo == 0  # la calculada era bajo, pero cuenta la efectiva (alto)
    assert dist.objetivo["alto"] == 20.0
    assert dist.desviacion["alto"] == round(100.0 - 20.0, 2)


# ══════════════════════════════════════════════════════════════════════════
# Tests de API (HTTP) — endpoints PUT /calibracion y GET /distribucion.
# Montaje de auth/ciclo reproducido de tests/test_ciclo_desempeno_api.py:
# RH global = usuario rol="rh" con modulo 'ciclo-desempeno' (scope None);
# jefe = supervisor (scope de equipo != None -> 403 en calibracion global).
# El ciclo activo con resultado se arma via ORM (_ciclo_activo_con_resultado),
# mismo patron que los tests de service de arriba.
# ══════════════════════════════════════════════════════════════════════════
BASE = "/api/v1/ciclo-desempeno"


@pytest.mark.asyncio
async def test_api_calibracion_admin_rh_200(client, db):
    rh = await make_empleado(
        db, rol="rh", modulos_rh={"ciclo-desempeno": True}, email="calibrh1@leoni.test"
    )
    headers_admin_rh = await auth_headers(client, rh)
    ciclo = await _ciclo_activo_con_resultado(db, banda="medio")

    resp = await client.put(
        f"{BASE}/ciclos/{ciclo.id}/calibracion",
        json={"items": [{"empleado_id": 10, "banda_ajustada": "alto", "motivo": "corrige sesgo"}]},
        headers=headers_admin_rh,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()[0]["banda_desempeno_efectiva"] == "alto"


@pytest.mark.asyncio
async def test_api_calibracion_jefe_equipo_403(client, db):
    jefe = await make_empleado(db, rol="supervisor", email="calibjefe1@leoni.test")
    headers_jefe = await auth_headers(client, jefe)
    ciclo = await _ciclo_activo_con_resultado(db, banda="medio")

    resp = await client.put(
        f"{BASE}/ciclos/{ciclo.id}/calibracion",
        json={"items": [{"empleado_id": 10, "banda_ajustada": "alto", "motivo": "x"}]},
        headers=headers_jefe,
    )
    assert resp.status_code == 403, resp.text


@pytest.mark.asyncio
async def test_api_distribucion_admin_rh_200(client, db):
    rh = await make_empleado(
        db, rol="rh", modulos_rh={"ciclo-desempeno": True}, email="calibrh2@leoni.test"
    )
    headers_admin_rh = await auth_headers(client, rh)
    ciclo = await _ciclo_activo_con_resultado(db, banda="medio")

    resp = await client.get(
        f"{BASE}/ciclos/{ciclo.id}/distribucion",
        headers=headers_admin_rh,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "actual" in body and "objetivo" in body and "desviacion" in body


@pytest.mark.asyncio
async def test_api_distribucion_jefe_scope_no_ve_fuera_de_equipo(client, db):
    """Scope de jefe end-to-end via el endpoint /distribucion: un supervisor
    sin subordinados llega al endpoint (via `_gestion_or_equipo`) pero su scope
    (reportes directos, aqui vacio) NO incluye al empleado 10 del ciclo -> la
    distribucion sale vacia (total 0). Contrasta con el RH global, que ve la
    distribucion completa (`test_api_distribucion_admin_rh_200`). Confirma que
    /distribucion aplica `_resolve_scope` de jefe end-to-end.

    El caso "jefe CON subordinado real en el ciclo" se cubre a nivel service en
    `test_distribucion_ciclo_scope_de_jefe_cuenta_solo_su_equipo` (reproducir
    aqui el andamiaje completo de senal de metas via API seria duplicacion
    desproporcionada — vive en tests/test_ciclo_desempeno_api.py)."""
    jefe = await make_empleado(db, rol="supervisor", email="calibjefe2@leoni.test")
    headers_jefe = await auth_headers(client, jefe)
    ciclo = await _ciclo_activo_con_resultado(db, banda="medio")  # empleado 10, ajeno al jefe

    resp = await client.get(
        f"{BASE}/ciclos/{ciclo.id}/distribucion", headers=headers_jefe
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["actual"]["total"] == 0


# ══════════════════════════════════════════════════════════════════════════
# Cierre + calibracion (snapshot): la banda EFECTIVA se congela al cerrar.
# Usa una senal de metas REAL (meta_ciclo cerrado) para que la banda calculada
# sea un valor concreto (no None) y distinta de la ajustada — asi el snapshot
# demuestra que congela la efectiva, no la calculada. `_ciclo_activo_metas`
# replica el patron de tests/test_ciclo_desempeno_service.py (Metas via su
# propio service; solo-metas => calificacion_desempeno == calificacion de la
# meta, verificado alla).
# ══════════════════════════════════════════════════════════════════════════
async def _ciclo_activo_metas(db, *calificaciones):
    """Ciclo de desempeno ACTIVO con senal de metas real: un jefe, un empleado
    por cada `calificacion`, meta_ciclo con metas individuales cerradas
    (meta_ciclo cerrado -> cierre sin forzar), y un ciclo de desempeno
    vinculado ya activado (umbral_medio=50, umbral_alto=75). Solo-metas =>
    calificacion_desempeno == calificacion. Devuelve (service, ciclo, jefe,
    [empleados en el orden de `calificaciones`])."""
    jefe = await make_empleado(db, rol="supervisor")
    metas_service = MetasService(db)
    mc = await metas_service.crear_ciclo(
        MetaCicloCreate(
            nombre="Metas calib",
            fecha_inicio=date(2026, 1, 1),
            fecha_fin=date(2026, 3, 31),
            creado_por_id=jefe.empleado_id,
        )
    )
    await metas_service.activar_ciclo(mc.id)
    empleados = []
    for cal in calificaciones:
        emp = await make_empleado(db, rol="empleado", lider_id=jefe.empleado_id)
        meta = await metas_service.crear_meta(
            MetaCreate(
                ciclo_id=mc.id,
                nivel="individual",
                empleado_id=emp.empleado_id,
                titulo="Meta calidad",
                peso=Decimal("100"),
                asignada_por_id=jefe.empleado_id,
                resultados_clave=[
                    ResultadoClaveCreate(
                        titulo="RC", tipo_metrica="numero", direccion="subir",
                        valor_inicial=Decimal("0"), valor_objetivo=Decimal("10"),
                    )
                ],
            )
        )
        await metas_service.cerrar_meta(meta.id, calificacion=cal, actor_id=jefe.empleado_id)
        empleados.append(emp)
    await metas_service.cerrar_ciclo(mc.id)

    service = CicloDesempenoService(db)
    cd = await service.crear_ciclo(
        CicloDesempenoCreate(
            nombre="CD calib",
            fecha_inicio=date(2026, 1, 1),
            fecha_fin=date(2026, 6, 30),
            meta_ciclo_id=mc.id,
            peso_metas=Decimal("60"),
            peso_competencias=Decimal("40"),
            umbral_medio=Decimal("50"),
            umbral_alto=Decimal("75"),
        )
    )
    await service.activar_ciclo(cd.id)
    return service, cd, jefe, empleados


@pytest.mark.asyncio
async def test_cerrar_persiste_banda_efectiva(db):
    """Hueco #1: ciclo activo con resultado ajustado (calculada "bajo",
    ajustada "alto") -> tras cerrar, el snapshot congela la banda EFECTIVA
    (ajustada), recompone el segmento con ella, deja el score numerico intacto
    y conserva las columnas de auditoria del ajuste."""
    service, cd, jefe, (emp,) = await _ciclo_activo_metas(db, 20)  # score 20 -> calculada "bajo"
    admin = await make_empleado(db, rol="rh")
    # Potencial "alto" para que el segmento recompuesto sea significativo.
    await service.set_potencial(
        cd.id,
        [PotencialUpdateItem(empleado_id=emp.empleado_id, potencial=Decimal("90"))],
        current_user_id=admin.empleado_id,
    )
    await service.ajustar_banda(
        cd.id,
        [BandaAjusteItem(empleado_id=emp.empleado_id, banda_ajustada="alto", motivo="corrige sesgo")],
        current_user_id=admin.empleado_id,
    )
    await service.cerrar_ciclo(cd.id)  # meta_ciclo cerrado -> no requiere forzar

    repo = CicloDesempenoRepository(db)
    r = await repo.get_resultado(cd.id, emp.empleado_id)
    assert r.banda_desempeno == "alto"                    # efectiva congelada (no la calculada "bajo")
    assert r.segmento_9box == "alto_alto"                 # recompuesto con la efectiva + potencial alto
    assert r.calificacion_desempeno == Decimal("20.00")   # score numerico intacto (el ajuste no lo toca)
    assert r.banda_desempeno_ajustada == "alto"           # auditoria del ajuste conservada
    assert r.banda_ajuste_motivo == "corrige sesgo"
    assert r.banda_ajustada_por_id == admin.empleado_id
    assert r.banda_ajustada_at is not None


@pytest.mark.asyncio
async def test_cerrar_sin_ajuste_persiste_banda_calculada(db):
    """Hueco #2: resultado sin override -> tras cerrar, la banda persistida ==
    la calculada; no aparece override ni auditoria de ajuste."""
    service, cd, jefe, (emp,) = await _ciclo_activo_metas(db, 90)  # score 90 -> calculada "alto"
    await service.cerrar_ciclo(cd.id)

    repo = CicloDesempenoRepository(db)
    r = await repo.get_resultado(cd.id, emp.empleado_id)
    assert r.banda_desempeno == "alto"                    # == la calculada
    assert r.banda_desempeno_ajustada is None
    assert r.banda_ajustada_por_id is None
    assert r.calificacion_desempeno == Decimal("90.00")


@pytest.mark.asyncio
async def test_9box_agrupa_por_banda_efectiva(db):
    """Hueco #3: en ciclo activo, un empleado con banda calculada ("bajo")
    distinta de la ajustada ("alto") cae en la celda de la banda AJUSTADA
    (alto_alto), no en la de la calculada (bajo_alto)."""
    service, cd, jefe, (emp,) = await _ciclo_activo_metas(db, 20)  # calculada "bajo"
    admin = await make_empleado(db, rol="rh")
    await service.set_potencial(
        cd.id,
        [PotencialUpdateItem(empleado_id=emp.empleado_id, potencial=Decimal("90"))],
        current_user_id=admin.empleado_id,
    )
    await service.ajustar_banda(
        cd.id,
        [BandaAjusteItem(empleado_id=emp.empleado_id, banda_ajustada="alto", motivo="x")],
        current_user_id=admin.empleado_id,
    )

    nb = await service.construir_9box(cd.id)  # activo -> agrupa por banda efectiva en vivo

    def _emp_en(bd, bp):
        celda = next(
            c for c in nb.celdas if c.banda_desempeno == bd and c.banda_potencial == bp
        )
        return {e.empleado_id for e in celda.empleados}

    assert _emp_en("alto", "alto") == {emp.empleado_id}  # celda de la banda ajustada
    assert _emp_en("bajo", "alto") == set()              # NO en la celda de la calculada


@pytest.mark.asyncio
async def test_distribucion_ciclo_scope_de_jefe_cuenta_solo_su_equipo(db):
    """Hueco #4: `distribucion_ciclo(ciclo_id, scope={ids})` cuenta solo los
    empleados del scope (equipo del jefe); sin scope cuenta a todos."""
    service, cd, jefe, (emp_alto, emp_bajo) = await _ciclo_activo_metas(db, 90, 20)

    total = await service.distribucion_ciclo(cd.id)
    assert total.actual.total == 2
    assert total.actual.alto == 1 and total.actual.bajo == 1

    solo_alto = await service.distribucion_ciclo(
        cd.id, empleado_ids_scope={emp_alto.empleado_id}
    )
    assert solo_alto.actual.total == 1
    assert solo_alto.actual.alto == 1 and solo_alto.actual.bajo == 0

    solo_bajo = await service.distribucion_ciclo(
        cd.id, empleado_ids_scope={emp_bajo.empleado_id}
    )
    assert solo_bajo.actual.total == 1
    assert solo_bajo.actual.bajo == 1 and solo_bajo.actual.alto == 0


@pytest.mark.asyncio
async def test_reversion_antes_de_cerrar_usa_banda_calculada(db):
    """Hueco #5: si el ajuste se revierte ANTES de cerrar, el cierre congela la
    banda CALCULADA (override limpiado), no la que estuvo ajustada."""
    service, cd, jefe, (emp,) = await _ciclo_activo_metas(db, 20)  # calculada "bajo"
    admin = await make_empleado(db, rol="rh")
    await service.ajustar_banda(
        cd.id,
        [BandaAjusteItem(empleado_id=emp.empleado_id, banda_ajustada="alto", motivo="x")],
        current_user_id=admin.empleado_id,
    )
    # Reversion antes de cerrar (banda_ajustada=None limpia override + auditoria).
    await service.ajustar_banda(
        cd.id,
        [BandaAjusteItem(empleado_id=emp.empleado_id, banda_ajustada=None, motivo=None)],
        current_user_id=admin.empleado_id,
    )
    await service.cerrar_ciclo(cd.id)

    repo = CicloDesempenoRepository(db)
    r = await repo.get_resultado(cd.id, emp.empleado_id)
    assert r.banda_desempeno == "bajo"                    # calculada (override revertido)
    assert r.banda_desempeno_ajustada is None
    assert r.calificacion_desempeno == Decimal("20.00")

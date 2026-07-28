"""Tests de los `--cleanup` de los seeds demo.

Lo que se protege aqui es el borde: el cleanup tiene que llevarse lo sembrado por el
seed y NADA de lo que RH capture a mano sobre los mismos empleados. Se corre contra
la BD de test parcheando `AsyncSessionLocal` en cada modulo de seed.
"""

from datetime import date

import pytest
import pytest_asyncio
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.comedor import Comedor, ComedorAcceso, ComedorRegistro
from app.models.talento import (
    Competencia,
    EvaluacionCompetencia,
    GrupoCompetencia,
    PlanDesarrolloIndividual,
    TipoCompetencia,
)
from app.utils import seed_comedor_accesos_demo, seed_evaluacion_demo, seed_pdi_demo
from tests.conftest import make_empleado


@pytest_asyncio.fixture
def sesion_de_seed(engine, monkeypatch):
    """Hace que los cleanups usen el engine de test en vez de la BD real."""
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    for modulo in (seed_pdi_demo, seed_evaluacion_demo, seed_comedor_accesos_demo):
        monkeypatch.setattr(modulo, "AsyncSessionLocal", maker)
    return maker


async def _competencia(db: AsyncSession, nombre: str) -> Competencia:
    grupo = (
        await db.execute(select(GrupoCompetencia).where(GrupoCompetencia.nombre == "G"))
    ).scalar_one_or_none()
    if grupo is None:
        grupo = GrupoCompetencia(nombre="G", codigo="g", activo=True)
        db.add(grupo)
        await db.flush()
    tipo = (
        await db.execute(select(TipoCompetencia).where(TipoCompetencia.nombre == "T"))
    ).scalar_one_or_none()
    if tipo is None:
        tipo = TipoCompetencia(nombre="T", grupo_competencia_id=grupo.id, activo=True)
        db.add(tipo)
        await db.flush()
    comp = Competencia(
        nombre=nombre, tipo_competencia_id=tipo.id, categoria="tecnica", activo=True
    )
    db.add(comp)
    await db.flush()
    return comp


class TestCleanupPdiDemo:
    @pytest.mark.asyncio
    async def test_borra_lo_sembrado_y_conserva_lo_capturado(self, db, sesion_de_seed):
        emp = await make_empleado(db, empleado_id=553)
        comp = await _competencia(db, "Auditoría Interna")

        demo_1, demo_2 = seed_pdi_demo.ACCIONES_DEMO[553][:2]
        for accion in (demo_1, demo_2, "Plan real capturado por RH"):
            db.add(
                PlanDesarrolloIndividual(
                    empleado_id=emp.empleado_id,
                    competencia_id=comp.id,
                    accion=accion,
                    tipo="Presencial",
                    fecha_inicio=date(2026, 1, 1),
                    fecha_fin=date(2026, 2, 1),
                    responsable="RH",
                    estado="pendiente",
                )
            )
        await db.commit()

        await seed_pdi_demo.cleanup_pdi_demo(execute=True)

        acciones = (
            (await db.execute(select(PlanDesarrolloIndividual.accion))).scalars().all()
        )
        assert list(acciones) == ["Plan real capturado por RH"]

    @pytest.mark.asyncio
    async def test_dry_run_no_borra(self, db, sesion_de_seed):
        emp = await make_empleado(db, empleado_id=553)
        comp = await _competencia(db, "Auditoría Interna")
        db.add(
            PlanDesarrolloIndividual(
                empleado_id=emp.empleado_id,
                competencia_id=comp.id,
                accion=seed_pdi_demo.ACCIONES_DEMO[553][0],
                tipo="Presencial",
                fecha_inicio=date(2026, 1, 1),
                fecha_fin=date(2026, 2, 1),
                responsable="RH",
                estado="pendiente",
            )
        )
        await db.commit()

        await seed_pdi_demo.cleanup_pdi_demo(execute=False)

        total = (
            await db.execute(select(func.count()).select_from(PlanDesarrolloIndividual))
        ).scalar_one()
        assert total == 1


class TestCleanupEvaluacionDemo:
    @pytest.mark.asyncio
    async def test_conserva_evaluaciones_ajenas_al_demo(self, db, sesion_de_seed):
        emp = await make_empleado(db, empleado_id=seed_evaluacion_demo.DEMO_EMPLEADO_ID)
        comp_demo = await _competencia(db, "Liderazgo")  # nombre sembrado por el seed
        comp_real = await _competencia(db, "Soldadura de arnés")

        db.add_all(
            [
                EvaluacionCompetencia(
                    empleado_id=emp.empleado_id, competencia_id=comp_demo.id, nivel_actual=2
                ),
                EvaluacionCompetencia(
                    empleado_id=emp.empleado_id, competencia_id=comp_real.id, nivel_actual=3
                ),
            ]
        )
        await db.commit()

        await seed_evaluacion_demo.cleanup_evaluacion_demo(execute=True)

        restantes = (
            (await db.execute(select(EvaluacionCompetencia.competencia_id))).scalars().all()
        )
        assert list(restantes) == [comp_real.id]

    @pytest.mark.asyncio
    async def test_conserva_competencia_demo_si_alguien_la_referencia(self, db, sesion_de_seed):
        """Un PDI real sobre 'Liderazgo' impide retirarla del catálogo."""
        emp = await make_empleado(db, empleado_id=seed_evaluacion_demo.DEMO_EMPLEADO_ID)
        comp_demo = await _competencia(db, "Liderazgo")
        db.add(
            PlanDesarrolloIndividual(
                empleado_id=emp.empleado_id,
                competencia_id=comp_demo.id,
                accion="Plan real de liderazgo",
                tipo="Presencial",
                fecha_inicio=date(2026, 1, 1),
                fecha_fin=date(2026, 2, 1),
                responsable="RH",
                estado="pendiente",
            )
        )
        await db.commit()

        await seed_evaluacion_demo.cleanup_evaluacion_demo(execute=True)

        sigue = (
            await db.execute(select(Competencia.id).where(Competencia.id == comp_demo.id))
        ).scalar_one_or_none()
        assert sigue == comp_demo.id


class TestCleanupComedorDemo:
    @pytest.mark.asyncio
    async def test_no_borra_reservas_reales_sin_acceso(self, db, sesion_de_seed):
        """Una reserva semanal aun no consumida es dato productivo, no residuo demo."""
        emp = await make_empleado(db)
        comedor = Comedor(nombre="Principal", ubicacion="Planta", capacidad=100, activo=True)
        db.add(comedor)
        await db.flush()
        db.add(
            ComedorRegistro(
                empleado_id=emp.id,
                comedor_id=comedor.id,
                semana=date(2026, 7, 27),
                tipo_platillo="normal",
                acceso_concedido=False,
            )
        )
        await db.commit()

        await seed_comedor_accesos_demo.cleanup_comedor_demo_data(execute=True)

        registros = (
            await db.execute(select(func.count()).select_from(ComedorRegistro))
        ).scalar_one()
        accesos = (
            await db.execute(select(func.count()).select_from(ComedorAcceso))
        ).scalar_one()
        assert registros == 1
        assert accesos == 0

"""Validación de la separación de datos exclusivos de RRHH hacia tablas propias.

Confirma que los datos RH viven en empleados_rh_* (no en la fila empleados),
que las propiedades de compatibilidad del modelo los leen correctamente, y que
las escrituras pasan por las tablas hijas vía repos.
"""

from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.models.empleados_rh import (
    EmpleadoRhConfig,
    EmpleadoRhHorasExtra,
    EmpleadoRhPermisos,
)
from app.repositories.nominas_ajustes_repository import NominasAjustesRepository
from app.repositories.rh_permisos_repository import RhPermisosRepository
from app.repositories.usuario_repository import UsuarioRepository
from tests.conftest import make_empleado

pytestmark = pytest.mark.asyncio


async def test_datos_rh_se_guardan_en_tablas_hijas(db):
    emp = await make_empleado(
        db,
        rol="rh",
        modulos_rh={"dashboard": True, "empleados": False},
        inscrito_modulos_rh=False,
        acceso_rh_removido=False,
        puede_administrar_permisos_rh=True,
        fecha_fin_contrato=date(2026, 12, 31),
    )

    config = (
        await db.execute(
            select(EmpleadoRhConfig).where(
                EmpleadoRhConfig.empleado_id == emp.empleado_id
            )
        )
    ).scalar_one()
    permisos = (
        await db.execute(
            select(EmpleadoRhPermisos).where(
                EmpleadoRhPermisos.empleado_id == emp.empleado_id
            )
        )
    ).scalar_one()

    assert config.modulos_rh == {"dashboard": True, "empleados": False}
    assert config.fecha_fin_contrato == date(2026, 12, 31)
    assert permisos.puede_administrar_permisos_rh is True


async def test_propiedades_compat_leen_desde_hijas(db):
    emp = await make_empleado(
        db,
        rol="rh",
        modulos_rh={"actas": True},
        inscrito_modulos_rh=True,
        acceso_rh_removido=True,
        puede_registrar_horas_extra=True,
    )

    # Recargar vía query para forzar lectura por relaciones selectin (como en prod).
    reloaded = (
        await db.execute(select(type(emp)).where(type(emp).id == emp.id))
    ).scalar_one()

    assert reloaded.modulos_rh == {"actas": True}
    assert reloaded.inscrito_modulos_rh is True
    assert reloaded.acceso_rh_removido is True
    assert reloaded.puede_registrar_horas_extra is True


async def test_empleado_sin_filas_hijas_usa_defaults(db):
    """Un empleado sin filas RH (p. ej. recién importado de Bono) lee defaults."""
    from app.models.empleados import Empleado
    from app.models.roles import Rol

    rol = (
        await db.execute(select(Rol).where(Rol.nombre == "empleado"))
    ).scalar_one_or_none()
    if rol is None:
        rol = Rol(nombre="empleado", permisos={})
        db.add(rol)
        await db.flush()

    # empleados (Bono) ya no tiene rol/password_hash (viven en core); este empleado
    # se crea SIN ninguna fila hija para validar los defaults de las propiedades.
    emp = Empleado(
        empleado_id=77777,
        no_empleado="EMP-NOHIJA",
        nombre="Sin Hijas",
        estado_id=1,
    )
    db.add(emp)
    await db.flush()

    reloaded = (
        await db.execute(select(Empleado).where(Empleado.empleado_id == 77777))
    ).scalar_one()

    assert reloaded.core is None
    assert reloaded.rh_config is None
    assert reloaded.modulos_rh == {}
    assert reloaded.inscrito_modulos_rh is False
    assert reloaded.acceso_rh_removido is False
    assert reloaded.puede_administrar_permisos_rh is False
    assert reloaded.fecha_fin_contrato is None
    assert reloaded.rol is None
    assert reloaded.email is None


async def test_update_modulos_rh_pasa_por_tabla_hija(db):
    emp = await make_empleado(db, rol="rh")
    repo = RhPermisosRepository(db)

    target = await repo.get_by_empleado_id(emp.empleado_id)
    await repo.update_modulos_rh(target, {"empleados": True}, inscrito=None)

    config = (
        await db.execute(
            select(EmpleadoRhConfig).where(
                EmpleadoRhConfig.empleado_id == emp.empleado_id
            )
        )
    ).scalar_one()
    assert config.modulos_rh == {"empleados": True}


async def test_set_autorizacion_horas_extra_escribe_hija_y_autor(db):
    autorizador = await make_empleado(db, rol="rh", nombre="Autorizador")
    emp = await make_empleado(db, rol="empleado", nombre="Trabajador")
    repo = NominasAjustesRepository(db)

    # Cargar empleado con relaciones selectin como en el flujo real.
    target = (
        await db.execute(select(type(emp)).where(type(emp).id == emp.id))
    ).scalar_one()

    n = await repo.set_autorizacion(
        [target],
        True,
        autorizado_por_empleado_id=autorizador.empleado_id,
        fecha=datetime.now(timezone.utc),
    )
    assert n == 1

    he = (
        await db.execute(
            select(EmpleadoRhHorasExtra).where(
                EmpleadoRhHorasExtra.empleado_id == emp.empleado_id
            )
        )
    ).scalar_one()
    assert he.autorizado_por_empleado_id == autorizador.empleado_id
    assert he.autorizado_en is not None

    permisos = (
        await db.execute(
            select(EmpleadoRhPermisos).where(
                EmpleadoRhPermisos.empleado_id == emp.empleado_id
            )
        )
    ).scalar_one()
    assert permisos.puede_registrar_horas_extra is True


async def test_contratos_por_vencer_lee_la_cache_de_tress_no_la_fecha_manual(db):
    from tests.conftest import make_empleado_tress

    hoy = date.today()
    por_vencer = await make_empleado(db, rol="empleado", estado_id=1)
    await make_empleado_tress(
        db, por_vencer.no_empleado, contrato_dias=90,
        fecha_vencimiento_contrato=hoy + timedelta(days=10),
    )
    # Fecha manual capturada en levelup_empleados_config: ya no cuenta.
    await make_empleado(db, rol="empleado", estado_id=1, fecha_fin_contrato=hoy + timedelta(days=5))
    # Indefinido y vencido: tampoco.
    indef = await make_empleado(db, rol="empleado", estado_id=1)
    await make_empleado_tress(db, indef.no_empleado, contrato_dias=0)
    venc = await make_empleado(db, rol="empleado", estado_id=1)
    await make_empleado_tress(
        db, venc.no_empleado, contrato_dias=90, fecha_vencimiento_contrato=hoy - timedelta(days=1)
    )

    repo = UsuarioRepository(db)
    total = await repo.count_contratos_por_vencer(
        estados_activos=[1], ids_permitidos=None, hoy=hoy, dias_ventana=30
    )
    assert total == 1


async def test_empleados_no_tiene_columnas_del_proyecto():
    """`empleados` (Bono) no debe cargar columnas propias del proyecto: rol/
    password_hash/id viven en levelup_empleados_core. `email` y `password` son
    columnas legadas de Bono (solo lectura en login y listados)."""
    from app.models.empleados import Empleado
    from app.models.empleados_rh import EmpleadoCore

    cols_empleados = set(Empleado.__table__.columns.keys())
    for prohibida in ("id", "rol_id", "password_hash", "created_at",
                       "modulos_rh", "fecha_fin_contrato"):
        assert prohibida not in cols_empleados, prohibida
    assert "password" in cols_empleados
    assert "email" in cols_empleados

    cols_core = set(EmpleadoCore.__table__.columns.keys())
    for esperada in ("empleado_id", "rol_id", "email", "password_hash"):
        assert esperada in cols_core, esperada

    # empleados se mapea a la tabla intacta de Bono (no prefijada).
    assert Empleado.__tablename__ == "empleados"
    assert EmpleadoCore.__tablename__ == "levelup_empleados_core"


async def test_sync_bono_excluye_columnas_rh():
    """La sincronización con Bono nunca toca columnas exclusivas de RRHH, aun si
    Bono llegara a exponerlas."""
    from app.scripts.import_empleados_bono import (
        _columnas_locales,
        resolver_columnas_importables,
    )

    columnas_rh = {
        "fecha_fin_contrato",
        "puede_administrar_permisos_rh",
        "puede_registrar_horas_extra",
        "horas_extra_autorizado_en",
        "horas_extra_autorizado_por_id",
        "modulos_rh",
        "inscrito_modulos_rh",
        "acceso_rh_removido",
    }

    # El modelo ya no mapea estas columnas.
    assert columnas_rh.isdisjoint(_columnas_locales())

    # Aunque Bono las expusiera, no entran al set sincronizable.
    columnas_bono = {"empleado_id", "no_empleado", "nombre", "password"} | columnas_rh
    importables = set(resolver_columnas_importables(columnas_bono))
    assert columnas_rh.isdisjoint(importables)

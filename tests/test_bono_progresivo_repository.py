"""Tests del filtro (WHERE) del repositorio de progresivo de bono."""
from datetime import date

from app.repositories.bono_progresivo_repository import BonoProgresivoRepository


def _where(**kwargs):
    # El helper no necesita conexion real; se instancia con engine None solo
    # para ejercitar _build_where (no ejecuta SQL).
    repo = BonoProgresivoRepository(engine=None)  # type: ignore[arg-type]
    return repo._build_where(**kwargs)


def test_where_base_solo_pierde_bono():
    where, params = _where(empleado_id=None, empleado_ids_scope=None,
                           fecha_inicio=None, fecha_fin=None)
    assert "pierde_bono = 1" in where
    # descarte de fechas basura
    assert "fecha_ini IS NOT NULL" in where
    assert "1900" in where and "2100" in where
    assert params == {}


def test_where_rango_de_fechas():
    where, params = _where(empleado_id=None, empleado_ids_scope=None,
                           fecha_inicio=date(2026, 1, 1), fecha_fin=date(2026, 6, 30))
    assert "fecha_ini >= :f_fecha_inicio" in where
    assert "fecha_ini <= :f_fecha_fin" in where
    assert params["f_fecha_inicio"] == date(2026, 1, 1)
    assert params["f_fecha_fin"] == date(2026, 6, 30)


def test_where_empleado_id():
    where, params = _where(empleado_id=10, empleado_ids_scope=None,
                           fecha_inicio=None, fecha_fin=None)
    assert "empleado_id = :f_empleado_id" in where
    assert params["f_empleado_id"] == 10


def test_where_scope_lista():
    where, params = _where(empleado_id=None, empleado_ids_scope=[1, 2, 3],
                           fecha_inicio=None, fecha_fin=None)
    assert "empleado_id = ANY(:f_empleado_ids_scope)" in where
    assert params["f_empleado_ids_scope"] == [1, 2, 3]


def test_where_scope_vacio_no_devuelve_nada():
    where, _params = _where(empleado_id=None, empleado_ids_scope=[],
                            fecha_inicio=None, fecha_fin=None)
    assert "1=0" in where

"""Utilidad de clasificación administrativa para reglas de negocio."""

from app.models.catalogos import ClasificacionEmpleado
from app.models.empleados import Empleado
from app.utils.clasificacion_empleado import (
    clasificacion_es_administrativo,
    empleado_es_administrativo,
)


def test_clasificacion_es_administrativo_codigo_a():
    cl = ClasificacionEmpleado(
        clasificacion_id=1,
        descripcion="A",
        significado="Administrativo",
        estatus_id=1,
    )
    assert clasificacion_es_administrativo(cl) is True


def test_clasificacion_es_administrativo_directo():
    cl = ClasificacionEmpleado(
        clasificacion_id=2,
        descripcion="D",
        significado="Directo",
        estatus_id=1,
    )
    assert clasificacion_es_administrativo(cl) is False


def test_empleado_es_administrativo_sin_clasificacion():
    emp = Empleado(empleado_id=1, no_empleado="E1", nombre="Test")
    emp.clasificacion = None
    assert empleado_es_administrativo(emp) is False

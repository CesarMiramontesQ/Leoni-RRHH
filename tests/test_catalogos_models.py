def test_area_instancia():
    from app.models.catalogos import Area

    a = Area(area_id=1, descripcion="Producción", estatus_id=1)
    assert a.area_id == 1


def test_subarea_instancia():
    from app.models.catalogos import Subarea

    s = Subarea(subarea_id=1, descripcion="Línea A", area_id=1, estatus_id=1)
    assert s.subarea_id == 1


def test_categoria_instancia():
    from app.models.catalogos import Categoria

    c = Categoria(categoria_id=1, descripcion="Operativo", estatus_id=1)
    assert c.categoria_id == 1


def test_puesto_instancia():
    from app.models.catalogos import Puesto

    p = Puesto(puesto_id=1, descripcion="Operador", estatus_id=1)
    assert p.puesto_id == 1


def test_estado_empleado_instancia():
    from app.models.catalogos import EstadoEmpleado

    e = EstadoEmpleado(estado_id=1, descripcion="Activo", estatus_id=1)
    assert e.estado_id == 1


def test_clasificacion_instancia():
    from app.models.catalogos import ClasificacionEmpleado

    cl = ClasificacionEmpleado(clasificacion_id=1, descripcion="Directo", estatus_id=1)
    assert cl.clasificacion_id == 1

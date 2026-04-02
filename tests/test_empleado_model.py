def test_empleado_nuevo_schema():
    from app.models.empleados import Empleado

    e = Empleado(
        empleado_id=100,
        no_empleado="EMP-001",
        nombre="Juan Pérez",
        password_hash="hashed",
        rol_id=1,
        estado_id=1,
    )
    assert e.no_empleado == "EMP-001"
    assert not hasattr(e, "activo")
    assert not hasattr(e, "apellido")
    assert not hasattr(e, "num_empleado")
    assert hasattr(e, "estado_id")
    assert hasattr(e, "lider_id")

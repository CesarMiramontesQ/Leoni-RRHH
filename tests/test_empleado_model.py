def test_empleado_nuevo_schema():
    from app.models.empleados import Empleado

    # rol_id/email/password_hash viven en levelup_empleados_core (no en empleados).
    e = Empleado(
        empleado_id=100,
        no_empleado="EMP-001",
        nombre="Juan Pérez",
        estado_id=1,
    )
    assert e.no_empleado == "EMP-001"
    assert not hasattr(e, "activo")
    assert not hasattr(e, "apellido")
    assert not hasattr(e, "num_empleado")
    assert hasattr(e, "estado_id")
    assert hasattr(e, "lider_id")

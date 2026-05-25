"""Tests de identificación demo y validaciones de simulación comedor."""

import pytest

from app.utils.seed_comedor_accesos_demo import (
    InsufficientEmployeesError,
    is_comedor_demo_empleado,
)


def test_is_comedor_demo_empleado_positive():
    assert is_comedor_demo_empleado(
        email="comedor.demo.abc12345@leoni.test",
        no_empleado="CDEMO-abc12345",
        nombre="DEMO COMEDOR, abc12345",
    )


def test_is_comedor_demo_empleado_rejects_real_email():
    assert not is_comedor_demo_empleado(
        email="admin.rh@leoni.com",
        no_empleado="RH-0001",
        nombre="Admin RH",
    )


def test_is_comedor_demo_empleado_requires_all_markers():
    assert not is_comedor_demo_empleado(
        email="comedor.demo.x@leoni.test",
        no_empleado="RH-0001",
        nombre="DEMO COMEDOR, x",
    )


def test_insufficient_employees_error_message():
    err = InsufficientEmployeesError("faltan empleados")
    assert "faltan" in str(err)

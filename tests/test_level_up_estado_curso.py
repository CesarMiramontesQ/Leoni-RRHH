"""Tests de derivación de estado curso-empleado."""

from datetime import date

from app.services.level_up_estado_curso import (
    InscripcionEstadoInput,
    compute_estado_curso_empleado,
    fecha_finalizacion_curso,
)


def test_pendiente_sin_inscripciones():
    assert compute_estado_curso_empleado(True, []) == "pendiente"


def test_completado_con_asistencia():
    ins = [InscripcionEstadoInput(sesion_estado="completada", asistio=True)]
    assert compute_estado_curso_empleado(True, ins) == "completado"


def test_en_progreso_prioridad_sobre_programado():
    ins = [
        InscripcionEstadoInput(sesion_estado="programada", asistio=None),
        InscripcionEstadoInput(sesion_estado="en_curso", asistio=None),
    ]
    assert compute_estado_curso_empleado(True, ins) == "en_progreso"


def test_programado_con_sesion_futura():
    ins = [InscripcionEstadoInput(sesion_estado="programada", asistio=None)]
    assert compute_estado_curso_empleado(True, ins) == "programado"


def test_no_acreditado_sesion_completada_sin_asistencia():
    ins = [InscripcionEstadoInput(sesion_estado="completada", asistio=False)]
    assert compute_estado_curso_empleado(True, ins) == "no_acreditado"


def test_completado_prioridad_sobre_no_acreditado():
    ins = [
        InscripcionEstadoInput(sesion_estado="completada", asistio=False),
        InscripcionEstadoInput(sesion_estado="completada", asistio=True),
    ]
    assert compute_estado_curso_empleado(True, ins) == "completado"


def test_sin_asignacion_ni_inscripcion():
    assert compute_estado_curso_empleado(False, []) is None


def test_fecha_finalizacion_desde_fecha_inscripcion():
    ins = [
        InscripcionEstadoInput(
            sesion_estado="completada",
            asistio=True,
            fecha_inscripcion=date(2026, 3, 15),
            fecha_sesion_inicio=date(2026, 3, 10),
        )
    ]
    assert fecha_finalizacion_curso(ins) == date(2026, 3, 15)

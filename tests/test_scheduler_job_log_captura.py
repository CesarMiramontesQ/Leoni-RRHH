"""Captura de líneas por corrida: buffer, handler y clasificación del resultado."""

import logging

from app.integrations.scheduler_job_log import (
    MAX_LINEAS,
    CapturaCorridaHandler,
    CorridaBuffer,
    _CORRIDA,
    primer_error,
    resultado_desde_nivel,
    resumen_desde_lineas,
)


def _record(nivel: int, mensaje: str) -> logging.LogRecord:
    return logging.LogRecord(
        name="app.main",
        level=nivel,
        pathname=__file__,
        lineno=1,
        msg=mensaje,
        args=(),
        exc_info=None,
    )


def test_buffer_guarda_nivel_y_mensaje_formateado():
    buf = CorridaBuffer(job_id="sync_turnos_uso")
    buf.agregar(_record(logging.INFO, "Sync turnos en uso job | insertados=3"))

    assert buf.lineas == [
        {
            "ts": buf.lineas[0]["ts"],
            "nivel": "INFO",
            "mensaje": "Sync turnos en uso job | insertados=3",
        }
    ]
    assert buf.nivel_max == logging.INFO
    assert buf.descartadas == 0


def test_buffer_corta_en_max_lineas_y_cuenta_las_descartadas():
    buf = CorridaBuffer(job_id="x")
    for i in range(MAX_LINEAS + 5):
        buf.agregar(_record(logging.INFO, f"linea {i}"))

    assert len(buf.lineas) == MAX_LINEAS
    assert buf.descartadas == 5
    # Se conservan las PRIMERAS: el arranque de un job dice más que su cola.
    assert buf.lineas[0]["mensaje"] == "linea 0"


def test_buffer_recuerda_el_nivel_maximo_aunque_despues_baje():
    buf = CorridaBuffer(job_id="x")
    buf.agregar(_record(logging.ERROR, "truena"))
    buf.agregar(_record(logging.INFO, "sigue"))

    assert buf.nivel_max == logging.ERROR


def test_resultado_desde_nivel():
    assert resultado_desde_nivel(logging.INFO) == "ok"
    assert resultado_desde_nivel(logging.DEBUG) == "ok"
    assert resultado_desde_nivel(logging.WARNING) == "advertencia"
    assert resultado_desde_nivel(logging.ERROR) == "error"
    assert resultado_desde_nivel(logging.CRITICAL) == "error"


def test_resumen_es_la_ultima_linea_info():
    lineas = [
        {"ts": "t", "nivel": "INFO", "mensaje": "arranca"},
        {"ts": "t", "nivel": "ERROR", "mensaje": "algo falló"},
        {"ts": "t", "nivel": "INFO", "mensaje": "leidos=10 insertados=2"},
    ]
    assert resumen_desde_lineas(lineas) == "leidos=10 insertados=2"


def test_resumen_cae_a_la_primera_linea_si_no_hubo_info():
    lineas = [{"ts": "t", "nivel": "ERROR", "mensaje": "TRESS caído"}]
    assert resumen_desde_lineas(lineas) == "TRESS caído"
    assert resumen_desde_lineas([]) is None


def test_primer_error_devuelve_el_primer_mensaje_de_nivel_error():
    lineas = [
        {"ts": "t", "nivel": "INFO", "mensaje": "arranca"},
        {"ts": "t", "nivel": "ERROR", "mensaje": "primero"},
        {"ts": "t", "nivel": "ERROR", "mensaje": "segundo"},
    ]
    assert primer_error(lineas) == "primero"
    assert primer_error([{"ts": "t", "nivel": "INFO", "mensaje": "ok"}]) is None


def test_handler_ignora_records_cuando_no_hay_corrida_activa():
    handler = CapturaCorridaHandler()
    assert _CORRIDA.get() is None
    handler.emit(_record(logging.INFO, "fuera de corrida"))  # no debe reventar


def test_handler_escribe_en_el_buffer_de_la_corrida_activa():
    handler = CapturaCorridaHandler()
    buf = CorridaBuffer(job_id="sync_empleados_tress")
    token = _CORRIDA.set(buf)
    try:
        handler.emit(_record(logging.WARNING, "ojo"))
    finally:
        _CORRIDA.reset(token)

    assert buf.lineas[0]["mensaje"] == "ojo"
    assert buf.nivel_max == logging.WARNING

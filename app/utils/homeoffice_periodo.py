"""Bloque de semanas ISO en el que cae una fecha, para el cupo de home office.

La regla por área es «N días cada M semanas». Los bloques son fijos y globales: semanas
ISO (lunes a domingo) agrupadas de M en M desde la semana 1 del año ISO
(``bloque = (semana_iso - 1) // M``). Así todo el personal de un área comparte el mismo
calendario y RH puede verificarlo con un calendario impreso, sin depender del historial de
cada empleado.

Caso conocido: un año ISO de 53 semanas con M=2 deja un bloque de una sola semana al
cierre del año. Se acepta.
"""

from __future__ import annotations

from datetime import date


def semanas_en_anio_iso(anio_iso: int) -> int:
    # El 28 de diciembre siempre cae en la última semana ISO del año.
    return date(anio_iso, 12, 28).isocalendar()[1]


def bloque_semanas(fecha: date, periodo_semanas: int) -> tuple[date, date]:
    """Devuelve (lunes inicial, domingo final) del bloque de ``periodo_semanas`` que
    contiene a ``fecha``. Ambos extremos inclusivos."""
    if periodo_semanas < 1:
        raise ValueError("periodo_semanas debe ser >= 1")
    anio_iso, semana_iso, _ = fecha.isocalendar()
    semana_ini = ((semana_iso - 1) // periodo_semanas) * periodo_semanas + 1
    semana_fin = min(semana_ini + periodo_semanas - 1, semanas_en_anio_iso(anio_iso))
    inicio = date.fromisocalendar(anio_iso, semana_ini, 1)
    fin = date.fromisocalendar(anio_iso, semana_fin, 7)
    return inicio, fin

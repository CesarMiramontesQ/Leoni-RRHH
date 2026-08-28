"""Días de descanso obligatorio de la Ley Federal del Trabajo (art. 74).

Solo fechas de ley: los festivos de contrato colectivo los captura RH a mano.
"""

from __future__ import annotations

from datetime import date, timedelta


def _n_esimo_lunes(anio: int, mes: int, n: int) -> date:
    primero = date(anio, mes, 1)
    offset = (7 - primero.weekday()) % 7  # lunes = 0
    return primero + timedelta(days=offset + 7 * (n - 1))


def festivos_oficiales_lft(anio: int) -> list[tuple[date, str]]:
    """Festivos LFT del año, en orden cronológico."""
    festivos = [
        (date(anio, 1, 1), "Año Nuevo"),
        (_n_esimo_lunes(anio, 2, 1), "Día de la Constitución"),
        (_n_esimo_lunes(anio, 3, 3), "Natalicio de Benito Juárez"),
        (date(anio, 5, 1), "Día del Trabajo"),
        (date(anio, 9, 16), "Día de la Independencia"),
        (_n_esimo_lunes(anio, 11, 3), "Revolución Mexicana"),
        (date(anio, 12, 25), "Navidad"),
    ]
    # Transmisión del Poder Ejecutivo Federal: 1 de octubre cada seis años (2024, 2030…).
    if (anio - 2024) % 6 == 0:
        festivos.append((date(anio, 10, 1), "Transmisión del Poder Ejecutivo Federal"))
    return sorted(festivos)

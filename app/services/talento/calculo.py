"""Funciones puras de la agregacion del Dashboard de Talento.

Sin acceso a DB ni a sesion: la entrada son datos ya cargados por
`TalentoService` desde los building blocks de cada modulo. Toda la logica
testeable vive aqui.

Convencion central: una metrica sin datos vale `None` (la UI pinta "n/d"),
nunca `0.0`. "No hay planes de desarrollo" y "los planes van al 0%" son cosas
distintas y el dashboard no las confunde.
"""
from __future__ import annotations

from .constants import (
    CUMPLIMIENTO_AMBAR_MIN,
    CUMPLIMIENTO_VERDE_MIN,
    MAX_EMPLEADOS_FOCO,
    MIN_SENALES_FOCO,
)
from .types import SenalesEmpleado


def semaforo_pct(pct: float | None) -> str | None:
    """Semaforo de un porcentaje de cumplimiento. `None` -> `None` (n/d)."""
    if pct is None:
        return None
    if pct >= CUMPLIMIENTO_VERDE_MIN:
        return "verde"
    if pct >= CUMPLIMIENTO_AMBAR_MIN:
        return "ambar"
    return "rojo"


def promedio(valores: list[float]) -> float | None:
    """Promedio simple a 1 decimal. Lista vacia -> None."""
    if not valores:
        return None
    return round(sum(valores) / len(valores), 1)


def promedio_ponderado(pares: list[tuple[float, int]]) -> float | None:
    """Promedio de `(valor, peso)` a 1 decimal, para agregar areas a nivel org
    sin que un area de 3 personas pese igual que una de 300. Peso total 0 -> None."""
    total_peso = sum(peso for _, peso in pares)
    if total_peso <= 0:
        return None
    acumulado = sum(valor * peso for valor, peso in pares)
    return round(acumulado / total_peso, 1)


def empleados_en_foco(senales: list[SenalesEmpleado]) -> list[SenalesEmpleado]:
    """Empleados con al menos `MIN_SENALES_FOCO` senales malas, mas senales
    primero y desempate por nombre, topado a `MAX_EMPLEADOS_FOCO`."""
    candidatos = [s for s in senales if s.n_senales >= MIN_SENALES_FOCO]
    candidatos.sort(key=lambda s: (-s.n_senales, s.nombre))
    return candidatos[:MAX_EMPLEADOS_FOCO]

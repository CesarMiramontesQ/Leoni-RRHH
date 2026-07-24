"""Estructuras puras de la agregacion del Dashboard de Talento (sin Pydantic ni DB)."""
from __future__ import annotations

from dataclasses import dataclass

# Nombres canonicos de las senales de riesgo. El orden define el orden de los
# badges en la UI.
SENALES = ("desempeno_bajo", "polivalencia_baja", "capacitacion_pendiente", "pdi_vencido")


@dataclass
class SenalesEmpleado:
    """Senales de riesgo de un empleado dentro de un area.

    Cada senal es `True` (mala), `False` (bien) o `None` (no evaluable: no hay
    ciclo, el empleado no tiene competencias requeridas, etc.). `None` NUNCA
    cuenta como senal mala -- la ausencia de dato no es riesgo.
    """

    empleado_id: int
    no_empleado: int | str | None
    nombre: str
    puesto_nombre: str | None = None
    desempeno_bajo: bool | None = None
    polivalencia_baja: bool | None = None
    capacitacion_pendiente: bool | None = None
    pdi_vencido: bool | None = None

    @property
    def senales_activas(self) -> list[str]:
        return [s for s in SENALES if getattr(self, s) is True]

    @property
    def n_senales(self) -> int:
        return len(self.senales_activas)

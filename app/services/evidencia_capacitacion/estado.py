"""Regla pura de derivacion del estado de una evidencia desde sus firmas."""
from __future__ import annotations


def derivar_estado_evidencia(estados_firmas: list[str]) -> str:
    """Estado de la evidencia segun los estados de sus firmas:
      - alguna 'rechazada' -> 'devuelta'
      - >=1 firma y todas 'firmada' -> 'validada'
      - en cualquier otro caso (hay 'pendiente' o no hay firmas) -> 'pendiente'."""
    if any(e == "rechazada" for e in estados_firmas):
        return "devuelta"
    if estados_firmas and all(e == "firmada" for e in estados_firmas):
        return "validada"
    return "pendiente"

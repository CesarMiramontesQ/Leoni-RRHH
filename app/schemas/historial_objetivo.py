# app/schemas/historial_objetivo.py
"""Schemas Pydantic v2 de respuesta HTTP para Historial Objetivo (Tarea 5).

`HistorialObjetivoService` (Tarea 4) devuelve dataclasses propias
(`HistorialObjetivoResponse`, `HistorialObjetivoEquipoResponse`, y las
estructuras puras de `app.services.historial_objetivo.types`), desacopladas
de la capa HTTP. Estos schemas son el mapeo 1:1 a JSON: cada uno usa
`from_attributes=True` para poder construirse directo desde la dataclass
correspondiente vía `Modelo.model_validate(dataclass_instance)` (Pydantic v2
recorre atributos anidados igual, sin necesidad de mapeo manual).

Sin lógica de dominio aquí -- solo forma de los datos de salida.
"""

from __future__ import annotations

from pydantic import BaseModel


class DesglosePorTipoOut(BaseModel):
    model_config = {"from_attributes": True}

    tipo: str
    conteo: int
    peso: float
    penalizacion: float


class DesgloseFuenteOut(BaseModel):
    model_config = {"from_attributes": True}

    fuente: str
    penalizacion: float
    tipos: list[DesglosePorTipoOut] = []


class ResultadoIndiceOut(BaseModel):
    model_config = {"from_attributes": True}

    indice: float
    semaforo: str
    penalizacion_total: float
    desglose: list[DesgloseFuenteOut] = []


class HistorialObjetivoEmpleadoOut(BaseModel):
    """Respuesta de `GET /empleados/{empleado_id}` y `GET /mi-historial`."""

    model_config = {"from_attributes": True}

    empleado_id: int
    resultado: ResultadoIndiceOut
    bono_disponible: bool


class HistorialObjetivoEquipoItemOut(BaseModel):
    model_config = {"from_attributes": True}

    empleado_id: int
    no_empleado: str | None = None
    nombre: str | None = None
    resultado: ResultadoIndiceOut


class HistorialObjetivoEquipoOut(BaseModel):
    """Respuesta de `GET /equipo` (ranking peor-índice primero)."""

    model_config = {"from_attributes": True}

    items: list[HistorialObjetivoEquipoItemOut] = []
    bono_disponible: bool

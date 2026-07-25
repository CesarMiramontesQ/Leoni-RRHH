"""Schemas de respuesta del modulo Operaciones (analitica de cobertura)."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class AreaResumenSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    area_id: int
    area_nombre: str
    pol_area_pct: float | None
    resiliencia_pct: float
    n_criticas: int
    n_empleados: int


class CompetenciaCoberturaSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    competencia_id: int
    competencia_nombre: str
    tipo_nombre: str
    requieren: int
    cubren: int
    en_entrenamiento: int
    cobertura_pct: float
    semaforo: str
    severidad: str


class PuestoCoberturaSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    puesto_perfil_id: int
    puesto_nombre: str
    competencias: list[CompetenciaCoberturaSchema]


class CandidatoCrossTrainSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    empleado_id: int
    no_empleado: int | str
    nombre: str
    nivel_actual: int
    nivel_requerido: int


class CriticaSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    competencia_id: int
    competencia_nombre: str
    severidad: str
    candidatos: list[CandidatoCrossTrainSchema]


class CoberturaAreaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    resumen: AreaResumenSchema
    competencias: list[CompetenciaCoberturaSchema]
    puestos: list[PuestoCoberturaSchema]
    criticas: list[CriticaSchema]

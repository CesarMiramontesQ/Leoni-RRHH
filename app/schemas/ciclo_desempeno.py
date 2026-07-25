# app/schemas/ciclo_desempeno.py
"""Schemas Pydantic v2 para el modulo de Ciclo de Desempeno (orquestador).

Cubre: configuracion del ciclo, resultados por empleado (snapshot),
captura de potencial en batch, matriz 9-Box y la vista self-service del
empleado sobre su propio resultado.

Sin logica de dominio aqui (eso vive en el service, Tarea 4): estos
schemas solo validan forma/rango de los datos de entrada. Los valores
validos de `estado`/`banda_desempeno`/`banda_potencial` se validan contra
las constantes de `app/models/ciclo_desempeno.py` (fuente unica de verdad,
mismo patron que `app/schemas/metas.py`).

Reglas de negocio que NO se validan aqui (van al service, Tarea 4):
  - "no activar un ciclo sin fecha_inicio/fecha_fin" (aqui las fechas ya
    quedan nullable en el modelo porque `CicloDesempeno.fecha_inicio` /
    `fecha_fin` son nullable=True; solo `CicloDesempenoCreate` las exige,
    ver decision mas abajo).
  - Consistencia entre `meta_ciclo_id`/`eval360_campana_id` y el estado
    del ciclo, calculo de calificacion/potencial/segmento 9-Box, permisos.

Decision (override de cierre, ver brief Tarea 2): el override de
"forzar cierre sin fecha_fin vencida / sin resultados completos" viaja en
el **body** de `POST /ciclos/{id}/cerrar` via `CicloDesempenoCerrarRequest`
(`forzar: bool = False`), NO en `CicloDesempeno.config`. Razon: `config`
es la configuracion persistente del ciclo (afecta cualquier cierre futuro
y se edita solo en borrador via Update); un "forzar" es una decision
puntual de quien ejecuta la accion de cierre, no un ajuste de
configuracion del ciclo. Si Tarea 4 necesita ademas un flag persistente
(p. ej. "este ciclo siempre permite cierre anticipado"), puede leerlo de
`config` sin cambiar este schema.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.ciclo_desempeno import (
    CICLO_DESEMPENO_BANDAS,
    CICLO_DESEMPENO_ESTADOS,
)


def _validar_pertenece(valor: str, valores_validos: tuple, campo: str) -> str:
    if valor not in valores_validos:
        raise ValueError(f"{campo} invalido: {valor!r} (validos: {', '.join(valores_validos)})")
    return valor


# ── Ciclo ────────────────────────────────────────────────────────────────


class CicloDesempenoCreate(BaseModel):
    """Alta de un ciclo. A diferencia del modelo (donde `fecha_inicio` /
    `fecha_fin` son nullable), aqui se EXIGEN: un ciclo necesita periodo
    desde su creacion (nota de revision Tarea 1)."""

    model_config = {"str_strip_whitespace": True}

    nombre: str = Field(..., min_length=1, max_length=255)
    descripcion: Optional[str] = None
    fecha_inicio: date
    fecha_fin: date
    meta_ciclo_id: Optional[int] = None
    eval360_campana_id: Optional[int] = None
    peso_metas: Decimal = Field(default=Decimal("60"), ge=0)
    peso_competencias: Decimal = Field(default=Decimal("40"), ge=0)
    peso_historial: Decimal = Field(default=Decimal("0"), ge=0)
    umbral_medio: Decimal = Field(default=Decimal("50"), gt=0, lt=100)
    umbral_alto: Decimal = Field(default=Decimal("75"), gt=0, lt=100)
    config: Optional[dict] = None

    @model_validator(mode="after")
    def _check_fechas(self) -> "CicloDesempenoCreate":
        if self.fecha_fin < self.fecha_inicio:
            raise ValueError("fecha_fin debe ser >= fecha_inicio")
        return self

    @model_validator(mode="after")
    def _check_pesos(self) -> "CicloDesempenoCreate":
        if (self.peso_metas + self.peso_competencias + self.peso_historial) <= 0:
            raise ValueError("peso_metas + peso_competencias + peso_historial debe ser > 0")
        return self

    @model_validator(mode="after")
    def _check_umbrales(self) -> "CicloDesempenoCreate":
        if not (0 < self.umbral_medio < self.umbral_alto < 100):
            raise ValueError("umbrales invalidos: se requiere 0 < umbral_medio < umbral_alto < 100")
        return self


class CicloDesempenoUpdate(BaseModel):
    """Actualizacion parcial (solo aplicable a ciclos en borrador segun el
    service, Tarea 4). Todos los campos opcionales; los validadores solo
    corren sobre los campos efectivamente enviados."""

    model_config = {"str_strip_whitespace": True}

    nombre: Optional[str] = Field(None, min_length=1, max_length=255)
    descripcion: Optional[str] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    meta_ciclo_id: Optional[int] = None
    eval360_campana_id: Optional[int] = None
    peso_metas: Optional[Decimal] = Field(None, ge=0)
    peso_competencias: Optional[Decimal] = Field(None, ge=0)
    peso_historial: Optional[Decimal] = Field(None, ge=0)
    umbral_medio: Optional[Decimal] = Field(None, gt=0, lt=100)
    umbral_alto: Optional[Decimal] = Field(None, gt=0, lt=100)
    config: Optional[dict] = None

    @model_validator(mode="after")
    def _check_fechas(self) -> "CicloDesempenoUpdate":
        if self.fecha_inicio and self.fecha_fin and self.fecha_fin < self.fecha_inicio:
            raise ValueError("fecha_fin debe ser >= fecha_inicio")
        return self

    @model_validator(mode="after")
    def _check_pesos(self) -> "CicloDesempenoUpdate":
        if self.peso_metas is not None and self.peso_competencias is not None:
            historial = self.peso_historial if self.peso_historial is not None else Decimal(0)
            if (self.peso_metas + self.peso_competencias + historial) <= 0:
                raise ValueError(
                    "peso_metas + peso_competencias + peso_historial debe ser > 0"
                )
        return self

    @model_validator(mode="after")
    def _check_umbrales(self) -> "CicloDesempenoUpdate":
        if self.umbral_medio is not None and self.umbral_alto is not None:
            if not (0 < self.umbral_medio < self.umbral_alto < 100):
                raise ValueError(
                    "umbrales invalidos: se requiere 0 < umbral_medio < umbral_alto < 100"
                )
        return self


class CicloDesempenoResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    nombre: str
    descripcion: Optional[str] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    estado: str
    meta_ciclo_id: Optional[int] = None
    eval360_campana_id: Optional[int] = None
    peso_metas: Decimal
    peso_competencias: Decimal
    peso_historial: Decimal
    umbral_medio: Decimal
    umbral_alto: Decimal
    config: Optional[dict] = None
    creado_por_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    # Derivado, lo llena el service (conteo de CicloDesempenoResultado); no
    # persistido en el modelo.
    total_participantes: Optional[int] = None

    @field_validator("estado")
    @classmethod
    def _estado_valido(cls, v: str) -> str:
        return _validar_pertenece(v, CICLO_DESEMPENO_ESTADOS, "estado")


class CicloDesempenoCerrarRequest(BaseModel):
    """Body de `POST /ciclos/{id}/cerrar`. Ver decision de modulo arriba:
    el override de cierre viaja aqui (body), no en `CicloDesempeno.config`."""

    forzar: bool = False


# ── Resultado (snapshot por empleado) ───────────────────────────────────


class CicloDesempenoResultadoResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    ciclo_id: int
    empleado_id: int
    empleado_nombre: Optional[str] = None
    # Area del empleado: la pinta la tabla y con ella la pantalla arma las
    # opciones de su filtro por area, sin pedir un catalogo de otro modulo.
    area_id: Optional[int] = None
    area_nombre: Optional[str] = None
    cumplimiento_metas: Optional[Decimal] = None
    calificacion_360_raw: Optional[Decimal] = None
    calificacion_360_norm: Optional[Decimal] = None
    escala_min: Optional[Decimal] = None
    escala_max: Optional[Decimal] = None
    calificacion_desempeno: Optional[Decimal] = None
    peso_metas_efectivo: Optional[Decimal] = None
    peso_competencias_efectivo: Optional[Decimal] = None
    indice_historial: Optional[Decimal] = None
    peso_historial_efectivo: Optional[Decimal] = None
    potencial: Optional[Decimal] = None
    banda_desempeno: Optional[str] = None
    banda_potencial: Optional[str] = None
    segmento_9box: Optional[str] = None
    banda_desempeno_ajustada: Optional[str] = None
    banda_desempeno_efectiva: Optional[str] = None
    banda_ajuste_motivo: Optional[str] = None
    banda_ajustada_por_id: Optional[int] = None
    banda_ajustada_at: Optional[datetime] = None
    potencial_capturado_por_id: Optional[int] = None
    potencial_capturado_at: Optional[datetime] = None
    snapshot_at: Optional[datetime] = None

    @field_validator("banda_desempeno", "banda_potencial", "banda_desempeno_ajustada", "banda_desempeno_efectiva")
    @classmethod
    def _banda_valida(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return _validar_pertenece(v, CICLO_DESEMPENO_BANDAS, "banda")


# ── Captura de potencial (batch) ────────────────────────────────────────


class PotencialUpdateItem(BaseModel):
    empleado_id: int
    potencial: Decimal = Field(..., ge=0, le=100)


class PotencialUpdateRequest(BaseModel):
    items: list[PotencialUpdateItem] = Field(..., min_length=1)


# ── Matriz 9-Box ─────────────────────────────────────────────────────────


class NueveBoxEmpleadoItem(BaseModel):
    empleado_id: int
    empleado_nombre: Optional[str] = None
    calificacion_desempeno: Optional[Decimal] = None
    potencial: Optional[Decimal] = None


class CeldaResponse(BaseModel):
    banda_desempeno: str
    banda_potencial: str
    segmento: str
    empleados: list[NueveBoxEmpleadoItem] = Field(default_factory=list)


class NueveBoxResponse(BaseModel):
    ciclo_id: int
    celdas: list[CeldaResponse] = Field(default_factory=list)
    resumen: Optional[dict] = None


# ── Self-service (empleado) ─────────────────────────────────────────────


class MisResultadoResponse(BaseModel):
    """Subconjunto visible por el propio empleado de su resultado en un
    ciclo. `potencial`/`banda_potencial`/`segmento_9box` quedan fuera a
    proposito (informacion sensible de gestion de talento que RH decide
    si/cuando exponer; no es trivial habilitarla mas adelante, solo
    agregar los campos aqui)."""

    model_config = {"from_attributes": True}

    ciclo_id: int
    ciclo_nombre: Optional[str] = None
    calificacion_desempeno: Optional[Decimal] = None
    cumplimiento_metas: Optional[Decimal] = None
    calificacion_360_norm: Optional[Decimal] = None
    banda_desempeno: Optional[str] = None

    @field_validator("banda_desempeno")
    @classmethod
    def _banda_valida(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return _validar_pertenece(v, CICLO_DESEMPENO_BANDAS, "banda_desempeno")


# ── Calibracion ──────────────────────────────────────────────────────────


class BandaAjusteItem(BaseModel):
    empleado_id: int
    banda_ajustada: Optional[str] = None
    motivo: Optional[str] = None

    @field_validator("banda_ajustada")
    @classmethod
    def _banda_ajustada_valida(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return _validar_pertenece(v, CICLO_DESEMPENO_BANDAS, "banda_ajustada")


class CalibracionRequest(BaseModel):
    items: list[BandaAjusteItem] = Field(..., min_length=1)


class DistribucionBanda(BaseModel):
    bajo: int = 0
    medio: int = 0
    alto: int = 0
    total: int = 0
    pct: dict[str, float] = Field(default_factory=dict)


class DistribucionResponse(BaseModel):
    ciclo_id: int
    actual: DistribucionBanda
    objetivo: dict[str, float] = Field(default_factory=dict)
    desviacion: dict[str, float] = Field(default_factory=dict)

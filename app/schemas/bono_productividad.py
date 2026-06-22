"""Esquemas Pydantic para lectura de datos en la BD externa bono_productividad."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


def _fecha_segura(v):
    """Normaliza fecha y rechaza años fuera de rango (evita ValueError tipo 'year 20226 is out of range')."""
    if v is None:
        return None
    if isinstance(v, datetime):
        d = v.date()
    elif isinstance(v, date):
        d = v
    elif isinstance(v, str):
        s = v.strip()
        if not s:
            return None
        base = s.replace("Z", "").split("+", 1)[0].split("T", 1)[0].strip()[:10]
        parts = base.split("-")
        if len(parts) < 3:
            return None
        try:
            y, mo, da = int(parts[0]), int(parts[1]), int(parts[2])
        except ValueError:
            return None
        if not (1900 <= y <= 2100 and 1 <= mo <= 12 and 1 <= da <= 31):
            return None
        try:
            return date(y, mo, da)
        except ValueError:
            return None
    elif isinstance(v, (int, float)) and not isinstance(v, bool):
        if isinstance(v, float) and not v.is_integer():
            return None
        iv = int(v)
        if 19000101 <= iv <= 21001231:
            y, mo, da = iv // 10000, (iv // 100) % 100, iv % 100
            if 1 <= mo <= 12 and 1 <= da <= 31:
                try:
                    return date(y, mo, da)
                except ValueError:
                    return None
        return None
    else:
        return None

    if not (1900 <= d.year <= 2100):
        return None
    return d


class BonoIncidenciaConsolidadaItem(BaseModel):
    tipo: str
    id: int
    empleado_id: int
    no_empleado: int | None = None
    nombre: str | None = None
    fecha: date | None = None
    semana_id: int | None = None
    numero_semana: int | None = None
    categoria: str | None = None
    detalle: str | None = None
    descuento_porcentaje: float | None = None
    estatus_id: int | None = None
    area: str | None = None
    subarea: str | None = None

    model_config = {"from_attributes": True}

    @field_validator("fecha", mode="before")
    @classmethod
    def _fecha_a_date(cls, v):
        return _fecha_segura(v)


class BonoIncidenciasListaResponse(BaseModel):
    items: list[BonoIncidenciaConsolidadaItem] = Field(default_factory=list)


class BonoSyncErrorItem(BaseModel):
    source_key: str | None = None
    error: str


class BonoIncidenciasSyncResponse(BaseModel):
    dry_run: bool
    total_leidos_bono: int
    total_considerados: int
    total_insertados: int
    total_actualizados_existentes: int
    total_omitidos_duplicado: int
    total_omitidos_sin_empleado: int
    total_omitidos_invalidos: int
    total_omitidos_tipo_excluido: int = Field(
        default=0,
        description="Filas de bono no importadas por tipo (p. ej. progresivo / progresivo_historico).",
    )
    errores: list[BonoSyncErrorItem] = Field(default_factory=list)
    mapeo_campos: dict[str, str] = Field(
        default_factory=lambda: {
            "bono.tipo": "incidencias.tipo",
            "bono.empleado_id": "incidencias.empleado_id (match con empleados.empleado_id)",
            "bono.no_empleado": "incidencias.no_empleado",
            "bono.nombre": "incidencias.nombre",
            "bono.fecha": "incidencias.fecha",
            "bono.categoria": "incidencias.categoria",
            "bono.detalle": "incidencias.detalle",
            "bono.area": "incidencias.area",
            "bono.subarea": "incidencias.subarea",
            "(fijo)": "incidencias.origen=bono, incidencias.synced_at=now()",
        }
    )


def json_safe_item(row: dict) -> dict:
    """Normaliza tipos típicos de asyncpg/Decimal antes de model_validate."""
    out = dict(row)
    fn = out.get("fecha")
    if isinstance(fn, datetime):
        out["fecha"] = _fecha_segura(fn)
    elif isinstance(fn, date):
        out["fecha"] = _fecha_segura(fn)
    for key in ("id", "empleado_id", "estatus_id", "semana_id", "numero_semana"):
        if key in out and out[key] is not None and not isinstance(out[key], int):
            try:
                out[key] = int(out[key])
            except (TypeError, ValueError):
                pass
    v = out.get("descuento_porcentaje")
    if isinstance(v, Decimal):
        out["descuento_porcentaje"] = float(v)
    elif isinstance(v, (int, float)) and not isinstance(v, bool):
        out["descuento_porcentaje"] = float(v)
    return out

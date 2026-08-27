"""Contratos del personal: vencimientos, indefinidos y sin dato.

Lee **solo de Bono** (`levelup_empleados_tress`, que escribe `sync_empleados_tress_service`
a las 04:10). Ninguna carga de página consulta DATOS_ANALISIS.

El estatus **no se guarda**: depende de «hoy» y de la ventana que elige RH en pantalla,
así que se calcula al leer con `calcular_estatus`. Los cinco valores son excluyentes para
que las tarjetas sumen el total:

- `indefinido`: `contrato_dias == 0` (TB_DIAS = 0, no vence).
- `sin_dato`: sin vencimiento calculable y no indefinido (código sin catálogo, o con
  duración pero sin fecha de inicio real).
- `vencido`: vencimiento anterior a hoy.
- `por_vencer`: hoy ≤ vencimiento ≤ hoy + ventana.
- `vigente`: vencimiento posterior a la ventana.
"""

from __future__ import annotations

import csv
import io
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.empleados_tress import EmpleadoTress
from app.repositories.empleados_tress_repository import ContratoFila, EmpleadosTressRepository
from app.schemas.contratos import (
    VENTANA_DIAS_DEFAULT,
    ContratoAreaOption,
    ContratoEmpleadoItem,
    ContratoEmpleadoResumen,
    ContratosKpisResponse,
    ContratosListResponse,
    EstatusContrato,
)

_CSV_COLUMNAS = (
    ("no_empleado", "No. empleado"),
    ("nombre", "Nombre"),
    ("area", "Área"),
    ("puesto", "Puesto"),
    ("supervisor", "Supervisor"),
    ("contrato_codigo", "Tipo"),
    ("contrato_descripcion", "Contrato"),
    ("contrato_dias", "Días contrato"),
    ("fecha_contrato", "Fecha contrato"),
    ("fecha_vencimiento", "Fecha vencimiento"),
    ("dias_restantes", "Días restantes"),
    ("estatus", "Estatus"),
)

_ESTATUS_CSV = {
    "vencido": "Vencido",
    "por_vencer": "Por vencer",
    "vigente": "Vigente",
    "indefinido": "Indefinido",
    "sin_dato": "Sin dato",
}


def calcular_estatus(
    contrato_dias: int | None,
    fecha_vencimiento: date | None,
    *,
    hoy: date,
    ventana_dias: int,
) -> EstatusContrato:
    """Misma regla que `estatus_contrato_expr` en el repositorio."""
    if contrato_dias == 0:
        return "indefinido"
    if fecha_vencimiento is None:
        return "sin_dato"
    if fecha_vencimiento < hoy:
        return "vencido"
    if (fecha_vencimiento - hoy).days <= ventana_dias:
        return "por_vencer"
    return "vigente"


def _dias_restantes(fecha_vencimiento: date | None, hoy: date) -> int | None:
    return None if fecha_vencimiento is None else (fecha_vencimiento - hoy).days


def resumen_desde_fila(
    tress: EmpleadoTress, *, hoy: date, ventana_dias: int = VENTANA_DIAS_DEFAULT
) -> ContratoEmpleadoResumen:
    fv = tress.fecha_vencimiento_contrato
    return ContratoEmpleadoResumen(
        contrato_codigo=tress.contrato_codigo,
        contrato_descripcion=tress.contrato_descripcion,
        contrato_dias=tress.contrato_dias,
        fecha_contrato=tress.fecha_contrato,
        fecha_vencimiento=fv,
        dias_restantes=_dias_restantes(fv, hoy),
        estatus=calcular_estatus(tress.contrato_dias, fv, hoy=hoy, ventana_dias=ventana_dias),
        sincronizado_en=tress.sincronizado_en,
    )


class ContratosService:
    def __init__(self, db: AsyncSession, *, hoy: date | None = None):
        self.repo = EmpleadosTressRepository(db)
        self.hoy = hoy or date.today()

    def _item(self, fila: ContratoFila, ventana_dias: int) -> ContratoEmpleadoItem:
        r = resumen_desde_fila(fila.tress, hoy=self.hoy, ventana_dias=ventana_dias)
        return ContratoEmpleadoItem(
            empleado_id=fila.empleado_id,
            no_empleado=fila.no_empleado,
            nombre=fila.nombre,
            area=fila.area,
            puesto=fila.puesto,
            supervisor=fila.supervisor,
            **r.model_dump(),
        )

    async def listar(
        self,
        *,
        ventana_dias: int,
        estatus: str | None,
        area_id: int | None,
        q: str | None,
        page: int,
        page_size: int,
    ) -> ContratosListResponse:
        filas, total = await self.repo.list_contratos(
            hoy=self.hoy,
            ventana_dias=ventana_dias,
            estados_activos=settings.ESTADOS_ACTIVOS_IDS,
            estatus=estatus,
            area_id=area_id,
            q=q,
            page=page,
            page_size=page_size,
        )
        return ContratosListResponse(
            items=[self._item(f, ventana_dias) for f in filas],
            total=total,
            page=page,
            page_size=page_size,
            ventana_dias=ventana_dias,
        )

    async def kpis(
        self, *, ventana_dias: int, area_id: int | None, q: str | None
    ) -> ContratosKpisResponse:
        conteo = await self.repo.kpis_contratos(
            hoy=self.hoy,
            ventana_dias=ventana_dias,
            estados_activos=settings.ESTADOS_ACTIVOS_IDS,
            area_id=area_id,
            q=q,
        )
        return ContratosKpisResponse(
            vencidos=conteo.get("vencido", 0),
            por_vencer=conteo.get("por_vencer", 0),
            vigentes=conteo.get("vigente", 0),
            indefinidos=conteo.get("indefinido", 0),
            sin_dato=conteo.get("sin_dato", 0),
            total=sum(conteo.values()),
            ventana_dias=ventana_dias,
        )

    async def areas(self) -> list[ContratoAreaOption]:
        filas = await self.repo.areas_con_contratos(estados_activos=settings.ESTADOS_ACTIVOS_IDS)
        return [ContratoAreaOption(area_id=a, descripcion=d) for a, d in filas]

    async def exportar_csv(
        self, *, ventana_dias: int, estatus: str | None, area_id: int | None, q: str | None
    ) -> str:
        """Todo el listado filtrado (sin paginar), UTF-8 con BOM para que Excel lo abra bien."""
        filas, _ = await self.repo.list_contratos(
            hoy=self.hoy,
            ventana_dias=ventana_dias,
            estados_activos=settings.ESTADOS_ACTIVOS_IDS,
            estatus=estatus,
            area_id=area_id,
            q=q,
            page=1,
            page_size=100_000,
        )
        buf = io.StringIO()
        buf.write("﻿")
        w = csv.writer(buf, lineterminator="\r\n")
        w.writerow([titulo for _, titulo in _CSV_COLUMNAS])
        for fila in filas:
            item = self._item(fila, ventana_dias).model_dump()
            item["estatus"] = _ESTATUS_CSV[item["estatus"]]
            w.writerow(["" if item[c] is None else item[c] for c, _ in _CSV_COLUMNAS])
        return buf.getvalue()

    async def resumen_empleado(self, no_empleado: int | None) -> ContratoEmpleadoResumen | None:
        """Para la Vista 360: `None` si el empleado no está en la caché."""
        if no_empleado is None:
            return None
        fila = await self.repo.get_por_no_empleado(no_empleado)
        if fila is None:
            return None
        return resumen_desde_fila(fila, hoy=self.hoy)

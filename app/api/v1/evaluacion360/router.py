# app/api/v1/evaluacion360/router.py
"""
Router del modulo Evaluacion 360 (Level Up) — Fase 1.

Convenciones:
  - Gestion (config, escalas, preguntas, campanas, resultados, dashboard) exige
    rol RH via `role_checker(["operativo"])`.
  - "Mis Evaluaciones" y responder son self-service (`get_current_user`); sus
    prefijos estan en RH_SELF_SERVICE_API_PREFIXES para no exigir el modulo.
  - El router instancia el service y delega toda la logica.
"""

from fastapi import APIRouter, BackgroundTasks, Depends, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado
from app.schemas.evaluacion360 import (
    CampanaCreate,
    CampanaDetalleResponse,
    CampanaListResponse,
    CampanaUpdate,
    ConfigResponse,
    ConfigUpdate,
    DashboardResponse,
    EscalaCreate,
    EscalaResponse,
    EscalaUpdate,
    EvaluacionDetalleResponse,
    EvaluacionRespuestasIn,
    MiEvaluacionResumen,
    ParticipanteResponse,
    PreguntaCreate,
    PreguntaResponse,
    PreguntaUpdate,
    ReporteIndividualResponse,
    ResultadoParticipanteResponse,
    SugerenciaEvaluadorResponse,
)
from app.services.evaluacion360_service import Evaluacion360Service

router = APIRouter(prefix="/api/v1/evaluacion-360", tags=["Evaluación 360"])


def _svc(db: AsyncSession = Depends(get_db)) -> Evaluacion360Service:
    return Evaluacion360Service(db)


# ══════════════════════════════════════════════════════════════════════════════
# Dashboard
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/dashboard", response_model=DashboardResponse)
async def dashboard(
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: Evaluacion360Service = Depends(_svc),
):
    return await svc.get_dashboard()


# ══════════════════════════════════════════════════════════════════════════════
# Configuracion + escalas
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/config", response_model=ConfigResponse)
async def get_config(
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: Evaluacion360Service = Depends(_svc),
):
    return await svc.get_config()


@router.put("/config", response_model=ConfigResponse)
async def update_config(
    data: ConfigUpdate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: Evaluacion360Service = Depends(_svc),
):
    return await svc.update_config(data, current_user, background_tasks)


@router.get("/escalas", response_model=list[EscalaResponse])
async def list_escalas(
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: Evaluacion360Service = Depends(_svc),
):
    return await svc.list_escalas()


@router.post("/escalas", response_model=EscalaResponse, status_code=status.HTTP_201_CREATED)
async def create_escala(
    data: EscalaCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: Evaluacion360Service = Depends(_svc),
):
    return await svc.create_escala(data, current_user)


@router.put("/escalas/{escala_id}", response_model=EscalaResponse)
async def update_escala(
    escala_id: int,
    data: EscalaUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: Evaluacion360Service = Depends(_svc),
):
    return await svc.update_escala(escala_id, data)


@router.delete("/escalas/{escala_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_escala(
    escala_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: Evaluacion360Service = Depends(_svc),
):
    await svc.delete_escala(escala_id)


# ══════════════════════════════════════════════════════════════════════════════
# Banco de preguntas
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/preguntas", response_model=list[PreguntaResponse])
async def list_preguntas(
    competencia_id: int | None = Query(None),
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: Evaluacion360Service = Depends(_svc),
):
    return await svc.list_preguntas(competencia_id=competencia_id)


@router.post("/preguntas", response_model=PreguntaResponse, status_code=status.HTTP_201_CREATED)
async def create_pregunta(
    data: PreguntaCreate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: Evaluacion360Service = Depends(_svc),
):
    return await svc.create_pregunta(data, current_user)


@router.put("/preguntas/{pregunta_id}", response_model=PreguntaResponse)
async def update_pregunta(
    pregunta_id: int,
    data: PreguntaUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: Evaluacion360Service = Depends(_svc),
):
    return await svc.update_pregunta(pregunta_id, data)


@router.delete("/preguntas/{pregunta_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pregunta(
    pregunta_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: Evaluacion360Service = Depends(_svc),
):
    await svc.delete_pregunta(pregunta_id)


# ══════════════════════════════════════════════════════════════════════════════
# Mis Evaluaciones (self-service)
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/mis-evaluaciones", response_model=list[MiEvaluacionResumen])
async def mis_evaluaciones(
    estado: str | None = Query(None),
    current_user: Empleado = Depends(get_current_user),
    svc: Evaluacion360Service = Depends(_svc),
):
    return await svc.list_mis_evaluaciones(current_user, estado=estado)


@router.get("/evaluaciones/{evaluacion_id}", response_model=EvaluacionDetalleResponse)
async def evaluacion_detalle(
    evaluacion_id: int,
    current_user: Empleado = Depends(get_current_user),
    svc: Evaluacion360Service = Depends(_svc),
):
    return await svc.get_evaluacion_detalle(evaluacion_id, current_user)


@router.put("/evaluaciones/{evaluacion_id}/borrador", response_model=EvaluacionDetalleResponse)
async def guardar_borrador(
    evaluacion_id: int,
    data: EvaluacionRespuestasIn,
    current_user: Empleado = Depends(get_current_user),
    svc: Evaluacion360Service = Depends(_svc),
):
    return await svc.guardar_borrador(evaluacion_id, data, current_user)


@router.post("/evaluaciones/{evaluacion_id}/enviar", response_model=EvaluacionDetalleResponse)
async def enviar_evaluacion(
    evaluacion_id: int,
    data: EvaluacionRespuestasIn,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(get_current_user),
    svc: Evaluacion360Service = Depends(_svc),
):
    return await svc.enviar_evaluacion(evaluacion_id, data, current_user, background_tasks)


# ══════════════════════════════════════════════════════════════════════════════
# Campanas (gestion RH)
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/campanas", response_model=CampanaListResponse)
async def list_campanas(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    estado: str | None = Query(None),
    search: str | None = Query(None),
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: Evaluacion360Service = Depends(_svc),
):
    return await svc.list_campanas(
        page=page, page_size=page_size, estado=estado, search=search
    )


@router.post("/campanas", response_model=CampanaDetalleResponse, status_code=status.HTTP_201_CREATED)
async def create_campana(
    data: CampanaCreate,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: Evaluacion360Service = Depends(_svc),
):
    return await svc.create_campana(data, current_user, background_tasks)


@router.get("/campanas/{campana_id}", response_model=CampanaDetalleResponse)
async def get_campana(
    campana_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: Evaluacion360Service = Depends(_svc),
):
    return await svc.get_campana(campana_id)


@router.put("/campanas/{campana_id}", response_model=CampanaDetalleResponse)
async def update_campana(
    campana_id: int,
    data: CampanaUpdate,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: Evaluacion360Service = Depends(_svc),
):
    return await svc.update_campana(campana_id, data, current_user)


@router.delete("/campanas/{campana_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campana(
    campana_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: Evaluacion360Service = Depends(_svc),
):
    await svc.delete_campana(campana_id, current_user)


@router.post("/campanas/{campana_id}/duplicar", response_model=CampanaDetalleResponse, status_code=status.HTTP_201_CREATED)
async def duplicar_campana(
    campana_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: Evaluacion360Service = Depends(_svc),
):
    return await svc.duplicar_campana(campana_id, current_user)


@router.post("/campanas/{campana_id}/activar", response_model=CampanaDetalleResponse)
async def activar_campana(
    campana_id: int,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: Evaluacion360Service = Depends(_svc),
):
    return await svc.activar_campana(campana_id, current_user, background_tasks)


@router.post("/campanas/{campana_id}/cerrar", response_model=CampanaDetalleResponse)
async def cerrar_campana(
    campana_id: int,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: Evaluacion360Service = Depends(_svc),
):
    return await svc.cerrar_campana(campana_id, current_user, background_tasks)


@router.post("/campanas/{campana_id}/cancelar", response_model=CampanaDetalleResponse)
async def cancelar_campana(
    campana_id: int,
    background_tasks: BackgroundTasks,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: Evaluacion360Service = Depends(_svc),
):
    return await svc.cancelar_campana(campana_id, current_user, background_tasks)


@router.get("/campanas/{campana_id}/participantes", response_model=list[ParticipanteResponse])
async def list_participantes(
    campana_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: Evaluacion360Service = Depends(_svc),
):
    return await svc.list_participantes(campana_id)


@router.post("/campanas/{campana_id}/sugerir-evaluadores", response_model=list[SugerenciaEvaluadorResponse])
async def sugerir_evaluadores(
    campana_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: Evaluacion360Service = Depends(_svc),
):
    return await svc.sugerir_evaluadores(campana_id)


@router.get("/campanas/{campana_id}/resultados", response_model=list[ResultadoParticipanteResponse])
async def resultados_campana(
    campana_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: Evaluacion360Service = Depends(_svc),
):
    return await svc.get_resultados_campana(campana_id)


@router.get("/participantes/{participante_id}/resultado", response_model=ResultadoParticipanteResponse)
async def resultado_participante(
    participante_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: Evaluacion360Service = Depends(_svc),
):
    return await svc.get_resultado_participante(participante_id)


@router.get("/participantes/{participante_id}/reporte", response_model=ReporteIndividualResponse)
async def reporte_individual(
    participante_id: int,
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: Evaluacion360Service = Depends(_svc),
):
    return await svc.get_reporte_individual(participante_id)


def _export_headers(nombre: str, formato: str) -> tuple[str, str]:
    if formato == "excel":
        return (
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            f"attachment; filename={nombre}.xlsx",
        )
    return ("application/pdf", f"attachment; filename={nombre}.pdf")


@router.get("/participantes/{participante_id}/reporte/export")
async def export_reporte_individual(
    participante_id: int,
    formato: str = Query("pdf", description="pdf o excel"),
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: Evaluacion360Service = Depends(_svc),
):
    output = await svc.export_reporte_individual(participante_id, formato)
    media, disp = _export_headers(f"reporte_360_{participante_id}", formato)
    return StreamingResponse(output, media_type=media, headers={"Content-Disposition": disp})


@router.get("/campanas/{campana_id}/resultados/export")
async def export_resultados_campana(
    campana_id: int,
    formato: str = Query("pdf", description="pdf o excel"),
    current_user: Empleado = Depends(role_checker(["operativo"])),
    svc: Evaluacion360Service = Depends(_svc),
):
    output = await svc.export_resultados_campana(campana_id, formato)
    media, disp = _export_headers(f"resultados_360_{campana_id}", formato)
    return StreamingResponse(output, media_type=media, headers={"Content-Disposition": disp})

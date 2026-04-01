from fastapi import APIRouter, Depends
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado

router = APIRouter(prefix="/api/v1/incidencias", tags=["Incidencias"])


@router.get("/")
async def health():
    return {"modulo": "incidencias", "status": "activo", "version": "1.0.0"}


@router.get("")
async def list_incidencias(
    current_user: Empleado = Depends(role_checker(["rh", "gerente", "supervisor"])),
):
    return {"items": [], "next_cursor": None, "total": 0}


@router.post("")
async def create_incidencia(
    current_user: Empleado = Depends(role_checker(["rh", "supervisor"])),
):
    return {"message": "Endpoint en desarrollo"}


@router.get("/{id}")
async def get_incidencia(
    id: int,
    current_user: Empleado = Depends(role_checker(["rh", "gerente", "supervisor"])),
):
    return {"message": "Endpoint en desarrollo", "id": id}


@router.put("/{id}/estado")
async def update_estado(
    id: int,
    current_user: Empleado = Depends(role_checker(["rh", "gerente"])),
):
    return {"message": "Endpoint en desarrollo", "id": id}


@router.post("/{id}/evidencias")
async def upload_evidencia(
    id: int,
    current_user: Empleado = Depends(role_checker(["rh", "supervisor"])),
):
    return {"message": "Endpoint en desarrollo", "id": id}


@router.get("/{id}/evidencias/{eid}")
async def download_evidencia(
    id: int,
    eid: int,
    current_user: Empleado = Depends(get_current_user),
):
    return {"message": "Endpoint en desarrollo", "incidencia_id": id, "evidencia_id": eid}

from fastapi import APIRouter, Depends
from app.core.dependencies import get_current_user, role_checker
from app.models.empleados import Empleado

router = APIRouter(prefix="/api/v1/actas", tags=["Actas Administrativas"])


@router.get("/")
async def health():
    return {"modulo": "actas", "status": "activo", "version": "1.0.0"}


@router.get("")
async def list_actas(
    current_user: Empleado = Depends(role_checker(["rh", "gerente", "supervisor"])),
):
    return {"items": [], "next_cursor": None, "total": 0}


@router.post("/generar/{incidencia_id}")
async def generar_acta(
    incidencia_id: int,
    current_user: Empleado = Depends(role_checker(["rh"])),
):
    # TODO: Llamar a Ollama LLM para generar borrador
    return {"message": "Generacion con IA en desarrollo", "incidencia_id": incidencia_id}


@router.get("/{id}")
async def get_acta(
    id: int,
    current_user: Empleado = Depends(role_checker(["rh", "gerente"])),
):
    return {"message": "Endpoint en desarrollo", "id": id}


@router.put("/{id}/editar")
async def editar_acta(
    id: int,
    current_user: Empleado = Depends(role_checker(["rh"])),
):
    return {"message": "Endpoint en desarrollo", "id": id}


@router.put("/{id}/firmar")
async def firmar_acta(
    id: int,
    current_user: Empleado = Depends(role_checker(["gerente", "director", "rh"])),
):
    return {"message": "Endpoint en desarrollo", "id": id}


@router.get("/{id}/pdf")
async def download_acta_pdf(
    id: int,
    current_user: Empleado = Depends(role_checker(["rh", "gerente"])),
):
    return {"message": "Generacion PDF en desarrollo", "id": id}

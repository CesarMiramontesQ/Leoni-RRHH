from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import role_checker
from app.models.empleados import Empleado
from app.schemas.organigrama import OrganigramaResponse
from app.services.organigrama_service import OrganigramaService

router = APIRouter(prefix="/api/v1/organigrama", tags=["Organigrama"])

_OPERATIVO = ["operativo"]


def _svc(db: AsyncSession = Depends(get_db)) -> OrganigramaService:
    return OrganigramaService(db)


@router.get("", response_model=OrganigramaResponse)
async def get_organigrama(
    current_user: Empleado = Depends(role_checker(_OPERATIVO)),
    svc: OrganigramaService = Depends(_svc),
):
    return await svc.obtener_estructura(current_user=current_user)

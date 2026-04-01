from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: int
    usuario_id: Optional[int] = None
    accion: str
    modulo: str
    entidad_id: Optional[int] = None
    datos_antes: Optional[Any] = None
    datos_despues: Optional[Any] = None
    ip_address: Optional[str] = None
    timestamp: datetime

    model_config = {"from_attributes": True}

from datetime import datetime
from pydantic import BaseModel


class NotificacionResponse(BaseModel):
    id: int
    destinatario_id: int
    tipo: str
    asunto: str
    cuerpo: str
    leida: bool
    enviada: bool
    created_at: datetime

    model_config = {"from_attributes": True}

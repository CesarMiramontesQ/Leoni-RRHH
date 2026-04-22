from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, computed_field


class NotificacionResponse(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    type: str
    is_read: bool
    enviada: bool
    target_url: str | None
    metadata: dict[str, Any] | None = Field(validation_alias="metadata_json")
    created_at: datetime
    updated_at: datetime

    @computed_field(return_type=int)
    @property
    def destinatario_id(self) -> int:
        return self.user_id

    @computed_field(return_type=str)
    @property
    def asunto(self) -> str:
        return self.title

    @computed_field(return_type=str)
    @property
    def cuerpo(self) -> str:
        return self.message

    @computed_field(return_type=str)
    @property
    def tipo(self) -> str:
        return self.type

    @computed_field(return_type=bool)
    @property
    def leida(self) -> bool:
        return self.is_read

    model_config = {"from_attributes": True}

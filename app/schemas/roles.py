from pydantic import BaseModel


class RolBase(BaseModel):
    nombre: str
    permisos: dict = {}


class RolCreate(RolBase):
    pass


class RolUpdate(BaseModel):
    nombre: str | None = None
    permisos: dict | None = None


class RolResponse(RolBase):
    id: int

    model_config = {"from_attributes": True}

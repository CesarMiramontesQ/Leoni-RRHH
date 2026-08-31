from typing import Optional

from pydantic import BaseModel


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str
    rol: str
    dept: Optional[str] = None
    jti: str


class RefreshRequest(BaseModel):
    refresh_token: str


class SessionPolicyResponse(BaseModel):
    idle_timeout_seconds: int

from datetime import datetime, timedelta, timezone
from secrets import compare_digest
from uuid import uuid4

import bcrypt
from fastapi import HTTPException, status
from jose import JWTError, jwt

from app.core.config import settings

# Bcrypt válido (contraseña interna desconocida). Empleados creados por sync IT/TRESS
# no pueden autenticarse hasta que RH asigne un hash real.
SYNC_PLACEHOLDER_PASSWORD_HASH = (
    "$2b$12$gJpzzCi/jaqyplh9LU47SOLuajGnAIH8vhlVhizRL.MfXl/4oUolG"
)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _legacy_plaintext_match(plain: str, stored: str) -> bool:
    """Compara contraseña legada almacenada en claro (p. ej. número de empleado hasta primer cambio)."""
    p = plain.strip().encode("utf-8")
    s = stored.encode("utf-8")
    if not p or not s or len(p) != len(s):
        return False
    return compare_digest(p, s)


def verify_password(plain: str, hashed: str) -> bool:
    """
    Acepta:
    - Hash bcrypt (`$2a$`, `$2b$`, `$2y$`) tras cambio de contraseña en el sistema legado o en RH.
    - Texto plano en la misma columna (datos sincronizados desde BD existente sin modificar).
    """
    if not hashed or not isinstance(hashed, str) or plain is None:
        return False
    h = hashed.strip()
    if not h:
        return False

    if h.startswith("$2"):
        try:
            return bcrypt.checkpw(plain.encode("utf-8"), h.encode("utf-8"))
        except ValueError:
            return False

    return _legacy_plaintext_match(plain, h)


def create_access_token(data: dict) -> str:
    payload = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload.update({
        "jti": str(uuid4()),
        "iat": now,
        "exp": expire,
        "type": "access",
    })
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict) -> str:
    payload = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS)
    payload.update({
        "jti": str(uuid4()),
        "iat": now,
        "exp": expire,
        "type": "refresh",
    })
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

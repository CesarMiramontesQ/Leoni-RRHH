# app/core/exceptions.py
"""
Jerarquia de excepciones de dominio para Plataforma RH Leoni Cable.

Reglas de uso:
  - Service layer lanza estas excepciones — NUNCA HTTPException
  - El handler global en main.py las convierte a JSONResponse con el status correcto
  - No capturar LeoniException en el Service para relanzar como otra — dejar subir al handler
"""

from __future__ import annotations


class LeoniException(Exception):
    """Clase base para todas las excepciones de dominio del sistema."""

    def __init__(self, detail: str, code: str | None = None):
        self.detail = detail
        self.code = code or self.__class__.__name__
        super().__init__(detail)


class NotFoundError(LeoniException):
    """Entidad no encontrada. Mapea a HTTP 404."""

    def __init__(self, entidad: str, id: int | str | None = None):
        detail = (
            f"{entidad} no encontrado"
            if id is None
            else f"{entidad} con id={id} no encontrado"
        )
        super().__init__(detail=detail, code="NOT_FOUND")


class ConflictError(LeoniException):
    """
    Estado de entidad en conflicto con la operacion solicitada.
    Ejemplos: solicitud ya aprobada, email duplicado, token ya revocado.
    Mapea a HTTP 409.
    """

    def __init__(self, detail: str):
        super().__init__(detail=detail, code="CONFLICT")


class ForbiddenError(LeoniException):
    """
    El usuario autenticado no tiene permiso para esta operacion especifica.
    Distinto de 401 (no autenticado) — aqui el usuario SI esta autenticado pero no
    tiene acceso a este recurso particular.
    Mapea a HTTP 403.
    """

    def __init__(self, detail: str = "Permiso denegado"):
        super().__init__(detail=detail, code="FORBIDDEN")


class UnauthorizedError(LeoniException):
    """
    Credenciales invalidas u operacion que requiere autenticacion valida.
    Mapea a HTTP 401.
    """

    def __init__(self, detail: str = "No autorizado"):
        super().__init__(detail=detail, code="UNAUTHORIZED")


class DomainValidationError(LeoniException):
    """
    Datos de negocio invalidos que la validacion Pydantic no puede detectar.
    Ejemplos: fecha_fin < fecha_inicio, dias_solicitados > dias_disponibles.
    Mapea a HTTP 422.
    """

    def __init__(self, detail: str, field: str | None = None):
        self.field = field
        super().__init__(detail=detail, code="VALIDATION_ERROR")


class ServiceUnavailableError(LeoniException):
    """
    Integracion externa no disponible o en error critico.
    Solo lanzar cuando la falla del servicio externo impide completar la operacion.
    Para fallas no criticas (ej. Ollama caido), usar fallback silencioso.
    Mapea a HTTP 503.
    """

    def __init__(self, detail: str = "Servicio externo no disponible"):
        super().__init__(detail=detail, code="SERVICE_UNAVAILABLE")


# Mapa de tipo de excepcion a status HTTP — usado por el handler global en main.py
EXCEPTION_STATUS_MAP: dict[type[LeoniException], int] = {
    NotFoundError: 404,
    ConflictError: 409,
    ForbiddenError: 403,
    UnauthorizedError: 401,
    DomainValidationError: 422,
    ServiceUnavailableError: 503,
}

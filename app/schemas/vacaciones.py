from pydantic import BaseModel


class SaldoVacacionesRealResponse(BaseModel):
    """Saldo real de días de gozo desde SQL Server datos-analisis (función GET_SALDOS_VACACION)."""

    empleado_id: int
    no_empleado: int
    saldo_gozo_total: float | None = None  # 0 si no hay periodos; None solo si no disponible


class VacacionesDisponibleSolicitudResponse(BaseModel):
    """Días disponibles para solicitar vacaciones: saldo TRESS menos días comprometidos
    en solicitudes en curso (pending/changes_requested) del empleado."""

    empleado_id: int
    no_empleado: int
    saldo_tress: float
    dias_comprometidos: int
    dias_disponibles: float

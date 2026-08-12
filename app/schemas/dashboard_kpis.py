from datetime import date

from pydantic import BaseModel, Field


class DashboardKpisResponse(BaseModel):
    """KPIs personales de nómina (TRESS) para las tarjetas del dashboard.

    Los valores numéricos son ``None`` cuando ``disponible`` es ``False``: a diferencia
    del resto de consumidores de TRESS —que bloquean con 503 porque un saldo incorrecto
    generaría una solicitud inválida—, el dashboard degrada y la UI pinta «—». Un 0 real
    y un fallo de conexión no deben verse igual.
    """

    disponible: bool = Field(
        description="False si datos-analisis no está configurada o no respondió."
    )

    vacaciones_disponibles: float | None = Field(
        default=None, description="Suma de días de gozo pendientes de todos los aniversarios."
    )
    vacaciones_tomadas_ciclo: float | None = Field(
        default=None, description="Días ya gozados del aniversario vigente."
    )
    vacaciones_derecho_ciclo: float | None = Field(
        default=None, description="Días que corresponden en el aniversario vigente."
    )
    ciclo_aniversario: int | None = Field(
        default=None, description="Número de aniversario vigente en TRESS."
    )
    ciclo_vence: date | None = Field(
        default=None, description="Fecha de vencimiento del ciclo vigente, si la hay."
    )

    home_office_dias_anio: int | None = Field(
        default=None, description="Días de home office registrados en el año en curso."
    )
    retardos_anio: int | None = Field(
        default=None,
        description=(
            "Retardos del año en curso, desde la caché `levelup_incidencias_tress`. "
            "**No depende de `disponible`**, que describe solo el bloque de vacaciones: "
            "un empleado sin saldo sincronizado igual recibe su conteo. `None` solo si "
            "falla la lectura; sin retardos es 0."
        ),
    )
    anio: int = Field(description="Año al que corresponden los KPIs de home office y retardos.")

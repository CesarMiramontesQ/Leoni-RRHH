"""
Solicitudes demo (vacaciones, home office, permiso sin goce) para capturas de pantalla.

Usa únicamente empleados activos ya registrados en la BD (no crea empleados) y respeta
las mismas reglas que valida `solicitud_service` al crear, para que lo sembrado no se
vea imposible en pantalla:

- **Sin empalmes ni duplicados**: un colaborador nunca queda con dos rangos activos que
  se traslapen (se consideran también las solicitudes que ya existían).
- **Home office**: un solo día, entre semana, solo colaboradores con clasificación
  Administrativo, y máximo uno por mes por colaborador.
- **Vacaciones**: los días solicitados nunca superan el saldo de la caché
  `levelup_vacaciones_disponibles`; quien no tiene saldo no genera vacaciones.
- **Coherencia temporal**: lo que queda `pending` o `changes_requested` cae siempre en el
  futuro (nadie deja sin resolver algo que ya pasó); `approved` / `rejected` / `cancelled`
  se reparten entre pasado y futuro.

**No** escribe en TRESS/DATOS_ANALISIS: aprobar aquí es solo el estado local. El saldo de
vacaciones y el conteo de home office tomado siguen siendo lo que dicen sus cachés.

Marca de lote: todas las filas se estampan con `created_at` terminado en
``.424242`` microsegundos. Es invisible en la UI (nadie muestra microsegundos) y permite
un `--cleanup` exacto sin ensuciar los textos de motivo/comentarios con la palabra DEMO.

Uso (Docker):
    docker-compose exec backend python -m app.utils.seed_solicitudes_demo
    docker-compose exec backend python -m app.utils.seed_solicitudes_demo --vacaciones 300 --home-office 120
    docker-compose exec backend python -m app.utils.seed_solicitudes_demo --cleanup            # dry-run
    docker-compose exec backend python -m app.utils.seed_solicitudes_demo --cleanup --execute  # borrar
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import random
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import Integer, cast, delete, func, select
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.empleados import Empleado
from app.models.solicitudes import Solicitud, SolicitudAprobacion
from app.models.vacaciones_disponibles import VacacionesDisponibles
from app.utils.clasificacion_empleado import empleado_es_administrativo

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

# Microsegundos sentinel que identifican las filas de este seed. 424242 no aparece por
# azar (1 en 1e6) y `created_at` se muestra siempre truncado a minutos en la UI.
MARCA_MICROSEGUNDOS = 424242

DEFAULT_VACACIONES = 260
DEFAULT_HOME_OFFICE = 90
DEFAULT_SIN_GOCE = 30

# Reparto de estados. Suma 100.
PESOS_ESTADO = {
    "approved": 45,
    "pending": 28,
    "rejected": 14,
    "cancelled": 8,
    "changes_requested": 5,
}

MOTIVOS = {
    "vacaciones": [
        "Descanso familiar programado",
        "Viaje familiar",
        "Asuntos personales",
        "Periodo vacacional del ciclo",
        "Descanso por fin de proyecto",
        "Trámites personales",
        "Vacaciones acumuladas del año anterior",
        "Evento familiar fuera de la ciudad",
    ],
    "home_office": [
        "Cita médica por la mañana",
        "Trabajo desde casa por entrega de reporte",
        "Mantenimiento en el domicilio",
        "Día de concentración para cierre de proyecto",
        "Trámite escolar de los hijos",
        "Recepción de servicio en casa",
    ],
    "permiso_sin_goce_sueldo": [
        "Asunto personal sin goce de sueldo",
        "Trámite migratorio",
        "Atención a familiar directo",
        "Diligencia legal",
    ],
}

COMENTARIOS_RECHAZO = [
    "Coincide con el cierre de mes del área.",
    "No hay cobertura disponible en esas fechas.",
    "Se traslapa con la auditoría programada.",
    "Alta carga de trabajo en la semana solicitada.",
    "Ya hay dos personas del equipo fuera esos días.",
]

COMENTARIOS_CAMBIOS = [
    "Favor de recorrer las fechas una semana para no empalmar con el inventario.",
    "Ajusta el rango: falta cubrir el turno del viernes.",
    "Indica quién cubre tus actividades durante la ausencia.",
]

COMENTARIOS_APROBACION = [
    "Autorizado. Deja tus pendientes cubiertos.",
    "De acuerdo, buen descanso.",
    "Autorizado por el área.",
    None,
    None,
]


def _marca_lote():
    """Predicado SQL que aísla las filas creadas por este seed."""
    return (
        cast(func.date_part("microseconds", Solicitud.created_at), Integer) % 1_000_000
        == MARCA_MICROSEGUNDOS
    )


def _tz() -> ZoneInfo:
    return ZoneInfo(settings.APP_TIMEZONE)


def _estampar(momento: datetime) -> datetime:
    """Fija los microsegundos sentinel del lote sobre un datetime con zona."""
    return momento.replace(microsecond=MARCA_MICROSEGUNDOS)


def _es_habil(dia: date) -> bool:
    return dia.weekday() < 5


def _fin_con_habiles(inicio: date, dias_habiles: int) -> date:
    """Último día del rango que empieza en `inicio` y suma `dias_habiles` hábiles."""
    restantes = dias_habiles
    cursor = inicio
    while True:
        if _es_habil(cursor):
            restantes -= 1
            if restantes == 0:
                return cursor
        cursor += timedelta(days=1)


def _solapa(a_ini: date, a_fin: date, b_ini: date, b_fin: date) -> bool:
    return a_ini <= b_fin and b_ini <= a_fin


def _dias_habiles(inicio: date, fin: date) -> int:
    total = 0
    cursor = inicio
    while cursor <= fin:
        if _es_habil(cursor):
            total += 1
        cursor += timedelta(days=1)
    return total


def _elegir_estado(rng: random.Random) -> str:
    estados = list(PESOS_ESTADO)
    return rng.choices(estados, weights=[PESOS_ESTADO[e] for e in estados], k=1)[0]


def _dia_habil_aleatorio(rng: random.Random, desde: date, hasta: date) -> date | None:
    """Un día hábil al azar dentro del rango (None si el rango no tiene ninguno)."""
    span = (hasta - desde).days
    if span < 0:
        return None
    for _ in range(30):
        candidato = desde + timedelta(days=rng.randint(0, span))
        if _es_habil(candidato):
            return candidato
    cursor = desde
    while cursor <= hasta:
        if _es_habil(cursor):
            return cursor
        cursor += timedelta(days=1)
    return None


def _ventana_inicio(rng: random.Random, estado: str, hoy: date) -> tuple[date, date]:
    """Rango [desde, hasta] donde puede caer `fecha_inicio`, según el estado."""
    if estado in ("pending", "changes_requested"):
        return hoy + timedelta(days=3), hoy + timedelta(days=60)
    if estado == "approved":
        if rng.random() < 0.6:
            return hoy - timedelta(days=120), hoy - timedelta(days=2)
        return hoy + timedelta(days=1), hoy + timedelta(days=45)
    if rng.random() < 0.5:
        return hoy - timedelta(days=90), hoy - timedelta(days=2)
    return hoy + timedelta(days=2), hoy + timedelta(days=45)


def _created_at(rng: random.Random, inicio: date, ahora: datetime) -> datetime:
    """Fecha de captura plausible: antes del inicio del permiso y nunca en el futuro."""
    tope = min(
        datetime.combine(inicio - timedelta(days=1), time(18, 0), tzinfo=ahora.tzinfo),
        ahora,
    )
    piso = tope - timedelta(days=rng.randint(2, 20))
    delta = (tope - piso).total_seconds()
    momento = piso + timedelta(seconds=rng.uniform(0, max(delta, 60)))
    return _estampar(min(momento, ahora))


def _resolucion_at(rng: random.Random, creado: datetime, inicio: date, ahora: datetime) -> datetime:
    """Momento en que el líder resolvió: después de capturar, antes de que inicie."""
    tope = min(
        datetime.combine(inicio, time(9, 0), tzinfo=ahora.tzinfo),
        ahora,
    )
    piso = creado + timedelta(hours=1)
    if tope <= piso:
        return _estampar(piso)
    delta = (tope - piso).total_seconds()
    return _estampar(piso + timedelta(seconds=rng.uniform(0, delta)))


async def _cargar_pool(session) -> tuple[list[Empleado], dict[int, float]]:
    """Empleados activos con líder activo, y saldo de vacaciones por `no_empleado`."""
    empleados = (
        (
            await session.execute(
                select(Empleado)
                .options(joinedload(Empleado.clasificacion))
                .where(Empleado.estado_id.in_(settings.ESTADOS_ACTIVOS_IDS))
            )
        )
        .unique()
        .scalars()
        .all()
    )
    activos = {e.empleado_id for e in empleados}
    con_lider = [e for e in empleados if e.lider_id and e.lider_id in activos]

    saldos = {
        int(no_emp): float(dias or 0)
        for no_emp, dias in (
            await session.execute(
                select(VacacionesDisponibles.no_empleado, VacacionesDisponibles.dias_disponibles)
            )
        ).all()
    }
    return con_lider, saldos


async def _rangos_ocupados(session) -> dict[int, list[tuple[date, date]]]:
    """Rangos ya existentes por empleado (cualquier estado): base para no empalmar."""
    ocupados: dict[int, list[tuple[date, date]]] = {}
    filas = (
        await session.execute(
            select(Solicitud.empleado_id, Solicitud.fecha_inicio, Solicitud.fecha_fin)
        )
    ).all()
    for empleado_id, inicio, fin in filas:
        ocupados.setdefault(int(empleado_id), []).append((inicio, fin))
    return ocupados


async def cleanup_solicitudes_demo(*, execute: bool = False) -> None:
    """Borra solo las solicitudes (y sus aprobaciones) estampadas por este seed."""
    async with AsyncSessionLocal() as session:
        ids = list(
            (await session.execute(select(Solicitud.id).where(_marca_lote()))).scalars().all()
        )
        aprobaciones = 0
        if ids:
            aprobaciones = (
                await session.execute(
                    select(func.count()).where(SolicitudAprobacion.solicitud_id.in_(ids))
                )
            ).scalar_one()

        logger.info(
            "Resumen: solicitudes del lote=%s | aprobaciones asociadas=%s", len(ids), aprobaciones
        )
        if not execute:
            logger.info("Modo simulación (--cleanup sin --execute). No se modificó la BD.")
            return
        if ids:
            await session.execute(
                delete(SolicitudAprobacion).where(SolicitudAprobacion.solicitud_id.in_(ids))
            )
            await session.execute(delete(Solicitud).where(Solicitud.id.in_(ids)))
            await session.commit()
        logger.info("Limpieza ejecutada: %s solicitud(es) eliminada(s).", len(ids))


async def seed_solicitudes_demo(
    *,
    n_vacaciones: int = DEFAULT_VACACIONES,
    n_home_office: int = DEFAULT_HOME_OFFICE,
    n_sin_goce: int = DEFAULT_SIN_GOCE,
    seed: int | None = 7,
) -> None:
    rng = random.Random(seed)
    tz = _tz()
    ahora = datetime.now(tz)
    hoy = ahora.date()

    async with AsyncSessionLocal() as session:
        pool, saldos = await _cargar_pool(session)
        if not pool:
            raise RuntimeError(
                "No hay empleados activos con líder activo; no se puede sembrar nada."
            )
        administrativos = [e for e in pool if empleado_es_administrativo(e)]
        logger.info(
            "Pool: %s empleado(s) con líder | administrativos: %s | con saldo de vacaciones: %s",
            len(pool),
            len(administrativos),
            sum(1 for e in pool if saldos.get(e.no_empleado, 0) >= 1),
        )
        if not administrativos and n_home_office:
            logger.warning("Sin colaboradores administrativos: se omite home office.")
            n_home_office = 0

        ocupados = await _rangos_ocupados(session)
        # Home office: máximo uno activo por (empleado, año, mes).
        ho_por_mes: set[tuple[int, int, int]] = set()
        for emp_id, rangos in ocupados.items():
            for ini, _fin in rangos:
                ho_por_mes.add((emp_id, ini.year, ini.month))
        # Días comprometidos contra el saldo de la caché.
        comprometidos: dict[int, float] = {}

        nuevas: list[tuple[Solicitud, str, int, datetime]] = []
        conteo: dict[tuple[str, str], int] = {}

        def _registrar(tipo: str, estado: str) -> None:
            conteo[(tipo, estado)] = conteo.get((tipo, estado), 0) + 1

        def _intentar(tipo: str) -> bool:
            estado = _elegir_estado(rng)
            candidatos = administrativos if tipo == "home_office" else pool
            empleado = rng.choice(candidatos)
            desde, hasta = _ventana_inicio(rng, estado, hoy)
            inicio = _dia_habil_aleatorio(rng, desde, hasta)
            if inicio is None:
                return False

            if tipo == "home_office":
                fin = inicio
                clave_mes = (empleado.empleado_id, inicio.year, inicio.month)
                if clave_mes in ho_por_mes:
                    return False
            elif tipo == "permiso_sin_goce_sueldo":
                fin = _fin_con_habiles(inicio, rng.randint(1, 3))
            else:
                saldo = saldos.get(empleado.no_empleado, 0.0)
                disponible = saldo - comprometidos.get(empleado.empleado_id, 0.0)
                if disponible < 1:
                    return False
                dias = min(
                    rng.choice([1, 2, 3, 3, 5, 5, 5, 7, 10]),
                    int(disponible),
                )
                fin = _fin_con_habiles(inicio, dias)

            previos = ocupados.setdefault(empleado.empleado_id, [])
            if any(_solapa(inicio, fin, p_ini, p_fin) for p_ini, p_fin in previos):
                return False

            creado = _created_at(rng, inicio, ahora)
            solicitud = Solicitud(
                empleado_id=empleado.empleado_id,
                tipo=tipo,
                fecha_inicio=inicio,
                fecha_fin=fin,
                estado=estado,
                nivel_actual=1,
                motivo=rng.choice(MOTIVOS[tipo]),
                comentarios=None,
                created_at=creado,
            )
            session.add(solicitud)
            previos.append((inicio, fin))
            if tipo == "home_office":
                ho_por_mes.add((empleado.empleado_id, inicio.year, inicio.month))
            if tipo == "vacaciones" and estado in ("pending", "changes_requested", "approved"):
                comprometidos[empleado.empleado_id] = comprometidos.get(
                    empleado.empleado_id, 0.0
                ) + _dias_habiles(inicio, fin)

            nuevas.append((solicitud, estado, empleado.lider_id, creado))
            _registrar(tipo, estado)
            return True

        objetivos = (
            ("vacaciones", n_vacaciones),
            ("home_office", n_home_office),
            ("permiso_sin_goce_sueldo", n_sin_goce),
        )
        for tipo, objetivo in objetivos:
            creadas = 0
            intentos = 0
            limite = max(objetivo * 60, 400)
            while creadas < objetivo and intentos < limite:
                intentos += 1
                if _intentar(tipo):
                    creadas += 1
            if creadas < objetivo:
                logger.warning(
                    "%s: se crearon %s de %s (sin combinaciones libres en %s intentos).",
                    tipo,
                    creadas,
                    objetivo,
                    intentos,
                )

        await session.flush()

        aprobaciones: list[SolicitudAprobacion] = []
        for solicitud, estado, lider_id, creado in nuevas:
            if estado == "approved":
                accion, comentario = "approve", rng.choice(COMENTARIOS_APROBACION)
            elif estado == "rejected":
                accion, comentario = "reject", rng.choice(COMENTARIOS_RECHAZO)
            elif estado == "changes_requested":
                accion, comentario = "request_changes", rng.choice(COMENTARIOS_CAMBIOS)
            else:
                continue
            aprobaciones.append(
                SolicitudAprobacion(
                    solicitud_id=solicitud.id,
                    aprobador_id=lider_id,
                    accion=accion,
                    nivel=1,
                    comentario=comentario,
                    timestamp=_resolucion_at(rng, creado, solicitud.fecha_inicio, ahora),
                )
            )
        session.add_all(aprobaciones)
        await session.commit()

        logger.info("=== Resumen solicitudes demo ===")
        for tipo, _objetivo in objetivos:
            detalle = {
                estado: n for (t, estado), n in sorted(conteo.items()) if t == tipo
            }
            logger.info("%-24s %s (total %s)", tipo, detalle, sum(detalle.values()))
        logger.info("Aprobaciones registradas: %s", len(aprobaciones))
        logger.info("Solicitudes insertadas:   %s", len(nuevas))


def main() -> None:
    parser = argparse.ArgumentParser(description="Solicitudes demo para capturas")
    parser.add_argument("--vacaciones", type=int, default=DEFAULT_VACACIONES)
    parser.add_argument("--home-office", type=int, default=DEFAULT_HOME_OFFICE)
    parser.add_argument("--sin-goce", type=int, default=DEFAULT_SIN_GOCE)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--cleanup", action="store_true", help="Eliminar el lote demo")
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Con --cleanup: aplicar borrado (sin esto solo muestra resumen)",
    )
    args = parser.parse_args()

    if args.cleanup:
        asyncio.run(cleanup_solicitudes_demo(execute=args.execute))
        return

    asyncio.run(
        seed_solicitudes_demo(
            n_vacaciones=args.vacaciones,
            n_home_office=args.home_office,
            n_sin_goce=args.sin_goce,
            seed=args.seed,
        )
    )


if __name__ == "__main__":
    main()

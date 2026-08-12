"""
Asistencias de comedor para capturas: confirma lo ya reservado y siembra histórico.

Dos operaciones, ambas sobre empleados y comedores que ya existen (no crea ninguno):

1. **Confirmar** (por defecto; se apaga con `--sin-confirmar`): los accesos `PENDIENTE`
   cuya fecha de servicio ya pasó (o es hoy) se resuelven — la mayoría a `ACCEDIDO`, unos
   pocos a `REPETIDO` (segunda entrada) o `EXPIRADO`.

   **`EXPIRADO` es «Cancelado»**, no «no asistió»: así lo etiquetan el reporte RH y la
   exportación a Excel, y es el estado que deja `cancelar_reserva`. Quien reservó y no
   fue a comer **se queda en `PENDIENTE`** — nada lo expira. Esa es justo la razón de
   dejar una fracción sin tocar: el resumen diario cuenta `PENDIENTE + ACCEDIDO` como
   denominador y `ACCEDIDO` como asistencias, así que si no quedara ningún pendiente en
   el pasado la gráfica de asistencia marcaría 100% todos los días.

2. **Histórico** (`--semanas N`): genera accesos de semanas anteriores para que la gráfica
   de asistencia diaria y los KPIs tengan curva en lugar de una sola barra. El conteo de
   cada día se calca del patrón que ya vive en la BD para ese día de la semana (los
   sábados y domingos comen bastantes menos), y solo participan colaboradores que ese día
   **no descansan** según su turno.

La `hora_entrada` cae dentro de la ventana de comida real del colaborador, resuelta con
`ComedorVentanaComidaService.resolver_ventanas` (empleado + fecha → turno → posición del
ciclo → jornada). Así el reporte de comedor muestra entradas coherentes con el horario que
él mismo calcula, en vez de horas inventadas. Si un par no tiene ventana (turno sin
catálogo, jornada sin configurar), se usa una hora de mediodía como respaldo.

Marca de lote: los accesos y registros creados aquí llevan `created_at` terminado en
``.424242`` microsegundos, lo que permite un `--cleanup` exacto. La **confirmación** de
accesos preexistentes no se revierte con `--cleanup` (no son filas nuestras); para eso
está `--revertir --desde --hasta`.

Uso (Docker):
    docker-compose exec backend python -m app.utils.seed_comedor_asistencia_demo
    docker-compose exec backend python -m app.utils.seed_comedor_asistencia_demo --semanas 8
    docker-compose exec backend python -m app.utils.seed_comedor_asistencia_demo --confirmar --semanas 0
    docker-compose exec backend python -m app.utils.seed_comedor_asistencia_demo --cleanup            # dry-run
    docker-compose exec backend python -m app.utils.seed_comedor_asistencia_demo --cleanup --execute
    docker-compose exec backend python -m app.utils.seed_comedor_asistencia_demo \\
        --revertir --desde 2026-08-11 --hasta 2026-08-12 --execute
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import random
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import Integer, cast, delete, func, select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.comedor import (
    Comedor,
    ComedorAcceso,
    ComedorAccesoEstado,
    ComedorRegistro,
    ComedorTipoComida,
)
from app.models.empleados import Empleado
from app.services.comedor_ventana_comida_service import ComedorVentanaComidaService

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

MARCA_MICROSEGUNDOS = 424242

DEFAULT_SEMANAS = 8
# Reparto de estados en días ya transcurridos. Suma 100.
#   ACCEDIDO  — entró a comer.
#   REPETIDO  — segunda entrada del día (no es otro platillo).
#   PENDIENTE — reservó y no fue: nada lo expira, y es lo que hace que el porcentaje
#               de asistencia diario no salga clavado en 100%.
#   EXPIRADO  — reserva cancelada (así se muestra: «Cancelado»).
PESO_ACCEDIDO = 80
PESO_REPETIDO = 5
PESO_PENDIENTE = 10
PESO_EXPIRADO = 5
# Ventana de respaldo cuando el turno no resuelve horario de comida.
COMIDA_RESPALDO = (time(12, 30), time(14, 30))
CHUNK = 2000


def _tz() -> ZoneInfo:
    return ZoneInfo(settings.APP_TIMEZONE)


def _estampar(momento: datetime) -> datetime:
    return momento.replace(microsecond=MARCA_MICROSEGUNDOS)


def _marca_lote(columna):
    return cast(func.date_part("microseconds", columna), Integer) % 1_000_000 == MARCA_MICROSEGUNDOS


def _lunes_de(valor: date) -> date:
    return valor - timedelta(days=valor.weekday())


def _hora_en_ventana(
    rng: random.Random, dia: date, inicio: time | None, fin: time | None, tz: ZoneInfo
) -> datetime:
    """Momento de entrada dentro de [inicio, fin], respetando ventanas que cruzan medianoche."""
    if inicio is None or fin is None:
        inicio, fin = COMIDA_RESPALDO
    base = datetime.combine(dia, inicio, tzinfo=tz)
    tope = datetime.combine(dia, fin, tzinfo=tz)
    if tope <= base:  # la jornada 011 come cerca de medianoche: termina al día siguiente
        tope += timedelta(days=1)
    # Casi nadie llega en el último minuto: se concentra la entrada en el 80% central.
    span = (tope - base).total_seconds()
    return _estampar(base + timedelta(seconds=rng.uniform(span * 0.1, span * 0.9)))


def _estado_aleatorio(rng: random.Random) -> ComedorAccesoEstado:
    return rng.choices(
        [
            ComedorAccesoEstado.ACCEDIDO,
            ComedorAccesoEstado.REPETIDO,
            ComedorAccesoEstado.PENDIENTE,
            ComedorAccesoEstado.EXPIRADO,
        ],
        weights=[PESO_ACCEDIDO, PESO_REPETIDO, PESO_PENDIENTE, PESO_EXPIRADO],
        k=1,
    )[0]


async def _mapa_no_empleado(session, empleado_ids: list[int]) -> dict[int, int]:
    filas = (
        await session.execute(
            select(Empleado.empleado_id, Empleado.no_empleado).where(
                Empleado.empleado_id.in_(empleado_ids)
            )
        )
    ).all()
    return {int(eid): int(no_emp) for eid, no_emp in filas if no_emp is not None}


async def _participantes(session) -> tuple[int, list[int]]:
    """Comedor y colaboradores que ya usan el servicio (los que tienen accesos)."""
    fila = (
        await session.execute(
            select(ComedorAcceso.comedor_id, func.count())
            .group_by(ComedorAcceso.comedor_id)
            .order_by(func.count().desc())
            .limit(1)
        )
    ).first()
    if fila is None:
        comedor_id = (
            await session.execute(
                select(Comedor.id).where(Comedor.activo.is_(True)).order_by(Comedor.id).limit(1)
            )
        ).scalar_one_or_none()
        if comedor_id is None:
            raise RuntimeError("No hay comedores activos en la BD.")
        empleados: list[int] = []
    else:
        comedor_id = int(fila[0])
        empleados = [
            int(x)
            for x in (
                await session.execute(
                    select(ComedorAcceso.empleado_id)
                    .where(ComedorAcceso.comedor_id == comedor_id)
                    .distinct()
                )
            )
            .scalars()
            .all()
        ]
    return comedor_id, sorted(empleados)


async def _objetivo_por_weekday(session) -> dict[int, int]:
    """Promedio de accesos por día de la semana en los datos que ya existen."""
    filas = (
        await session.execute(
            select(ComedorAcceso.fecha_servicio, func.count())
            .group_by(ComedorAcceso.fecha_servicio)
        )
    ).all()
    acumulado: dict[int, list[int]] = {}
    for fecha, total in filas:
        acumulado.setdefault(fecha.weekday(), []).append(int(total))
    return {wd: round(sum(v) / len(v)) for wd, v in acumulado.items()}


async def _registros_por_semana(
    session, *, comedor_id: int, empleado_ids: list[int], semanas: list[date]
) -> dict[tuple[int, date], int]:
    """`(empleado, lunes) -> registro_id`, creando los que falten."""
    existentes = {
        (int(eid), sem): int(rid)
        for rid, eid, sem in (
            await session.execute(
                select(ComedorRegistro.id, ComedorRegistro.empleado_id, ComedorRegistro.semana)
                .where(ComedorRegistro.comedor_id == comedor_id)
                .where(ComedorRegistro.semana.in_(semanas))
            )
        ).all()
    }
    creado_en = _estampar(datetime.now(_tz()))
    nuevos: list[ComedorRegistro] = []
    for empleado_id in empleado_ids:
        for semana in semanas:
            if (empleado_id, semana) in existentes:
                continue
            nuevos.append(
                ComedorRegistro(
                    empleado_id=empleado_id,
                    comedor_id=comedor_id,
                    semana=semana,
                    tipo_platillo="normal",
                    acceso_concedido=True,
                    created_at=creado_en,
                )
            )
    if nuevos:
        session.add_all(nuevos)
        await session.flush()
        for reg in nuevos:
            existentes[(reg.empleado_id, reg.semana)] = reg.id
        logger.info("Registros semanales creados: %s", len(nuevos))
    return existentes


async def confirmar_pendientes(session, *, hasta: date, rng: random.Random) -> dict[str, int]:
    """Resuelve los accesos PENDIENTE cuya fecha de servicio ya ocurrió."""
    tz = _tz()
    # Se excluyen las filas del propio lote: el histórico ya salió con su mezcla de
    # estados y volver a sortearlas convertiría en asistencia casi todo lo que había
    # dejado deliberadamente en PENDIENTE (el «reservó y no fue»), dejando la gráfica
    # de asistencia pegada al 100%.
    pendientes = (
        (
            await session.execute(
                select(ComedorAcceso).where(
                    ComedorAcceso.estado_acceso == ComedorAccesoEstado.PENDIENTE,
                    ComedorAcceso.fecha_servicio <= hasta,
                    ~_marca_lote(ComedorAcceso.created_at),
                )
            )
        )
        .scalars()
        .all()
    )
    if not pendientes:
        logger.info("No hay accesos PENDIENTE con fecha <= %s.", hasta.isoformat())
        return {}

    no_emp = await _mapa_no_empleado(session, [a.empleado_id for a in pendientes])
    ventanas = await ComedorVentanaComidaService(session).resolver_ventanas(
        [(no_emp[a.empleado_id], a.fecha_servicio) for a in pendientes if a.empleado_id in no_emp]
    )

    conteo: dict[str, int] = {}
    for acceso in pendientes:
        estado = _estado_aleatorio(rng)
        acceso.estado_acceso = estado
        # PENDIENTE se queda tal cual: es «reservó y no fue», no un limbo que haya que
        # resolver. EXPIRADO es una cancelación, que tampoco tiene hora de entrada.
        if estado in (ComedorAccesoEstado.EXPIRADO, ComedorAccesoEstado.PENDIENTE):
            acceso.hora_entrada = None
        else:
            ventana = ventanas.get((no_emp.get(acceso.empleado_id, -1), acceso.fecha_servicio))
            acceso.hora_entrada = _hora_en_ventana(
                rng,
                acceso.fecha_servicio,
                getattr(ventana, "hora_inicio_comida", None),
                getattr(ventana, "hora_fin_comida", None),
                tz,
            )
        conteo[estado.value] = conteo.get(estado.value, 0) + 1
    await session.commit()
    logger.info("Confirmados %s acceso(s) hasta %s: %s", len(pendientes), hasta.isoformat(), conteo)
    return conteo


async def generar_historico(
    session, *, semanas: int, hasta: date, rng: random.Random
) -> dict[str, int]:
    """Siembra accesos de días anteriores replicando el patrón semanal ya presente."""
    if semanas <= 0:
        return {}
    tz = _tz()
    desde = hasta - timedelta(days=7 * semanas - 1)
    comedor_id, empleados = await _participantes(session)
    if not empleados:
        raise RuntimeError(
            "No hay accesos previos de los que deducir quién usa el comedor; "
            "genera primero las reservas semanales."
        )
    objetivo_wd = await _objetivo_por_weekday(session)
    if not objetivo_wd:
        raise RuntimeError("No hay datos previos para deducir el patrón de asistencia diaria.")
    logger.info(
        "Histórico %s → %s | comedor_id=%s | %s colaborador(es) | objetivo por día: %s",
        desde.isoformat(),
        hasta.isoformat(),
        comedor_id,
        len(empleados),
        {d: objetivo_wd.get(d) for d in range(7)},
    )

    dias = [desde + timedelta(days=i) for i in range((hasta - desde).days + 1)]
    ocupados = {
        (int(eid), fecha)
        for eid, fecha in (
            await session.execute(
                select(ComedorAcceso.empleado_id, ComedorAcceso.fecha_servicio).where(
                    ComedorAcceso.fecha_servicio >= desde,
                    ComedorAcceso.fecha_servicio <= hasta,
                )
            )
        ).all()
    }

    no_emp = await _mapa_no_empleado(session, empleados)
    candidatos = [e for e in empleados if e in no_emp]
    servicio = ComedorVentanaComidaService(session)
    ventanas = await servicio.resolver_ventanas(
        [(no_emp[e], dia) for e in candidatos for dia in dias]
    )

    registros = await _registros_por_semana(
        session,
        comedor_id=comedor_id,
        empleado_ids=candidatos,
        semanas=sorted({_lunes_de(d) for d in dias}),
    )

    creado_en = _estampar(datetime.now(tz))
    conteo: dict[str, int] = {}
    pendiente_insert: list[ComedorAcceso] = []
    total = 0

    for dia in dias:
        elegibles = [
            e
            for e in candidatos
            if (e, dia) not in ocupados
            and getattr(ventanas.get((no_emp[e], dia)), "motivo", None) != "DESCANSO"
        ]
        objetivo = objetivo_wd.get(dia.weekday(), round(len(candidatos) * 0.9))
        objetivo = round(objetivo * rng.uniform(0.96, 1.04))
        muestra = rng.sample(elegibles, min(objetivo, len(elegibles)))
        for empleado_id in muestra:
            estado = _estado_aleatorio(rng)
            ventana = ventanas.get((no_emp[empleado_id], dia))
            hora = (
                None
                if estado in (ComedorAccesoEstado.EXPIRADO, ComedorAccesoEstado.PENDIENTE)
                else _hora_en_ventana(
                    rng,
                    dia,
                    getattr(ventana, "hora_inicio_comida", None),
                    getattr(ventana, "hora_fin_comida", None),
                    tz,
                )
            )
            pendiente_insert.append(
                ComedorAcceso(
                    empleado_id=empleado_id,
                    comedor_id=comedor_id,
                    comedor_registro_id=registros[(empleado_id, _lunes_de(dia))],
                    fecha_servicio=dia,
                    tipo_comida=(
                        ComedorTipoComida.casera
                        if rng.random() < 0.7
                        else ComedorTipoComida.saludable
                    ),
                    estado_acceso=estado,
                    hora_entrada=hora,
                    created_at=creado_en,
                )
            )
            conteo[estado.value] = conteo.get(estado.value, 0) + 1
            total += 1
        if len(pendiente_insert) >= CHUNK:
            session.add_all(pendiente_insert)
            await session.flush()
            pendiente_insert = []

    if pendiente_insert:
        session.add_all(pendiente_insert)
    await session.commit()
    logger.info("Histórico insertado: %s acceso(s) | estados %s", total, conteo)
    return conteo


async def cleanup(*, execute: bool = False) -> None:
    """Borra accesos y registros semanales creados por este seed (por marca de lote)."""
    async with AsyncSessionLocal() as session:
        n_accesos = (
            await session.execute(
                select(func.count()).where(_marca_lote(ComedorAcceso.created_at))
            )
        ).scalar_one()
        n_registros = (
            await session.execute(
                select(func.count()).where(_marca_lote(ComedorRegistro.created_at))
            )
        ).scalar_one()
        logger.info("Resumen: accesos del lote=%s | registros del lote=%s", n_accesos, n_registros)
        if not execute:
            logger.info("Modo simulación (--cleanup sin --execute). No se modificó la BD.")
            return
        await session.execute(delete(ComedorAcceso).where(_marca_lote(ComedorAcceso.created_at)))
        await session.execute(
            delete(ComedorRegistro).where(_marca_lote(ComedorRegistro.created_at))
        )
        await session.commit()
        logger.info(
            "Limpieza ejecutada: %s acceso(s) y %s registro(s) eliminados.", n_accesos, n_registros
        )


async def revertir_confirmacion(*, desde: date, hasta: date, execute: bool = False) -> None:
    """Devuelve a PENDIENTE los accesos de un rango (para deshacer `--confirmar`)."""
    async with AsyncSessionLocal() as session:
        filas = (
            (
                await session.execute(
                    select(ComedorAcceso).where(
                        ComedorAcceso.fecha_servicio >= desde,
                        ComedorAcceso.fecha_servicio <= hasta,
                        ComedorAcceso.estado_acceso != ComedorAccesoEstado.PENDIENTE,
                    )
                )
            )
            .scalars()
            .all()
        )
        logger.info(
            "Accesos a revertir entre %s y %s: %s",
            desde.isoformat(),
            hasta.isoformat(),
            len(filas),
        )
        if not execute:
            logger.info("Modo simulación (--revertir sin --execute). No se modificó la BD.")
            return
        for acceso in filas:
            acceso.estado_acceso = ComedorAccesoEstado.PENDIENTE
            acceso.hora_entrada = None
        await session.commit()
        logger.info("Revertidos %s acceso(s) a PENDIENTE.", len(filas))


async def run(*, semanas: int, confirmar: bool, seed: int | None) -> None:
    rng = random.Random(seed)
    hoy = datetime.now(_tz()).date()
    async with AsyncSessionLocal() as session:
        if semanas > 0:
            await generar_historico(
                session, semanas=semanas, hasta=hoy - timedelta(days=1), rng=rng
            )
        if confirmar:
            await confirmar_pendientes(session, hasta=hoy, rng=rng)


def main() -> None:
    parser = argparse.ArgumentParser(description="Asistencias de comedor para capturas")
    parser.add_argument("--semanas", type=int, default=DEFAULT_SEMANAS, help="0 = sin histórico")
    parser.add_argument(
        "--sin-confirmar",
        action="store_true",
        help="No tocar los accesos PENDIENTE ya existentes de hoy y días anteriores",
    )
    parser.add_argument("--confirmar", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--seed", type=int, default=11)
    parser.add_argument("--cleanup", action="store_true")
    parser.add_argument("--revertir", action="store_true")
    parser.add_argument("--desde", type=date.fromisoformat)
    parser.add_argument("--hasta", type=date.fromisoformat)
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()

    if args.cleanup:
        asyncio.run(cleanup(execute=args.execute))
        return
    if args.revertir:
        if not args.desde or not args.hasta:
            parser.error("--revertir requiere --desde y --hasta (YYYY-MM-DD)")
        asyncio.run(
            revertir_confirmacion(desde=args.desde, hasta=args.hasta, execute=args.execute)
        )
        return

    asyncio.run(
        run(semanas=args.semanas, confirmar=not args.sin_confirmar, seed=args.seed)
    )


if __name__ == "__main__":
    main()

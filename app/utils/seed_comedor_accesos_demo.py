"""
Simulación de accesos de comedor para pruebas del dashboard RH.

Usa únicamente empleados activos ya registrados en la BD (no crea empleados).
Para datos demo previos generados por versiones anteriores, usar --cleanup.

Uso (Docker):
    # Simulación futura (default)
    docker-compose exec backend python -m app.utils.seed_comedor_accesos_demo

    # Pasado — gráfica de asistencia diaria
    docker-compose exec backend python -m app.utils.seed_comedor_accesos_demo \\
      --pasado --total 500 --accedido-repetido 423 --semanas 12

    # Eliminar empleados demo y accesos de simulaciones anteriores (dry-run)
    docker-compose exec backend python -m app.utils.seed_comedor_accesos_demo --cleanup

    # Ejecutar limpieza
    docker-compose exec backend python -m app.utils.seed_comedor_accesos_demo --cleanup --execute

Empleado×fecha únicos (uq). REPETIDO no suma en % asistencia del resumen (solo ACCEDIDO).
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import random
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import delete, func, select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.actas import ActaAdministrativa, ActaAprobacion
from app.models.comedor import (
    Comedor,
    ComedorAcceso,
    ComedorAccesoEstado,
    ComedorRegistro,
    ComedorTipoComida,
    MenuSemanal,
)
from app.models.empleados import Empleado
from app.models.incidencias import Evidencia, Incidencia
from app.models.notificaciones import Notificacion
from app.models.solicitudes import Solicitud, SolicitudAprobacion

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

DEFAULT_TOTAL = 400
DEFAULT_ACCEDIDO = 100
DEFAULT_REPETIDO = 100
DEFAULT_SEMANAS = 3
DEFAULT_DIAS_ACCEDIDO_PASADO = 90

# Marcadores exclusivos de empleados creados por versiones anteriores de este script.
DEMO_EMAIL_DOMAIN = "@leoni.test"
DEMO_EMAIL_PREFIX = "comedor.demo."
DEMO_NO_EMPLEADO_PREFIX = "CDEMO-"
DEMO_NOMBRE_PREFIX = "DEMO COMEDOR,"


class InsufficientEmployeesError(RuntimeError):
    """No hay empleados activos suficientes para la simulación."""


class DemoEmployeeNotSafeError(RuntimeError):
    """Un empleado marcado como demo tiene datos productivos; no se elimina."""


def _monday_of(value: date) -> date:
    return value - timedelta(days=value.weekday())


def _date_range(desde: date, hasta: date) -> list[date]:
    out: list[date] = []
    cursor = desde
    while cursor <= hasta:
        out.append(cursor)
        cursor += timedelta(days=1)
    return out


def is_comedor_demo_empleado(
    *,
    email: str | None,
    no_empleado: str,
    nombre: str,
) -> bool:
    """True solo si coincide con el patrón exclusivo de empleados demo de simulación."""
    if not email or not email.startswith(DEMO_EMAIL_PREFIX) or not email.endswith(DEMO_EMAIL_DOMAIN):
        return False
    if not no_empleado.startswith(DEMO_NO_EMPLEADO_PREFIX):
        return False
    if not nombre.strip().upper().startswith(DEMO_NOMBRE_PREFIX):
        return False
    return True


def _assert_no_demo_empleados(empleado_ids: list[int], demo_ids: set[int]) -> None:
    overlap = set(empleado_ids) & demo_ids
    if overlap:
        raise RuntimeError(
            f"La simulación no puede usar empleados demo (ids={sorted(overlap)}). "
            "Ejecuta --cleanup --execute primero."
        )


async def _resolve_comedor(session) -> Comedor:
    row = (
        await session.execute(
            select(Comedor).where(Comedor.activo.is_(True)).order_by(Comedor.id.asc()).limit(1)
        )
    ).scalar_one_or_none()
    if row:
        return row
    row = Comedor(nombre="Comedor Principal", ubicacion="Planta", capacidad=600, activo=True)
    session.add(row)
    await session.flush()
    logger.info("Comedor creado id=%s", row.id)
    return row


async def _find_demo_empleados(session) -> list[Empleado]:
    rows = (
        await session.execute(
            select(Empleado).where(
                Empleado.email.isnot(None),
                Empleado.email.like(f"{DEMO_EMAIL_PREFIX}%{DEMO_EMAIL_DOMAIN}"),
                Empleado.no_empleado.like(f"{DEMO_NO_EMPLEADO_PREFIX}%"),
            )
        )
    ).scalars()
    return [e for e in rows.all() if is_comedor_demo_empleado(email=e.email, no_empleado=e.no_empleado, nombre=e.nombre)]


async def _load_active_empleado_ids(session, *, demo_ids: set[int]) -> list[int]:
    """Empleados activos existentes (sin crear nuevos), excluyendo demo."""
    rows = (
        await session.execute(
            select(Empleado.id)
            .where(
                Empleado.estado_id.in_(settings.ESTADOS_ACTIVOS_IDS),
                Empleado.id.notin_(demo_ids) if demo_ids else True,
            )
            .order_by(Empleado.id.asc())
        )
    ).scalars()
    return list(rows.all())


async def _validate_demo_safe_to_delete(session, empleado_id: int) -> None:
    """Verifica que el empleado demo no tenga datos productivos fuera de comedor."""
    checks: list[tuple[str, object]] = [
        ("solicitudes", Solicitud.empleado_id == empleado_id),
        ("solicitudes_aprobador", SolicitudAprobacion.aprobador_id == empleado_id),
        ("incidencias", Incidencia.empleado_id == empleado_id),
        ("evidencias", Evidencia.subido_por == empleado_id),
        ("actas", ActaAdministrativa.empleado_id == empleado_id),
        ("actas_generadas", ActaAdministrativa.generado_por == empleado_id),
        ("actas_firmante", ActaAprobacion.firmante_id == empleado_id),
        ("notificaciones", Notificacion.user_id == empleado_id),
        ("menus_creados", MenuSemanal.created_by == empleado_id),
        ("subordinados", Empleado.lider_id == empleado_id),
    ]
    for label, cond in checks:
        n = (await session.execute(select(func.count()).where(cond))).scalar_one()
        if n:
            raise DemoEmployeeNotSafeError(
                f"Empleado demo id={empleado_id} tiene {n} registro(s) en '{label}'; no se elimina."
            )


async def _simulation_batch_window(session, demo_ids: list[int]) -> tuple[datetime, datetime] | None:
    """Ventana created_at de accesos insertados junto con empleados demo."""
    if not demo_ids:
        return None
    row = (
        await session.execute(
            select(
                func.min(ComedorAcceso.created_at),
                func.max(ComedorAcceso.created_at),
            ).where(ComedorAcceso.empleado_id.in_(demo_ids))
        )
    ).one()
    if row[0] is None or row[1] is None:
        return None
    return row[0], row[1]


async def cleanup_comedor_demo_data(*, execute: bool = False) -> None:
    """
    Elimina empleados demo de simulación y sus accesos/registros de comedor.
    También borra accesos del mismo lote de inserción (mismo created_at) en empleados reales.
    """
    async with AsyncSessionLocal() as session:
        demos = await _find_demo_empleados(session)
        demo_ids = [e.id for e in demos]
        logger.info("Empleados demo identificados: %s", len(demo_ids))

        for emp in demos:
            await _validate_demo_safe_to_delete(session, emp.id)

        batch = await _simulation_batch_window(session, demo_ids)
        accesos_demo = 0
        accesos_lote = 0
        registros_demo = 0

        if demo_ids:
            accesos_demo = (
                await session.execute(
                    select(func.count()).where(ComedorAcceso.empleado_id.in_(demo_ids))
                )
            ).scalar_one()
            registros_demo = (
                await session.execute(
                    select(func.count()).where(ComedorRegistro.empleado_id.in_(demo_ids))
                )
            ).scalar_one()

        if batch:
            t_min, t_max = batch
            accesos_lote = (
                await session.execute(
                    select(func.count()).where(
                        ComedorAcceso.created_at >= t_min,
                        ComedorAcceso.created_at <= t_max,
                    )
                )
            ).scalar_one()
            logger.info(
                "Lote de simulación: %s → %s | accesos en ventana: %s (incluye demo + reales del mismo run)",
                t_min.isoformat(),
                t_max.isoformat(),
                accesos_lote,
            )

        logger.info(
            "Resumen dry-run: empleados_demo=%s | accesos_demo=%s | registros_demo=%s",
            len(demo_ids),
            accesos_demo,
            registros_demo,
        )

        if not execute:
            logger.info("Modo simulación (--cleanup sin --execute). No se modificó la BD.")
            return

        if batch:
            t_min, t_max = batch
            await session.execute(
                delete(ComedorAcceso).where(
                    ComedorAcceso.created_at >= t_min,
                    ComedorAcceso.created_at <= t_max,
                )
            )
        elif demo_ids:
            await session.execute(
                delete(ComedorAcceso).where(ComedorAcceso.empleado_id.in_(demo_ids))
            )

        if demo_ids:
            await session.execute(
                delete(ComedorRegistro).where(ComedorRegistro.empleado_id.in_(demo_ids))
            )
            await session.execute(delete(Empleado).where(Empleado.id.in_(demo_ids)))

        orphan_ids = (
            await session.execute(
                select(ComedorRegistro.id).where(
                    ~ComedorRegistro.id.in_(select(ComedorAcceso.comedor_registro_id).distinct())
                )
            )
        ).scalars()
        orphan_list = list(orphan_ids.all())
        if orphan_list:
            await session.execute(delete(ComedorRegistro).where(ComedorRegistro.id.in_(orphan_list)))

        await session.commit()

        logger.info(
            "Limpieza ejecutada: %s empleados demo eliminados; accesos del lote y registros asociados borrados.",
            len(demo_ids),
        )


async def _existing_pairs(session, desde: date, hasta: date) -> set[tuple[int, date]]:
    rows = await session.execute(
        select(ComedorAcceso.empleado_id, ComedorAcceso.fecha_servicio).where(
            ComedorAcceso.fecha_servicio >= desde,
            ComedorAcceso.fecha_servicio <= hasta,
        )
    )
    return {(int(eid), fd) for eid, fd in rows.all()}


async def _get_or_create_registro(
    session,
    cache: dict[tuple[int, date], int],
    *,
    empleado_id: int,
    comedor_id: int,
    semana: date,
) -> int:
    key = (empleado_id, semana)
    if key in cache:
        return cache[key]
    existing = (
        await session.execute(
            select(ComedorRegistro.id).where(
                ComedorRegistro.empleado_id == empleado_id,
                ComedorRegistro.comedor_id == comedor_id,
                ComedorRegistro.semana == semana,
            )
        )
    ).scalar_one_or_none()
    if existing:
        cache[key] = int(existing)
        return cache[key]
    reg = ComedorRegistro(
        empleado_id=empleado_id,
        comedor_id=comedor_id,
        semana=semana,
        tipo_platillo=random.choice(["normal", "dieta"]),
        acceso_concedido=False,
    )
    session.add(reg)
    await session.flush()
    cache[key] = reg.id
    return reg.id


def _split_accedido_repetido(total_activos: int, n_accedido: int | None, n_repetido: int | None) -> tuple[int, int]:
    if n_accedido is not None and n_repetido is not None:
        if n_accedido + n_repetido != total_activos:
            raise ValueError("--accedido + --repetido debe igualar --accedido-repetido")
        return n_accedido, n_repetido
    n_rep = max(0, min(total_activos // 6, total_activos // 5))
    n_acc = total_activos - n_rep
    return n_acc, n_rep


def _assign_states(
    pairs: list[tuple[int, date]],
    *,
    n_accedido: int,
    n_repetido: int,
    ref_date: date | None = None,
    boost_ref_accedido: bool = False,
) -> list[ComedorAccesoEstado]:
    n_pendiente = len(pairs) - n_accedido - n_repetido
    if n_pendiente < 0:
        raise ValueError("accedido + repetido no puede superar el total de pares")

    estados: list[ComedorAccesoEstado] = (
        [ComedorAccesoEstado.ACCEDIDO] * n_accedido
        + [ComedorAccesoEstado.REPETIDO] * n_repetido
        + [ComedorAccesoEstado.PENDIENTE] * n_pendiente
    )
    random.shuffle(estados)

    if boost_ref_accedido and ref_date is not None:
        ref_idx = [i for i, (_, fd) in enumerate(pairs) if fd == ref_date]
        if ref_idx:
            target = min(len(ref_idx), max(15, n_accedido // 8))
            for i in random.sample(ref_idx, target):
                if estados[i] != ComedorAccesoEstado.ACCEDIDO:
                    swap = next(
                        (j for j, e in enumerate(estados) if e == ComedorAccesoEstado.ACCEDIDO and j != i),
                        None,
                    )
                    if swap is not None:
                        estados[i], estados[swap] = estados[swap], estados[i]
                    else:
                        estados[i] = ComedorAccesoEstado.ACCEDIDO

    return estados


async def _collect_pairs(
    session,
    empleado_ids: list[int],
    desde: date,
    hasta: date,
    total: int,
) -> tuple[list[tuple[int, date]], date]:
    """Arma hasta `total` pares libres; extiende rango de fechas si hace falta (sin crear empleados)."""
    dias = _date_range(desde, hasta)
    empleado_ids = list(empleado_ids)
    fin = hasta
    max_extension_weeks = 52

    for _ in range(max_extension_weeks):
        ocupados = await _existing_pairs(session, desde, fin)
        candidatos = [
            (eid, fd) for eid in empleado_ids for fd in dias if (eid, fd) not in ocupados
        ]
        if len(candidatos) >= total:
            random.shuffle(candidatos)
            return candidatos[:total], fin
        fin = fin + timedelta(days=7)
        dias = _date_range(desde, fin)

    raise InsufficientEmployeesError(
        f"No hay suficientes combinaciones empleado×fecha libres para {total} accesos "
        f"con {len(empleado_ids)} empleado(s) activo(s). "
        "Reduce --total, amplía --semanas o agrega más empleados activos reales."
    )


async def reubicar_accedidos_ultimos_dias(*, dias: int = DEFAULT_DIAS_ACCEDIDO_PASADO) -> None:
    """Mueve fechas de accesos ACCEDIDO al rango [hoy - dias, hoy] (unicidad empleado×fecha)."""
    hoy = date.today()
    desde = hoy - timedelta(days=dias)

    async with AsyncSessionLocal() as session:
        comedor = await _resolve_comedor(session)
        accesos = (
            await session.execute(
                select(ComedorAcceso).where(ComedorAcceso.estado_acceso == ComedorAccesoEstado.ACCEDIDO)
            )
        ).scalars().all()
        if not accesos:
            logger.info("No hay accesos ACCEDIDO para reubicar.")
            return

        ocupados = await _existing_pairs(session, desde, hoy)
        dias_libres = _date_range(desde, hoy)
        registro_cache: dict[tuple[int, date], int] = {}
        actualizados = 0

        for acc in accesos:
            par_actual = (acc.empleado_id, acc.fecha_servicio)
            ocupados.discard(par_actual)
            candidatos = [fd for fd in dias_libres if (acc.empleado_id, fd) not in ocupados]
            if not candidatos:
                ocupados.add(par_actual)
                raise InsufficientEmployeesError(
                    f"Sin fecha libre para empleado_id={acc.empleado_id} en los últimos {dias} días."
                )
            nueva_fecha = random.choice(candidatos)
            ocupados.add((acc.empleado_id, nueva_fecha))
            acc.fecha_servicio = nueva_fecha
            acc.comedor_registro_id = await _get_or_create_registro(
                session,
                registro_cache,
                empleado_id=acc.empleado_id,
                comedor_id=acc.comedor_id or comedor.id,
                semana=_monday_of(nueva_fecha),
            )
            if acc.hora_entrada is None:
                acc.hora_entrada = datetime.now(timezone.utc)
            actualizados += 1

        await session.commit()
        en_rango = sum(1 for a in accesos if desde <= a.fecha_servicio <= hoy)
        logger.info(
            "Reubicados %s ACCEDIDO | rango %s → %s | verificados en ventana: %s",
            actualizados,
            desde.isoformat(),
            hoy.isoformat(),
            en_rango,
        )


async def seed_comedor_accesos_demo(
    *,
    total: int = DEFAULT_TOTAL,
    n_accedido: int | None = None,
    n_repetido: int | None = None,
    accedido_repetido: int | None = None,
    semanas: int = DEFAULT_SEMANAS,
    pasado: bool = False,
    dias_accedido_pasado: int = DEFAULT_DIAS_ACCEDIDO_PASADO,
    seed: int | None = 42,
) -> None:
    if seed is not None:
        random.seed(seed)

    hoy = date.today()
    if pasado:
        hasta = hoy - timedelta(days=1)
        desde = hasta - timedelta(days=7 * semanas - 1)
        if hasta < desde:
            raise ValueError("Rango pasado inválido; aumenta --semanas")
        boost_ref = hasta
    else:
        desde = hoy
        hasta = hoy + timedelta(days=7 * semanas - 1)
        boost_ref = hoy

    if accedido_repetido is not None:
        n_acc, n_rep = _split_accedido_repetido(accedido_repetido, n_accedido, n_repetido)
        n_pendiente_impl = total - accedido_repetido
    else:
        n_acc = n_accedido if n_accedido is not None else DEFAULT_ACCEDIDO
        n_rep = n_repetido if n_repetido is not None else DEFAULT_REPETIDO
        n_pendiente_impl = total - n_acc - n_rep
        if n_pendiente_impl < 0:
            raise ValueError("accedido + repetido supera --total")

    async with AsyncSessionLocal() as session:
        demos = await _find_demo_empleados(session)
        demo_ids = {e.id for e in demos}
        if demo_ids:
            raise RuntimeError(
                f"Existen {len(demo_ids)} empleado(s) demo de simulaciones anteriores. "
                "Ejecuta primero: python -m app.utils.seed_comedor_accesos_demo --cleanup --execute"
            )

        comedor = await _resolve_comedor(session)
        if pasado:
            dias_validacion = _date_range(desde, hasta)
            min_empleados = max(1, (total + len(dias_validacion) - 1) // max(1, len(dias_validacion)))
        else:
            dias_acc = _date_range(hoy - timedelta(days=dias_accedido_pasado), hoy)
            dias_fut = _date_range(desde, hasta)
            min_acc = max(1, (n_acc + len(dias_acc) - 1) // max(1, len(dias_acc)))
            min_otros = max(1, ((n_rep + n_pendiente_impl) + len(dias_fut) - 1) // max(1, len(dias_fut)))
            min_empleados = max(min_acc, min_otros)
        empleado_ids = await _load_active_empleado_ids(session, demo_ids=demo_ids)

        if not empleado_ids:
            raise InsufficientEmployeesError(
                "No hay empleados activos en la base de datos. "
                "La simulación se canceló sin insertar registros."
            )

        if len(empleado_ids) < min_empleados:
            raise InsufficientEmployeesError(
                f"Se requieren al menos {min_empleados} empleado(s) activo(s) para "
                f"generar {total} accesos en {len(dias)} día(s); hay {len(empleado_ids)} disponible(s). "
                "Reduce --total, amplía --semanas o agrega más empleados activos reales."
            )

        _assert_no_demo_empleados(empleado_ids, demo_ids)

        if pasado:
            pairs, hasta_efectivo = await _collect_pairs(session, empleado_ids, desde, hasta, total)
            estados = _assign_states(
                pairs,
                n_accedido=n_acc,
                n_repetido=n_rep,
                ref_date=boost_ref,
                boost_ref_accedido=True,
            )
        else:
            n_otros = n_rep + n_pendiente_impl
            desde_acc = hoy - timedelta(days=dias_accedido_pasado)
            pairs_acc, _ = await _collect_pairs(session, empleado_ids, desde_acc, hoy, n_acc)
            pairs_otros, hasta_efectivo = await _collect_pairs(
                session, empleado_ids, desde, hasta, n_otros
            )
            pairs = pairs_acc + pairs_otros
            estados_otros = (
                [ComedorAccesoEstado.REPETIDO] * n_rep
                + [ComedorAccesoEstado.PENDIENTE] * n_pendiente_impl
            )
            random.shuffle(estados_otros)
            estados = [ComedorAccesoEstado.ACCEDIDO] * n_acc + estados_otros
            desde = desde_acc
        registro_cache: dict[tuple[int, date], int] = {}
        now = datetime.now(timezone.utc)
        accesos: list[ComedorAcceso] = []

        for (empleado_id, fecha_servicio), estado in zip(pairs, estados, strict=True):
            if empleado_id not in empleado_ids:
                raise RuntimeError(f"empleado_id={empleado_id} no está en el pool activo validado")
            semana = _monday_of(fecha_servicio)
            registro_id = await _get_or_create_registro(
                session,
                registro_cache,
                empleado_id=empleado_id,
                comedor_id=comedor.id,
                semana=semana,
            )
            tipo = random.choice([ComedorTipoComida.casera, ComedorTipoComida.saludable])
            hora_entrada = now if estado == ComedorAccesoEstado.ACCEDIDO else None
            accesos.append(
                ComedorAcceso(
                    empleado_id=empleado_id,
                    comedor_id=comedor.id,
                    comedor_registro_id=registro_id,
                    fecha_servicio=fecha_servicio,
                    tipo_comida=tipo,
                    estado_acceso=estado,
                    hora_entrada=hora_entrada,
                )
            )

        session.add_all(accesos)
        await session.commit()

        counts: dict[str, int] = {}
        for e in estados:
            counts[e.value] = counts.get(e.value, 0) + 1

        empleados_usados = len({eid for eid, _ in pairs})
        fechas = [fd for _, fd in pairs]
        fecha_min = min(fechas).isoformat()
        fecha_max = max(fechas).isoformat()
        creados = len(accesos)

        modo = "pasado" if pasado else "futuro"
        logger.info("=== Resumen simulación comedor ===")
        logger.info("Registros solicitados: %s", total)
        logger.info("Registros creados:     %s", creados)
        logger.info("Empleados en pool:     %s (activos disponibles)", len(empleado_ids))
        logger.info("Empleados usados:      %s", empleados_usados)
        logger.info("Fecha mínima:          %s", fecha_min)
        logger.info("Fecha máxima:          %s", fecha_max)
        logger.info(
            "Detalle (%s) | comedor_id=%s | rango inicial %s → %s efectivo %s | estados %s",
            modo,
            comedor.id,
            desde.isoformat(),
            hasta.isoformat(),
            hasta_efectivo.isoformat(),
            counts,
        )
        if pasado:
            logger.info(
                "Gráfica asistencia diaria: el %% usa solo ACCEDIDO (%s). REPETIDO (%s) no suma en asistencias.",
                counts.get("ACCEDIDO", 0),
                counts.get("REPETIDO", 0),
            )
        else:
            logger.info(
                "Nota: REPETIDO no entra en futuros por semana (solo PENDIENTE/ACCEDIDO)."
            )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Simulación de accesos comedor (solo empleados activos existentes)"
    )
    parser.add_argument("--cleanup", action="store_true", help="Eliminar datos demo de simulaciones previas")
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Con --cleanup: aplicar borrado (sin esto solo muestra resumen)",
    )
    parser.add_argument("--total", type=int, default=DEFAULT_TOTAL)
    parser.add_argument("--accedido", type=int, default=None)
    parser.add_argument("--repetido", type=int, default=None)
    parser.add_argument("--accedido-repetido", type=int, default=None)
    parser.add_argument("--semanas", type=int, default=DEFAULT_SEMANAS)
    parser.add_argument("--pasado", action="store_true")
    parser.add_argument(
        "--dias-accedido",
        type=int,
        default=DEFAULT_DIAS_ACCEDIDO_PASADO,
        help="Días hacia atrás para fechas de ACCEDIDO (default 90, hasta hoy)",
    )
    parser.add_argument(
        "--reubicar-accedido",
        action="store_true",
        help="Mover accesos ACCEDIDO existentes al rango [hoy - dias-accedido, hoy]",
    )
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    if args.cleanup:
        asyncio.run(cleanup_comedor_demo_data(execute=args.execute))
        return

    if args.reubicar_accedido:
        asyncio.run(reubicar_accedidos_ultimos_dias(dias=args.dias_accedido))
        return

    n_acc = args.accedido
    n_rep = args.repetido
    if args.accedido_repetido is None and n_acc is None and n_rep is None:
        if args.total >= 600:
            n_acc = 600
            n_rep = min(DEFAULT_REPETIDO, max(0, args.total - n_acc))
        else:
            n_acc = DEFAULT_ACCEDIDO
            n_rep = DEFAULT_REPETIDO

    asyncio.run(
        seed_comedor_accesos_demo(
            total=args.total,
            n_accedido=n_acc,
            n_repetido=n_rep,
            accedido_repetido=args.accedido_repetido,
            semanas=args.semanas,
            pasado=args.pasado,
            dias_accedido_pasado=args.dias_accedido,
            seed=args.seed,
        )
    )


if __name__ == "__main__":
    main()

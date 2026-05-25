"""
Carga accesos de comedor de demostración (dashboard RH: asistencia diaria y semanas futuras).

Uso (Docker):
    # Futuro (default)
    docker-compose exec backend python -m app.utils.seed_comedor_accesos_demo

    # Pasado — gráfica de asistencia diaria (ej. 500 registros, 423 ACCEDIDO+REPETIDO)
    docker-compose exec backend python -m app.utils.seed_comedor_accesos_demo \\
      --pasado --total 500 --accedido-repetido 423 --semanas 12

Empleado×fecha únicos (uq). REPETIDO no suma en % asistencia del resumen (solo ACCEDIDO).
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import random
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select, text

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.comedor import (
    Comedor,
    ComedorAcceso,
    ComedorAccesoEstado,
    ComedorRegistro,
    ComedorTipoComida,
)
from app.models.empleados import Empleado
from app.models.roles import Rol

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

DEFAULT_TOTAL = 400
DEFAULT_ACCEDIDO = 100
DEFAULT_REPETIDO = 100
DEFAULT_SEMANAS = 3


def _monday_of(value: date) -> date:
    return value - timedelta(days=value.weekday())


def _date_range(desde: date, hasta: date) -> list[date]:
    out: list[date] = []
    cursor = desde
    while cursor <= hasta:
        out.append(cursor)
        cursor += timedelta(days=1)
    return out


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


async def _load_empleado_ids(session) -> list[int]:
    rows = (
        await session.execute(
            select(Empleado.id).where(Empleado.email.isnot(None)).order_by(Empleado.id.asc())
        )
    ).scalars()
    return list(rows.all())


async def _sync_empleados_id_sequence(session) -> None:
    await session.execute(
        text(
            "SELECT setval("
            "pg_get_serial_sequence('empleados', 'id'), "
            "COALESCE((SELECT MAX(id) FROM empleados), 1)"
            ")"
        )
    )


async def _ensure_empleados_para_demo(session, minimo: int) -> list[int]:
    """Garantiza al menos `minimo` empleados (crea demo si la BD tiene pocos)."""
    await _sync_empleados_id_sequence(session)
    ids = await _load_empleado_ids(session)
    if len(ids) >= minimo:
        return ids

    rol = (
        await session.execute(select(Rol).where(Rol.nombre == "empleado").limit(1))
    ).scalar_one_or_none()
    if not rol:
        raise RuntimeError("No existe rol 'empleado'. Ejecuta: docker-compose exec backend python -m app.utils.seed")

    faltan = minimo - len(ids)
    creados = 0
    base = 9_200_000
    while creados < faltan:
        uid = uuid.uuid4().hex[:8]
        email = f"comedor.demo.{uid}@leoni.test"
        dup = (
            await session.execute(select(Empleado.id).where(Empleado.email == email).limit(1))
        ).scalar_one_or_none()
        if dup:
            continue
        n = base + creados + len(ids)
        emp = Empleado(
            empleado_id=n,
            no_empleado=f"CDEMO-{uid}",
            nombre=f"DEMO COMEDOR, {uid}",
            email=email,
            usuario=f"comedor.demo.{uid}",
            password_hash=hash_password("DemoComedor1!"),
            rol_id=rol.id,
            estado_id=1,
        )
        session.add(emp)
        await session.flush()
        creados += 1
    await session.execute(
        text("SELECT setval(pg_get_serial_sequence('empleados', 'id'), COALESCE((SELECT MAX(id) FROM empleados), 1))")
    )
    logger.info("Creados %s empleados demo para comedor", creados)
    return await _load_empleado_ids(session)


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
    """Reparte el cupo ACCEDIDO+REPETIDO; prioriza ACCEDIDO para la gráfica de asistencia."""
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
) -> tuple[list[tuple[int, date]], list[int], date]:
    """Arma hasta `total` pares libres; extiende rango o empleados si hace falta."""
    dias = _date_range(desde, hasta)
    empleado_ids = list(empleado_ids)
    fin = hasta
    while True:
        ocupados = await _existing_pairs(session, desde, fin)
        candidatos = [
            (eid, fd) for eid in empleado_ids for fd in dias if (eid, fd) not in ocupados
        ]
        if len(candidatos) >= total:
            random.shuffle(candidatos)
            return candidatos[:total], empleado_ids, fin
        fin = fin + timedelta(days=7)
        dias = _date_range(desde, fin)
        min_emp = (total + len(dias) - 1) // max(1, len(dias))
        if len(empleado_ids) < min_emp:
            empleado_ids = await _ensure_empleados_para_demo(session, min_emp)


async def seed_comedor_accesos_demo(
    *,
    total: int = DEFAULT_TOTAL,
    n_accedido: int | None = None,
    n_repetido: int | None = None,
    accedido_repetido: int | None = None,
    semanas: int = DEFAULT_SEMANAS,
    pasado: bool = False,
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
        comedor = await _resolve_comedor(session)
        dias = _date_range(desde, hasta)
        min_empleados = max(25, (total + len(dias) - 1) // max(1, len(dias)))
        empleado_ids = await _ensure_empleados_para_demo(session, min_empleados)

        pairs, empleado_ids, hasta_efectivo = await _collect_pairs(
            session, empleado_ids, desde, hasta, total
        )
        estados = _assign_states(
            pairs,
            n_accedido=n_acc,
            n_repetido=n_rep,
            ref_date=boost_ref,
            boost_ref_accedido=True,
        )
        registro_cache: dict[tuple[int, date], int] = {}
        now = datetime.now(timezone.utc)
        accesos: list[ComedorAcceso] = []

        for (empleado_id, fecha_servicio), estado in zip(pairs, estados, strict=True):
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

        modo = "pasado" if pasado else "futuro"
        logger.info(
            "Insertados %s accesos (%s) | comedor_id=%s | %s → %s | estados %s",
            len(accesos),
            modo,
            comedor.id,
            desde.isoformat(),
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
    parser = argparse.ArgumentParser(description="Seed de accesos comedor para pruebas de dashboard")
    parser.add_argument("--total", type=int, default=DEFAULT_TOTAL)
    parser.add_argument("--accedido", type=int, default=None, help="Cantidad ACCEDIDO (opcional con --accedido-repetido)")
    parser.add_argument("--repetido", type=int, default=None, help="Cantidad REPETIDO (opcional con --accedido-repetido)")
    parser.add_argument(
        "--accedido-repetido",
        type=int,
        default=None,
        help="Total ACCEDIDO+REPETIDO; el resto queda PENDIENTE",
    )
    parser.add_argument("--semanas", type=int, default=DEFAULT_SEMANAS)
    parser.add_argument(
        "--pasado",
        action="store_true",
        help="Rango en semanas pasadas (hasta ayer); para gráfica de asistencia diaria",
    )
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    n_acc = args.accedido
    n_rep = args.repetido
    if args.accedido_repetido is None and n_acc is None and n_rep is None:
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
            seed=args.seed,
        )
    )


if __name__ == "__main__":
    main()

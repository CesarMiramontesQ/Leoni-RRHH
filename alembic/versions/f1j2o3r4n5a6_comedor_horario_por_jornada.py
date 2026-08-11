"""Ajustes Comedor: ventana de comida por jornada, no por turno

Un turno rotativo no tiene una sola jornada: G9 recorre un ciclo de 56 días que pasa por
7 jornadas distintas. La tabla anterior, ``levelup_comedor_horarios_turno``, tenía
``UNIQUE(tu_codigo)``, así que le asignaba la misma hora de comida al día que la persona
entra 06:00 y al día que entra 22:00. Esta migración mueve la configuración a la jornada
(``dbo.HORARIO`` de TRESS), que es de lo que sí depende la hora de comer.

Crea:
  - ``levelup_horarios``: caché del catálogo de jornadas de TRESS.
  - ``levelup_comedor_horarios_jornada``: la ventana de comida, una por jornada.
  - ``levelup_turnos_empleados.tu_codigo`` / ``.activo`` / ``.sincronizado_en``, para que
    el turno del empleado quede ligado al catálogo y la rotación sea calculable.

Arrastra la configuración previa **solo desde turnos con una única jornada laborable**,
donde el traspaso es inequívoco. Un turno rotativo tenía una sola ventana para mañana,
tarde y noche: propagarla a las tres sembraría datos absurdos ("comer a las 12:00" en la
jornada de 22:00-06:00) que además figurarían como ya configurados y nadie revisaría.
Esas jornadas se dejan sin configurar a propósito, para que RH las capture en la pantalla
nueva. Ante conflicto entre dos turnos gana el que tiene más personal. Después se elimina
la tabla vieja para dejar una sola fuente de verdad.

Revision ID: f1j2o3r4n5a6
Revises: e1t2u3r4u5s6
Create Date: 2026-08-11

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.utils.migration_helpers import column_names, table_exists

revision: str = "f1j2o3r4n5a6"
down_revision: Union[str, None] = "e1t2u3r4u5s6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _jornadas_laborables_del_turno(fila) -> set[str]:
    """Códigos de jornada que el turno usa en días laborables.

    Reutiliza ``expandir_patron_rotativo`` para no duplicar la semántica del ritmo. Si el
    patrón no se puede expandir (hay turnos con tokens no numéricos, p. ej. ``2:03S``),
    devuelve vacío: es preferible no arrastrar el dato a arrastrarlo mal.
    """
    from app.utils.turno_calendario import expandir_patron_rotativo, normalizar_codigo

    hors = [normalizar_codigo(getattr(fila, f"tu_hor_{i}")) for i in range(1, 8)]
    tips = [getattr(fila, f"tu_tip_{i}") for i in range(1, 8)]
    patron = (fila.tu_rit_pat or "").strip()

    if not patron:
        return {h for h, t in zip(hors, tips) if h and t != 2}

    try:
        ciclo = expandir_patron_rotativo(
            fila.tu_rit_pat or "", horario1=hors[0], horario2=hors[1], horario3=hors[2]
        )
    except ValueError:
        return set()
    return {d.codigo_horario for d in ciclo if d.tipo_dia != 2 and d.codigo_horario}


def _arrastrar_configuracion_previa() -> None:
    if not table_exists("levelup_comedor_horarios_turno"):
        return

    bind = op.get_bind()
    # Los turnos con más personal se procesan primero para que ganen los conflictos:
    # si dos turnos comparten una jornada con ventanas distintas, prevalece el que
    # afecta a más gente. LEFT JOIN porque la caché de uso puede no haber corrido.
    filas = bind.execute(
        sa.text(
            """
            SELECT h.hora_inicio_comida, h.hora_fin_comida, h.actualizado_por_empleado_id,
                   t.tu_rit_pat, t.tu_tip_1, t.tu_tip_2, t.tu_tip_3, t.tu_tip_4,
                   t.tu_tip_5, t.tu_tip_6, t.tu_tip_7,
                   t.tu_hor_1, t.tu_hor_2, t.tu_hor_3, t.tu_hor_4,
                   t.tu_hor_5, t.tu_hor_6, t.tu_hor_7
            FROM levelup_comedor_horarios_turno h
            JOIN levelup_turnos t ON rtrim(t.tu_codigo) = rtrim(h.tu_codigo)
            LEFT JOIN levelup_turnos_uso u ON u.tu_codigo = rtrim(t.tu_codigo)
            ORDER BY COALESCE(u.empleados_activos, 0) DESC, rtrim(t.tu_codigo)
            """
        )
    ).fetchall()

    ya_configuradas: set[str] = set()
    for fila in filas:
        jornadas = _jornadas_laborables_del_turno(fila)
        # Solo se arrastra cuando el turno usa una única jornada laborable. Con dos o
        # más no hay forma de saber a cuál correspondía la ventana capturada, y adivinar
        # dejaría horas de comida falsas marcadas como configuradas.
        if len(jornadas) != 1:
            continue
        for ho_codigo in sorted(jornadas):
            if ho_codigo in ya_configuradas:
                continue
            ya_configuradas.add(ho_codigo)
            # La jornada tiene que existir para que la FK case; el sync del catálogo
            # rellenará después descripción y horas de entrada/salida.
            bind.execute(
                sa.text(
                    "INSERT INTO levelup_horarios (ho_codigo, ho_descrip, ho_activo) "
                    "VALUES (:c, '', 'S') ON CONFLICT (ho_codigo) DO NOTHING"
                ),
                {"c": ho_codigo},
            )
            bind.execute(
                sa.text(
                    """
                    INSERT INTO levelup_comedor_horarios_jornada
                        (ho_codigo, hora_inicio_comida, hora_fin_comida,
                         actualizado_por_empleado_id)
                    VALUES (:c, :ini, :fin, :emp)
                    ON CONFLICT (ho_codigo) DO NOTHING
                    """
                ),
                {
                    "c": ho_codigo,
                    "ini": fila.hora_inicio_comida,
                    "fin": fila.hora_fin_comida,
                    "emp": fila.actualizado_por_empleado_id,
                },
            )


def upgrade() -> None:
    if not table_exists("levelup_horarios"):
        op.create_table(
            "levelup_horarios",
            sa.Column("ho_codigo", sa.String(6), nullable=False),
            sa.Column("ho_descrip", sa.String(100), nullable=False, server_default=""),
            sa.Column("ho_intime", sa.String(4), nullable=True),
            sa.Column("ho_outtime", sa.String(4), nullable=True),
            sa.Column("ho_jornada", sa.Numeric(15, 2), nullable=True),
            sa.Column("ho_activo", sa.String(1), nullable=False, server_default="S"),
            sa.Column(
                "sincronizado_en",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.PrimaryKeyConstraint("ho_codigo", name="pk_levelup_horarios"),
        )

    if not table_exists("levelup_comedor_horarios_jornada"):
        op.create_table(
            "levelup_comedor_horarios_jornada",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("ho_codigo", sa.String(6), nullable=False),
            sa.Column("hora_inicio_comida", sa.Time(), nullable=False),
            sa.Column("hora_fin_comida", sa.Time(), nullable=False),
            sa.Column("actualizado_por_empleado_id", sa.Integer(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.PrimaryKeyConstraint("id", name="pk_levelup_comedor_horarios_jornada"),
            sa.UniqueConstraint(
                "ho_codigo", name="uq_levelup_comedor_horarios_jornada_ho_codigo"
            ),
            # A diferencia de la tabla que sustituye, NO se exige inicio < fin: la
            # jornada 011 es 18:00-06:00 y su comida cruza medianoche. Solo se prohíbe
            # una ventana de duración cero.
            sa.CheckConstraint(
                "hora_inicio_comida <> hora_fin_comida",
                name="ck_levelup_comedor_horarios_jornada_rango",
            ),
            sa.ForeignKeyConstraint(
                ["ho_codigo"],
                ["levelup_horarios.ho_codigo"],
                name="fk_levelup_comedor_horarios_jornada_ho_codigo",
                ondelete="CASCADE",
            ),
            sa.ForeignKeyConstraint(
                ["actualizado_por_empleado_id"],
                ["empleados.empleado_id"],
                name="fk_levelup_comedor_horarios_jornada_empleado",
                ondelete="SET NULL",
            ),
        )

    columnas = column_names("levelup_turnos_empleados")
    if "tu_codigo" not in columnas:
        op.add_column(
            "levelup_turnos_empleados", sa.Column("tu_codigo", sa.String(6), nullable=True)
        )
    if "activo" not in columnas:
        op.add_column(
            "levelup_turnos_empleados",
            sa.Column(
                "activo", sa.Boolean(), nullable=False, server_default=sa.text("true")
            ),
        )
    if "sincronizado_en" not in columnas:
        op.add_column(
            "levelup_turnos_empleados",
            sa.Column("sincronizado_en", sa.DateTime(timezone=True), nullable=True),
        )

    _arrastrar_configuracion_previa()

    if table_exists("levelup_comedor_horarios_turno"):
        op.drop_table("levelup_comedor_horarios_turno")


def downgrade() -> None:
    if not table_exists("levelup_comedor_horarios_turno"):
        op.create_table(
            "levelup_comedor_horarios_turno",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("tu_codigo", sa.CHAR(6), nullable=False),
            sa.Column("hora_inicio_comida", sa.Time(), nullable=False),
            sa.Column("hora_fin_comida", sa.Time(), nullable=False),
            sa.Column("actualizado_por_empleado_id", sa.Integer(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.PrimaryKeyConstraint("id", name="pk_levelup_comedor_horarios_turno"),
            sa.UniqueConstraint(
                "tu_codigo", name="uq_levelup_comedor_horarios_turno_tu_codigo"
            ),
            sa.CheckConstraint(
                "hora_inicio_comida < hora_fin_comida",
                name="ck_levelup_comedor_horarios_turno_rango",
            ),
            sa.ForeignKeyConstraint(
                ["tu_codigo"], ["levelup_turnos.tu_codigo"], ondelete="CASCADE"
            ),
            sa.ForeignKeyConstraint(
                ["actualizado_por_empleado_id"],
                ["empleados.empleado_id"],
                ondelete="SET NULL",
            ),
        )

    columnas = column_names("levelup_turnos_empleados")
    for col in ("sincronizado_en", "activo", "tu_codigo"):
        if col in columnas:
            op.drop_column("levelup_turnos_empleados", col)

    if table_exists("levelup_comedor_horarios_jornada"):
        op.drop_table("levelup_comedor_horarios_jornada")
    if table_exists("levelup_horarios"):
        op.drop_table("levelup_horarios")

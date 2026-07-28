"""clasificacion de puestos (willis towers watson)

Revision ID: w1t2w3c4l5a6
Revises: d1r2o3p4t5i6
Create Date: 2026-07-27

Contexto: Leoni clasifica sus puestos con la metodologia Willis Towers Watson
(Career Path + Funcion + Disciplina + Career Level). La evaluacion se hace fuera
del sistema; aqui solo se registra y administra el resultado.

El modelo actual no lo soporta: `levelup_grados_puesto` es un catalogo plano con
`nombre` y `orden` unicos GLOBALMENTE, asi que P1 y M1 no pueden coexistir.

Esta migracion:
  1. crea los catalogos `levelup_career_paths`, `levelup_funciones_puesto`,
     `levelup_disciplinas_puesto`, `levelup_categorias_tarea` y la bitacora
     `levelup_puesto_perfil_clasificacion_historial`,
  2. convierte `levelup_grados_puesto` en el Career Level: agrega `career_path_id`
     y `codigo`, cambia la unicidad de global a "por career path" y hace backfill
     de todo lo existente a Professional con codigo P<orden> (los `id` no cambian,
     asi que ninguna FK se rompe),
  3. agrega la clasificacion y el `estado` a `levelup_puestos_perfil`,
  4. le da `codigo` a `levelup_grupos_competencia` (que pasa a ser la categoria
     oficial de competencia) y siembra Liderazgo y Digitales,
  5. agrega `evidencia` a los requisitos de competencia y
     categoria/prioridad/frecuencia/% de dedicacion a las tareas del perfil.

Idempotente: cada paso comprueba antes si la tabla, columna o constraint ya existe.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

from app.utils.competencia_categoria import (
    categoria_desde_grupo_nombre,
    slug_codigo_grupo,
)
from app.utils.seed_clasificacion_puesto import (
    CAREER_PATH_DEFAULT_CODIGO,
    CAREER_PATHS_SEED,
    DISCIPLINAS_SEED,
    FUNCIONES_SEED,
    GRUPOS_COMPETENCIA_NUEVOS_SEED,
)

revision: str = "w1t2w3c4l5a6"
down_revision: Union[str, None] = "d1r2o3p4t5i6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

T_CAREER_PATHS = "levelup_career_paths"
T_FUNCIONES = "levelup_funciones_puesto"
T_DISCIPLINAS = "levelup_disciplinas_puesto"
T_CATEGORIAS_TAREA = "levelup_categorias_tarea"
T_HISTORIAL = "levelup_puesto_perfil_clasificacion_historial"
T_GRADOS = "levelup_grados_puesto"
T_PERFILES = "levelup_puestos_perfil"
T_GRUPOS = "levelup_grupos_competencia"
T_COMPETENCIAS = "levelup_competencias"
T_REQUISITOS = "levelup_competencia_requisitos"
T_TAREAS_CATALOGO = "levelup_tareas_catalogo"
T_PERFIL_TAREAS = "levelup_perfil_tareas"

UQ_GRADO_NOMBRE = "uq_levelup_grados_puesto_nombre"
UQ_GRADO_ORDEN = "uq_levelup_grados_puesto_orden"
UQ_GRADO_PATH_CODIGO = "uq_levelup_grados_puesto_path_codigo"
UQ_GRADO_PATH_ORDEN = "uq_levelup_grados_puesto_path_orden"
UQ_GRADO_PATH_NOMBRE = "uq_levelup_grados_puesto_path_nombre"
CK_PERFIL_ESTADO = "ck_levelup_puestos_perfil_estado"
CK_TAREA_PORCENTAJE = "ck_levelup_perfil_tareas_porcentaje"
CK_TAREA_PRIORIDAD = "ck_levelup_perfil_tareas_prioridad"
CK_TAREA_FRECUENCIA = "ck_levelup_perfil_tareas_frecuencia"
UQ_GRUPO_CODIGO = "uq_levelup_grupos_competencia_codigo"


# ── Helpers de introspeccion ─────────────────────────────────────────────────


def _has_table(table: str) -> bool:
    return inspect(op.get_bind()).has_table(table)


def _columns(table: str) -> set[str]:
    inspector = inspect(op.get_bind())
    if not inspector.has_table(table):
        return set()
    return {col["name"] for col in inspector.get_columns(table)}


def _constraints(table: str) -> set[str]:
    inspector = inspect(op.get_bind())
    if not inspector.has_table(table):
        return set()
    nombres = {c["name"] for c in inspector.get_unique_constraints(table) if c["name"]}
    nombres |= {c["name"] for c in inspector.get_check_constraints(table) if c["name"]}
    return nombres


def _uniques_sobre(table: str, columna: str) -> list[str]:
    """
    Nombres de las uniques de UNA sola columna sobre `columna`.

    Hay que buscarlas por columna y no por nombre: segun como se haya construido la
    BD, la misma constraint se llama `uq_levelup_grados_puesto_orden` (creada por una
    migracion con `op.create_unique_constraint`) o `levelup_grados_puesto_orden_key`
    (autogenerada por el `create_all` de la baseline `v1l2u3p0base`, que es el camino
    de la BD Bono).
    """
    inspector = inspect(op.get_bind())
    if not inspector.has_table(table):
        return []
    return [
        c["name"]
        for c in inspector.get_unique_constraints(table)
        if c["name"] and list(c["column_names"]) == [columna]
    ]


def _foreign_keys(table: str) -> set[str]:
    inspector = inspect(op.get_bind())
    if not inspector.has_table(table):
        return set()
    return {fk["name"] for fk in inspector.get_foreign_keys(table) if fk["name"]}


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    ]


# ── 1. Catalogos nuevos ──────────────────────────────────────────────────────


def _crear_catalogos() -> None:
    if not _has_table(T_CAREER_PATHS):
        op.create_table(
            T_CAREER_PATHS,
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("codigo", sa.String(length=10), nullable=False),
            sa.Column("nombre", sa.String(length=100), nullable=False),
            sa.Column("orden", sa.Integer(), nullable=False),
            sa.Column(
                "activo", sa.Boolean(), nullable=False, server_default=sa.text("true")
            ),
            *_timestamps(),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("codigo"),
            sa.UniqueConstraint("nombre"),
            sa.UniqueConstraint("orden"),
        )

    if not _has_table(T_FUNCIONES):
        op.create_table(
            T_FUNCIONES,
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("codigo", sa.String(length=20), nullable=False),
            sa.Column("nombre", sa.String(length=100), nullable=False),
            sa.Column(
                "activo", sa.Boolean(), nullable=False, server_default=sa.text("true")
            ),
            *_timestamps(),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("codigo"),
            sa.UniqueConstraint("nombre"),
        )

    if not _has_table(T_DISCIPLINAS):
        op.create_table(
            T_DISCIPLINAS,
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("funcion_id", sa.Integer(), nullable=False),
            sa.Column("codigo", sa.String(length=20), nullable=True),
            sa.Column("nombre", sa.String(length=100), nullable=False),
            sa.Column(
                "activo", sa.Boolean(), nullable=False, server_default=sa.text("true")
            ),
            *_timestamps(),
            sa.PrimaryKeyConstraint("id"),
            sa.ForeignKeyConstraint(["funcion_id"], [f"{T_FUNCIONES}.id"]),
            sa.UniqueConstraint(
                "funcion_id", "nombre", name="uq_levelup_disciplina_funcion_nombre"
            ),
        )

    if not _has_table(T_CATEGORIAS_TAREA):
        op.create_table(
            T_CATEGORIAS_TAREA,
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("nombre", sa.String(length=100), nullable=False),
            sa.Column(
                "activo", sa.Boolean(), nullable=False, server_default=sa.text("true")
            ),
            *_timestamps(),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("nombre"),
        )

    if not _has_table(T_HISTORIAL):
        op.create_table(
            T_HISTORIAL,
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("puesto_perfil_id", sa.Integer(), nullable=False),
            sa.Column("career_path_id", sa.Integer(), nullable=True),
            sa.Column("funcion_id", sa.Integer(), nullable=True),
            sa.Column("disciplina_id", sa.Integer(), nullable=True),
            sa.Column("global_level_desde_id", sa.Integer(), nullable=True),
            sa.Column("global_level_hasta_id", sa.Integer(), nullable=True),
            sa.Column(
                "estado",
                sa.String(length=20),
                nullable=True,
                comment="activo|inactivo|en_revision",
            ),
            sa.Column("version", sa.Integer(), nullable=True),
            sa.Column("motivo", sa.Text(), nullable=True),
            sa.Column("changed_by", sa.Integer(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.ForeignKeyConstraint(
                ["puesto_perfil_id"], [f"{T_PERFILES}.id"], ondelete="CASCADE"
            ),
            sa.ForeignKeyConstraint(["career_path_id"], [f"{T_CAREER_PATHS}.id"]),
            sa.ForeignKeyConstraint(["funcion_id"], [f"{T_FUNCIONES}.id"]),
            sa.ForeignKeyConstraint(["disciplina_id"], [f"{T_DISCIPLINAS}.id"]),
            sa.ForeignKeyConstraint(["global_level_desde_id"], [f"{T_GRADOS}.id"]),
            sa.ForeignKeyConstraint(["global_level_hasta_id"], [f"{T_GRADOS}.id"]),
            sa.ForeignKeyConstraint(["changed_by"], ["empleados.empleado_id"]),
        )
        op.create_index(
            "ix_levelup_clasificacion_historial_perfil",
            T_HISTORIAL,
            ["puesto_perfil_id", "created_at"],
        )


def _sembrar_catalogos() -> dict[str, int]:
    """Siembra career paths, funciones y disciplinas. Devuelve {codigo: id} de paths."""
    bind = op.get_bind()

    for cp in CAREER_PATHS_SEED:
        existe = bind.execute(
            sa.text(f"SELECT id FROM {T_CAREER_PATHS} WHERE codigo = :codigo"),
            {"codigo": cp["codigo"]},
        ).scalar()
        if existe is None:
            bind.execute(
                sa.text(
                    f"INSERT INTO {T_CAREER_PATHS} (codigo, nombre, orden, activo) "
                    "VALUES (:codigo, :nombre, :orden, true)"
                ),
                cp,
            )

    for fn in FUNCIONES_SEED:
        existe = bind.execute(
            sa.text(f"SELECT id FROM {T_FUNCIONES} WHERE codigo = :codigo"),
            {"codigo": fn["codigo"]},
        ).scalar()
        if existe is None:
            bind.execute(
                sa.text(
                    f"INSERT INTO {T_FUNCIONES} (codigo, nombre, activo) "
                    "VALUES (:codigo, :nombre, true)"
                ),
                fn,
            )

    funciones = {
        row[0]: row[1]
        for row in bind.execute(sa.text(f"SELECT codigo, id FROM {T_FUNCIONES}")).all()
    }
    for funcion_codigo, disciplinas in DISCIPLINAS_SEED.items():
        funcion_id = funciones.get(funcion_codigo)
        if funcion_id is None:
            continue
        for nombre in disciplinas:
            existe = bind.execute(
                sa.text(
                    f"SELECT id FROM {T_DISCIPLINAS} "
                    "WHERE funcion_id = :funcion_id AND nombre = :nombre"
                ),
                {"funcion_id": funcion_id, "nombre": nombre},
            ).scalar()
            if existe is None:
                bind.execute(
                    sa.text(
                        f"INSERT INTO {T_DISCIPLINAS} (funcion_id, nombre, activo) "
                        "VALUES (:funcion_id, :nombre, true)"
                    ),
                    {"funcion_id": funcion_id, "nombre": nombre},
                )

    return {
        row[0]: row[1]
        for row in bind.execute(
            sa.text(f"SELECT codigo, id FROM {T_CAREER_PATHS}")
        ).all()
    }


# ── 2. Grados de puesto -> Career Level ──────────────────────────────────────


def _migrar_grados(career_paths: dict[str, int]) -> None:
    bind = op.get_bind()
    columnas = _columns(T_GRADOS)

    if "career_path_id" not in columnas:
        op.add_column(T_GRADOS, sa.Column("career_path_id", sa.Integer(), nullable=True))
    if "codigo" not in columnas:
        op.add_column(T_GRADOS, sa.Column("codigo", sa.String(length=10), nullable=True))

    default_id = career_paths.get(CAREER_PATH_DEFAULT_CODIGO)
    if default_id is None:
        raise RuntimeError(
            f"No se pudo sembrar el career path '{CAREER_PATH_DEFAULT_CODIGO}'; "
            "no hay a donde migrar los grados existentes."
        )

    # Todo grado previo a WTW pertenece a Professional: su codigo es P<orden>.
    bind.execute(
        sa.text(
            f"UPDATE {T_GRADOS} SET career_path_id = :cp WHERE career_path_id IS NULL"
        ),
        {"cp": default_id},
    )
    bind.execute(
        sa.text(
            f"UPDATE {T_GRADOS} g SET codigo = cp.codigo || g.orden::text "
            f"FROM {T_CAREER_PATHS} cp "
            "WHERE cp.id = g.career_path_id AND g.codigo IS NULL"
        )
    )

    # La unicidad pasa de global a "dentro del career path": sin esto, P1 y M1 no
    # pueden coexistir porque `orden` sigue siendo unico en toda la tabla.
    for columna in ("nombre", "orden"):
        for nombre in _uniques_sobre(T_GRADOS, columna):
            op.drop_constraint(nombre, T_GRADOS, type_="unique")

    op.alter_column(T_GRADOS, "career_path_id", nullable=False)
    op.alter_column(T_GRADOS, "codigo", nullable=False)
    if "fk_levelup_grados_puesto_career_path" not in _foreign_keys(T_GRADOS):
        op.create_foreign_key(
            "fk_levelup_grados_puesto_career_path",
            T_GRADOS,
            T_CAREER_PATHS,
            ["career_path_id"],
            ["id"],
        )

    existentes = _constraints(T_GRADOS)
    if UQ_GRADO_PATH_CODIGO not in existentes:
        op.create_unique_constraint(
            UQ_GRADO_PATH_CODIGO, T_GRADOS, ["career_path_id", "codigo"]
        )
    if UQ_GRADO_PATH_ORDEN not in existentes:
        op.create_unique_constraint(
            UQ_GRADO_PATH_ORDEN, T_GRADOS, ["career_path_id", "orden"]
        )
    if UQ_GRADO_PATH_NOMBRE not in existentes:
        op.create_unique_constraint(
            UQ_GRADO_PATH_NOMBRE, T_GRADOS, ["career_path_id", "nombre"]
        )


# ── 3. Clasificacion y estado del perfil ─────────────────────────────────────


def _migrar_perfiles() -> None:
    bind = op.get_bind()
    columnas = _columns(T_PERFILES)

    if "career_path_id" not in columnas:
        op.add_column(
            T_PERFILES, sa.Column("career_path_id", sa.Integer(), nullable=True)
        )
        op.create_foreign_key(
            "fk_levelup_puestos_perfil_career_path",
            T_PERFILES,
            T_CAREER_PATHS,
            ["career_path_id"],
            ["id"],
        )
    if "funcion_id" not in columnas:
        op.add_column(T_PERFILES, sa.Column("funcion_id", sa.Integer(), nullable=True))
        op.create_foreign_key(
            "fk_levelup_puestos_perfil_funcion",
            T_PERFILES,
            T_FUNCIONES,
            ["funcion_id"],
            ["id"],
        )
    if "disciplina_id" not in columnas:
        op.add_column(
            T_PERFILES, sa.Column("disciplina_id", sa.Integer(), nullable=True)
        )
        op.create_foreign_key(
            "fk_levelup_puestos_perfil_disciplina",
            T_PERFILES,
            T_DISCIPLINAS,
            ["disciplina_id"],
            ["id"],
        )

    if "estado" not in columnas:
        op.add_column(
            T_PERFILES,
            sa.Column(
                "estado",
                sa.String(length=20),
                nullable=False,
                server_default="activo",
                comment="activo|inactivo|en_revision",
            ),
        )
        # `activo` sigue siendo el soft-delete: el estado arranca alineado con el.
        bind.execute(
            sa.text(
                f"UPDATE {T_PERFILES} SET estado = "
                "CASE WHEN activo THEN 'activo' ELSE 'inactivo' END"
            )
        )

    if CK_PERFIL_ESTADO not in _constraints(T_PERFILES):
        op.create_check_constraint(
            CK_PERFIL_ESTADO,
            T_PERFILES,
            "estado IN ('activo', 'inactivo', 'en_revision')",
        )


# ── 4. Grupos de competencia = categorias ────────────────────────────────────


def _migrar_grupos_competencia() -> None:
    bind = op.get_bind()

    if "codigo" not in _columns(T_GRUPOS):
        op.add_column(T_GRUPOS, sa.Column("codigo", sa.String(length=30), nullable=True))

    # Backfill: los dos grupos historicos conservan 'tecnica'/'blanda' para que los
    # valores ya guardados en levelup_competencias.categoria sigan siendo validos.
    filas = bind.execute(
        sa.text(f"SELECT id, nombre FROM {T_GRUPOS} WHERE codigo IS NULL ORDER BY id")
    ).all()
    usados = {
        row[0]
        for row in bind.execute(
            sa.text(f"SELECT codigo FROM {T_GRUPOS} WHERE codigo IS NOT NULL")
        ).all()
    }
    for grupo_id, nombre in filas:
        base = slug_codigo_grupo(nombre)
        codigo = base
        sufijo = 2
        while codigo in usados:
            codigo = f"{base[:27]}-{sufijo}"
            sufijo += 1
        usados.add(codigo)
        bind.execute(
            sa.text(f"UPDATE {T_GRUPOS} SET codigo = :codigo WHERE id = :id"),
            {"codigo": codigo, "id": grupo_id},
        )

    for grupo in GRUPOS_COMPETENCIA_NUEVOS_SEED:
        # Por nombre Y por codigo: el nombre tambien es unico, y la categoria puede
        # existir ya con el codigo puesto por el backfill.
        existe = bind.execute(
            sa.text(
                f"SELECT id FROM {T_GRUPOS} WHERE codigo = :codigo OR nombre = :nombre"
            ),
            grupo,
        ).scalar()
        if existe is None:
            bind.execute(
                sa.text(
                    f"INSERT INTO {T_GRUPOS} (nombre, codigo, activo) "
                    "VALUES (:nombre, :codigo, true)"
                ),
                grupo,
            )

    op.alter_column(T_GRUPOS, "codigo", nullable=False)
    if UQ_GRUPO_CODIGO not in _constraints(T_GRUPOS):
        op.create_unique_constraint(UQ_GRUPO_CODIGO, T_GRUPOS, ["codigo"])

    # La categoria de la competencia pasa a ser el codigo del grupo, sin adivinar
    # por el nombre (antes cualquier grupo nuevo caia en "blanda").
    op.alter_column(
        T_COMPETENCIAS,
        "categoria",
        existing_type=sa.String(length=20),
        type_=sa.String(length=30),
        existing_nullable=False,
    )
    bind.execute(
        sa.text(
            f"UPDATE {T_COMPETENCIAS} c SET categoria = g.codigo "
            f"FROM levelup_tipos_competencia t "
            f"JOIN {T_GRUPOS} g ON g.id = t.grupo_competencia_id "
            "WHERE t.id = c.tipo_competencia_id AND c.categoria IS DISTINCT FROM g.codigo"
        )
    )


# ── 5. Competencias y tareas del perfil ──────────────────────────────────────


def _migrar_requisitos_y_tareas() -> None:
    bind = op.get_bind()

    if "evidencia" not in _columns(T_REQUISITOS):
        op.add_column(
            T_REQUISITOS,
            sa.Column(
                "evidencia",
                sa.Text(),
                nullable=True,
                comment=(
                    "Evidencia opcional que acredita el nivel requerido en este puesto"
                ),
            ),
        )

    if "categoria_tarea_id" not in _columns(T_TAREAS_CATALOGO):
        op.add_column(
            T_TAREAS_CATALOGO,
            sa.Column("categoria_tarea_id", sa.Integer(), nullable=True),
        )
        op.create_foreign_key(
            "fk_levelup_tareas_catalogo_categoria",
            T_TAREAS_CATALOGO,
            T_CATEGORIAS_TAREA,
            ["categoria_tarea_id"],
            ["id"],
        )
        # El texto libre existente se convierte en catalogo (se conserva la columna).
        bind.execute(
            sa.text(
                f"""
                INSERT INTO {T_CATEGORIAS_TAREA} (nombre, activo)
                SELECT d.nombre, true
                FROM (
                    SELECT DISTINCT TRIM(categoria) AS nombre
                    FROM {T_TAREAS_CATALOGO}
                    WHERE categoria IS NOT NULL AND TRIM(categoria) <> ''
                ) d
                WHERE NOT EXISTS (
                    SELECT 1 FROM {T_CATEGORIAS_TAREA} c WHERE c.nombre = d.nombre
                )
                """
            )
        )
        bind.execute(
            sa.text(
                f"UPDATE {T_TAREAS_CATALOGO} t SET categoria_tarea_id = c.id "
                f"FROM {T_CATEGORIAS_TAREA} c "
                "WHERE c.nombre = TRIM(t.categoria) AND t.categoria_tarea_id IS NULL"
            )
        )

    columnas_perfil_tareas = _columns(T_PERFIL_TAREAS)
    if "categoria_tarea_id" not in columnas_perfil_tareas:
        op.add_column(
            T_PERFIL_TAREAS,
            sa.Column("categoria_tarea_id", sa.Integer(), nullable=True),
        )
        op.create_foreign_key(
            "fk_levelup_perfil_tareas_categoria",
            T_PERFIL_TAREAS,
            T_CATEGORIAS_TAREA,
            ["categoria_tarea_id"],
            ["id"],
        )
    if "prioridad" not in columnas_perfil_tareas:
        op.add_column(
            T_PERFIL_TAREAS,
            sa.Column(
                "prioridad",
                sa.String(length=10),
                nullable=True,
                comment="alta|media|baja",
            ),
        )
    if "frecuencia" not in columnas_perfil_tareas:
        op.add_column(
            T_PERFIL_TAREAS,
            sa.Column(
                "frecuencia",
                sa.String(length=20),
                nullable=True,
                comment="diaria|semanal|mensual|trimestral|anual|eventual",
            ),
        )
    if "porcentaje_dedicacion" not in columnas_perfil_tareas:
        op.add_column(
            T_PERFIL_TAREAS,
            sa.Column("porcentaje_dedicacion", sa.SmallInteger(), nullable=True),
        )

    existentes = _constraints(T_PERFIL_TAREAS)
    if CK_TAREA_PORCENTAJE not in existentes:
        op.create_check_constraint(
            CK_TAREA_PORCENTAJE,
            T_PERFIL_TAREAS,
            "porcentaje_dedicacion IS NULL "
            "OR (porcentaje_dedicacion >= 0 AND porcentaje_dedicacion <= 100)",
        )
    if CK_TAREA_PRIORIDAD not in existentes:
        op.create_check_constraint(
            CK_TAREA_PRIORIDAD,
            T_PERFIL_TAREAS,
            "prioridad IS NULL OR prioridad IN ('alta', 'media', 'baja')",
        )
    if CK_TAREA_FRECUENCIA not in existentes:
        op.create_check_constraint(
            CK_TAREA_FRECUENCIA,
            T_PERFIL_TAREAS,
            "frecuencia IS NULL OR frecuencia IN "
            "('diaria', 'semanal', 'mensual', 'trimestral', 'anual', 'eventual')",
        )


def upgrade() -> None:
    _crear_catalogos()
    career_paths = _sembrar_catalogos()
    _migrar_grados(career_paths)
    _migrar_perfiles()
    _migrar_grupos_competencia()
    _migrar_requisitos_y_tareas()


def downgrade() -> None:
    """
    Revierte el esquema WTW.

    La categoria de competencia vuelve a derivarse del nombre del grupo, que es el
    comportamiento anterior. Lo que NO se revierte: las filas sembradas en los
    catalogos (career paths, funciones, disciplinas, grupos Liderazgo/Digitales)
    quedan como datos; las tablas de catalogo si se eliminan.
    """
    existentes = _constraints(T_PERFIL_TAREAS)
    for nombre in (CK_TAREA_PORCENTAJE, CK_TAREA_PRIORIDAD, CK_TAREA_FRECUENCIA):
        if nombre in existentes:
            op.drop_constraint(nombre, T_PERFIL_TAREAS, type_="check")
    for columna in (
        "porcentaje_dedicacion",
        "frecuencia",
        "prioridad",
        "categoria_tarea_id",
    ):
        if columna in _columns(T_PERFIL_TAREAS):
            op.drop_column(T_PERFIL_TAREAS, columna)

    if "categoria_tarea_id" in _columns(T_TAREAS_CATALOGO):
        op.drop_column(T_TAREAS_CATALOGO, "categoria_tarea_id")
    if "evidencia" in _columns(T_REQUISITOS):
        op.drop_column(T_REQUISITOS, "evidencia")

    if UQ_GRUPO_CODIGO in _constraints(T_GRUPOS):
        op.drop_constraint(UQ_GRUPO_CODIGO, T_GRUPOS, type_="unique")
    if "codigo" in _columns(T_GRUPOS):
        op.drop_column(T_GRUPOS, "codigo")

    # Volver a derivar la categoria por nombre de grupo (comportamiento anterior).
    # Sin esto, estrechar la columna revienta: los codigos nuevos no caben en 20.
    bind = op.get_bind()
    for grupo_id, nombre in bind.execute(
        sa.text(f"SELECT id, nombre FROM {T_GRUPOS}")
    ).all():
        bind.execute(
            sa.text(
                f"UPDATE {T_COMPETENCIAS} c SET categoria = :categoria "
                "FROM levelup_tipos_competencia t "
                "WHERE t.id = c.tipo_competencia_id AND t.grupo_competencia_id = :grupo_id"
            ),
            {"categoria": categoria_desde_grupo_nombre(nombre), "grupo_id": grupo_id},
        )
    op.alter_column(
        T_COMPETENCIAS,
        "categoria",
        existing_type=sa.String(length=30),
        type_=sa.String(length=20),
        existing_nullable=False,
    )

    existentes = _constraints(T_PERFILES)
    if CK_PERFIL_ESTADO in existentes:
        op.drop_constraint(CK_PERFIL_ESTADO, T_PERFILES, type_="check")
    for columna in ("estado", "disciplina_id", "funcion_id", "career_path_id"):
        if columna in _columns(T_PERFILES):
            op.drop_column(T_PERFILES, columna)

    existentes = _constraints(T_GRADOS)
    for nombre in (UQ_GRADO_PATH_CODIGO, UQ_GRADO_PATH_ORDEN, UQ_GRADO_PATH_NOMBRE):
        if nombre in existentes:
            op.drop_constraint(nombre, T_GRADOS, type_="unique")
    for columna in ("codigo", "career_path_id"):
        if columna in _columns(T_GRADOS):
            op.drop_column(T_GRADOS, columna)
    if not _uniques_sobre(T_GRADOS, "nombre"):
        op.create_unique_constraint(UQ_GRADO_NOMBRE, T_GRADOS, ["nombre"])
    if not _uniques_sobre(T_GRADOS, "orden"):
        op.create_unique_constraint(UQ_GRADO_ORDEN, T_GRADOS, ["orden"])

    for tabla in (T_HISTORIAL, T_CATEGORIAS_TAREA, T_DISCIPLINAS, T_FUNCIONES, T_CAREER_PATHS):
        if _has_table(tabla):
            op.drop_table(tabla)

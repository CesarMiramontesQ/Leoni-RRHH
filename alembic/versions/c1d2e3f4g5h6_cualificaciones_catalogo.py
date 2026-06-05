"""cualificaciones catalogo configurable

Revision ID: c1d2e3f4g5h6
Revises: w8x9y0z1a2b3
Create Date: 2026-06-04

"""
from __future__ import annotations

import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "c1d2e3f4g5h6"
down_revision: Union[str, Sequence[str], None] = "w8x9y0z1a2b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NA_VARIANTS = frozenset({"N/A", "NA", "n.a", "n.a.", "Ninguna", "ninguna", "N/a"})

ESCOLARIDAD_OPCIONES = [
    {"valor": "ninguno", "etiqueta": "Ninguno", "peso": 0, "orden": 0},
    {"valor": "primaria", "etiqueta": "Primaria", "peso": 1, "orden": 1},
    {"valor": "secundaria", "etiqueta": "Secundaria", "peso": 2, "orden": 2},
    {"valor": "preparatoria", "etiqueta": "Preparatoria / Bachillerato", "peso": 3, "orden": 3},
    {"valor": "licenciatura", "etiqueta": "Licenciatura", "peso": 4, "orden": 4},
    {"valor": "maestria", "etiqueta": "Maestría", "peso": 5, "orden": 5},
    {"valor": "doctorado", "etiqueta": "Doctorado", "peso": 6, "orden": 6},
]

NIVEL_DOMINIO_OPCIONES = [
    {"valor": "1", "etiqueta": "Básico", "peso": 1, "orden": 1},
    {"valor": "2", "etiqueta": "Medio", "peso": 2, "orden": 2},
    {"valor": "3", "etiqueta": "Avanzado", "peso": 3, "orden": 3},
    {"valor": "4", "etiqueta": "Experto", "peso": 4, "orden": 4},
]

SI_NO_OPCIONES = [
    {"valor": "si", "etiqueta": "Cumple", "peso": 1, "orden": 1},
    {"valor": "no", "etiqueta": "No cumple", "peso": 0, "orden": 2},
]

LEGACY_TIPOS = [
    ("estudios_finalizados", "Nivel de estudios finalizados"),
    ("formacion_profesional", "Formación profesional / especialización (académica) / diplomas"),
    ("ampliacion_formacion", "Ampliación de la formación profesional / especialización"),
    ("estudios_universitarios", "Estudios universitarios / especialización (académica) / diplomas"),
    ("experiencia_profesional", "Experiencia profesional"),
    ("experiencia_direccion", "Experiencia de dirección / gerencia"),
    ("complementos", "Complementos individuales"),
]

METODOS = [
    {
        "slug": "escolaridad_jerarquica",
        "nombre": "Escolaridad jerárquica",
        "tipo": "lista_ordenada",
        "config": {
            "comparador": "ordinal_gte",
            "permite_na": True,
            "requiere_opciones": True,
            "captura": {"campos": ["opcion"], "anios_habilitado": False},
        },
        "opciones": ESCOLARIDAD_OPCIONES,
    },
    {
        "slug": "anios_experiencia_min",
        "nombre": "Años mínimos de experiencia",
        "tipo": "anios_experiencia",
        "config": {
            "comparador": "numeric_gte",
            "permite_na": True,
            "requiere_opciones": False,
            "captura": {"campos": ["anios", "texto"], "anios_habilitado": True},
        },
        "opciones": [],
    },
    {
        "slug": "experiencia_si_no",
        "nombre": "Experiencia sí / no",
        "tipo": "si_no",
        "config": {
            "comparador": "boolean_yes",
            "permite_na": True,
            "requiere_opciones": True,
            "captura": {"campos": ["opcion", "texto"], "anios_habilitado": False},
        },
        "opciones": SI_NO_OPCIONES,
    },
    {
        "slug": "nivel_dominio",
        "nombre": "Nivel de dominio",
        "tipo": "nivel_dominio",
        "config": {
            "comparador": "ordinal_gte",
            "permite_na": True,
            "requiere_opciones": True,
            "captura": {"campos": ["opcion"], "anios_habilitado": False},
        },
        "opciones": NIVEL_DOMINIO_OPCIONES,
    },
    {
        "slug": "texto_libre",
        "nombre": "Texto libre",
        "tipo": "texto_libre",
        "config": {
            "comparador": "none",
            "permite_na": True,
            "requiere_opciones": False,
            "captura": {"campos": ["texto"], "anios_habilitado": False},
        },
        "opciones": [],
    },
]

LEGACY_TIPO_METODO = {
    "estudios_finalizados": "escolaridad_jerarquica",
    "estudios_universitarios": "escolaridad_jerarquica",
    "formacion_profesional": "nivel_dominio",
    "ampliacion_formacion": "nivel_dominio",
    "experiencia_profesional": "anios_experiencia_min",
    "experiencia_direccion": "experiencia_si_no",
    "complementos": "texto_libre",
}

ESCOLARIDAD_KEYS = {o["valor"] for o in ESCOLARIDAD_OPCIONES}


def _criterio_desde_legacy(tipo: str, situacion: str | None, anios_min: int | None) -> dict:
    if situacion in NA_VARIANTS:
        return {"na": True}
    metodo_slug = LEGACY_TIPO_METODO.get(tipo, "texto_libre")
    if metodo_slug == "escolaridad_jerarquica":
        if situacion and situacion in ESCOLARIDAD_KEYS:
            return {"opcion_valor": situacion}
        return {"texto": situacion or ""}
    if metodo_slug == "anios_experiencia_min":
        criterio: dict = {}
        if anios_min is not None:
            criterio["min_anios"] = anios_min
        if situacion:
            criterio["texto"] = situacion
        return criterio or {"texto": situacion or ""}
    if metodo_slug == "experiencia_si_no":
        val = (situacion or "").strip().lower()
        if val in ("cumple", "si"):
            return {"opcion_valor": "si"}
        if val in ("no cumple", "no"):
            return {"opcion_valor": "no"}
        return {"texto": situacion or ""}
    if metodo_slug == "nivel_dominio":
        if situacion in ("1", "2", "3", "4"):
            return {"opcion_valor": situacion}
        return {"texto": situacion or ""}
    return {"texto": situacion or ""}


def _capturado_desde_legacy(tipo: str, situacion: str | None, anios: int | None) -> dict:
    if situacion in NA_VARIANTS:
        return {"na": True}
    metodo_slug = LEGACY_TIPO_METODO.get(tipo, "texto_libre")
    if metodo_slug == "escolaridad_jerarquica":
        if situacion and situacion in ESCOLARIDAD_KEYS:
            return {"opcion_valor": situacion}
        return {"texto": situacion or ""}
    if metodo_slug == "anios_experiencia_min":
        result: dict = {}
        if anios is not None:
            result["anios"] = anios
        if situacion:
            result["texto"] = situacion
        return result or {"texto": situacion or ""}
    if metodo_slug == "experiencia_si_no":
        val = (situacion or "").strip().lower()
        if val in ("cumple", "si"):
            return {"opcion_valor": "si"}
        if val in ("no cumple", "no"):
            return {"opcion_valor": "no"}
        return {"texto": situacion or ""}
    if metodo_slug == "nivel_dominio":
        if situacion in ("1", "2", "3", "4"):
            return {"opcion_valor": situacion}
        return {"texto": situacion or ""}
    return {"texto": situacion or ""}


def upgrade() -> None:
    op.create_table(
        "tipos_cualificacion",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nombre"),
    )

    op.create_table(
        "metodos_calificacion",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.Column("tipo", sa.String(length=50), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("config", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "opciones_calificacion",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("metodo_calificacion_id", sa.Integer(), nullable=False),
        sa.Column("etiqueta", sa.String(length=200), nullable=False),
        sa.Column("valor", sa.String(length=100), nullable=False),
        sa.Column("orden", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("peso", sa.Integer(), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(["metodo_calificacion_id"], ["metodos_calificacion.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "cualificaciones_catalogo",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("tipo_cualificacion_id", sa.Integer(), nullable=False),
        sa.Column("metodo_calificacion_id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=200), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("obligatorio", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("legacy_tipo", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tipo_cualificacion_id"], ["tipos_cualificacion.id"]),
        sa.ForeignKeyConstraint(["metodo_calificacion_id"], ["metodos_calificacion.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.add_column(
        "perfil_cualificaciones",
        sa.Column("cualificacion_catalogo_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "perfil_cualificaciones",
        sa.Column("criterio_requerido", JSONB(), nullable=True),
    )
    op.create_foreign_key(
        "fk_perfil_cualificaciones_catalogo",
        "perfil_cualificaciones",
        "cualificaciones_catalogo",
        ["cualificacion_catalogo_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    op.add_column(
        "perfil_funciones_cualificacion",
        sa.Column("valor_capturado", JSONB(), nullable=True),
    )

    op.alter_column("perfil_cualificaciones", "tipo", existing_type=sa.String(50), nullable=True)
    op.alter_column("perfil_cualificaciones", "situacion_deseada", existing_type=sa.Text(), nullable=True)
    op.alter_column("perfil_funciones_cualificacion", "situacion_actual", existing_type=sa.Text(), nullable=True)

    conn = op.get_bind()

    tipo_ids: dict[str, int] = {}
    for legacy, nombre in LEGACY_TIPOS:
        row = conn.execute(
            sa.text(
                "INSERT INTO tipos_cualificacion (nombre, descripcion, activo) "
                "VALUES (:nombre, :desc, true) RETURNING id"
            ),
            {"nombre": nombre, "desc": f"Tipo legacy: {legacy}"},
        ).fetchone()
        tipo_ids[legacy] = row[0]

    metodo_ids: dict[str, int] = {}
    for m in METODOS:
        row = conn.execute(
            sa.text(
                "INSERT INTO metodos_calificacion (nombre, tipo, descripcion, config, activo) "
                "VALUES (:nombre, :tipo, :desc, CAST(:config AS jsonb), true) RETURNING id"
            ),
            {
                "nombre": m["nombre"],
                "tipo": m["tipo"],
                "desc": m.get("descripcion", ""),
                "config": json.dumps(m["config"]),
            },
        ).fetchone()
        metodo_ids[m["slug"]] = row[0]
        for op_data in m["opciones"]:
            conn.execute(
                sa.text(
                    "INSERT INTO opciones_calificacion "
                    "(metodo_calificacion_id, etiqueta, valor, orden, peso, activo) "
                    "VALUES (:mid, :etiq, :val, :ord, :peso, true)"
                ),
                {
                    "mid": row[0],
                    "etiq": op_data["etiqueta"],
                    "val": op_data["valor"],
                    "ord": op_data["orden"],
                    "peso": op_data.get("peso"),
                },
            )

    catalogo_ids: dict[str, int] = {}
    for legacy, nombre in LEGACY_TIPOS:
        metodo_slug = LEGACY_TIPO_METODO[legacy]
        row = conn.execute(
            sa.text(
                "INSERT INTO cualificaciones_catalogo "
                "(tipo_cualificacion_id, metodo_calificacion_id, nombre, legacy_tipo, activo, obligatorio) "
                "VALUES (:tid, :mid, :nombre, :legacy, true, true) RETURNING id"
            ),
            {
                "tid": tipo_ids[legacy],
                "mid": metodo_ids[metodo_slug],
                "nombre": nombre,
                "legacy": legacy,
            },
        ).fetchone()
        catalogo_ids[legacy] = row[0]

    perfil_rows = conn.execute(
        sa.text("SELECT id, tipo, situacion_deseada, anios_minimos FROM perfil_cualificaciones")
    ).fetchall()
    for prow in perfil_rows:
        pid, tipo, situacion, anios_min = prow
        if not tipo:
            continue
        cat_id = catalogo_ids.get(tipo)
        if not cat_id:
            continue
        criterio = _criterio_desde_legacy(tipo, situacion, anios_min)
        conn.execute(
            sa.text(
                "UPDATE perfil_cualificaciones SET "
                "cualificacion_catalogo_id = :cat_id, criterio_requerido = CAST(:criterio AS jsonb) "
                "WHERE id = :id"
            ),
            {"cat_id": cat_id, "criterio": json.dumps(criterio), "id": pid},
        )

    eval_rows = conn.execute(
        sa.text(
            "SELECT e.id, e.situacion_actual, e.anios_actuales, c.tipo "
            "FROM perfil_funciones_cualificacion e "
            "JOIN perfil_cualificaciones c ON c.id = e.cualificacion_id"
        )
    ).fetchall()
    for erow in eval_rows:
        eid, situacion, anios, tipo = erow
        if not tipo:
            continue
        capturado = _capturado_desde_legacy(tipo, situacion, anios)
        conn.execute(
            sa.text(
                "UPDATE perfil_funciones_cualificacion SET "
                "valor_capturado = CAST(:capt AS jsonb) WHERE id = :id"
            ),
            {"capt": json.dumps(capturado), "id": eid},
        )


def downgrade() -> None:
    op.alter_column("perfil_funciones_cualificacion", "situacion_actual", existing_type=sa.Text(), nullable=False)
    op.alter_column("perfil_cualificaciones", "situacion_deseada", existing_type=sa.Text(), nullable=False)
    op.alter_column("perfil_cualificaciones", "tipo", existing_type=sa.String(50), nullable=False)

    op.drop_column("perfil_funciones_cualificacion", "valor_capturado")
    op.drop_constraint("fk_perfil_cualificaciones_catalogo", "perfil_cualificaciones", type_="foreignkey")
    op.drop_column("perfil_cualificaciones", "criterio_requerido")
    op.drop_column("perfil_cualificaciones", "cualificacion_catalogo_id")

    op.drop_table("cualificaciones_catalogo")
    op.drop_table("opciones_calificacion")
    op.drop_table("metodos_calificacion")
    op.drop_table("tipos_cualificacion")

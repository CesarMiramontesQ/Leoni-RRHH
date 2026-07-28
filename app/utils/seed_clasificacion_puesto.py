# app/utils/seed_clasificacion_puesto.py
"""
Datos semilla de la clasificacion de puestos (Willis Towers Watson).

Modulo SOLO de datos: lo importan tanto la migracion Alembic que crea los catalogos
como cualquier script de seed posterior. No abre sesiones ni ejecuta SQL, para que la
migracion no dependa del ORM.

El catalogo es un punto de partida; RH agrega funciones y disciplinas desde
Ajustes > Perfiles de puesto > Clasificacion.
"""

# ── Career Paths ─────────────────────────────────────────────────────────────
# El codigo es el prefijo del Career Level: Professional -> P10, Management -> M3.
# No llevan orden: los career paths son alternativas, no una escala. Quien ordena
# es el Global Grade, y por eso un P10 y un M1 pueden pesar lo mismo.
CAREER_PATHS_SEED: list[dict] = [
    {"codigo": "P", "nombre": "Professional"},
    {"codigo": "M", "nombre": "Management"},
]

CAREER_PATH_DEFAULT_CODIGO = "P"

# ── Funciones (job families) ──────────────────────────────────────────────────
FUNCIONES_SEED: list[dict] = [
    {"codigo": "AHR", "nombre": "Recursos Humanos"},
    {"codigo": "ENG", "nombre": "Ingenieria"},
    {"codigo": "MFG", "nombre": "Manufactura"},
    {"codigo": "QUA", "nombre": "Calidad"},
    {"codigo": "PUR", "nombre": "Compras"},
    {"codigo": "FIN", "nombre": "Finanzas"},
    {"codigo": "IT", "nombre": "IT"},
    {"codigo": "PRD", "nombre": "Produccion"},
    {"codigo": "SCM", "nombre": "Supply Chain"},
    {"codigo": "LOG", "nombre": "Logistica"},
    {"codigo": "MNT", "nombre": "Mantenimiento"},
]

# ── Disciplinas por funcion ───────────────────────────────────────────────────
# Solo se siembran las dos funciones con desglose confirmado; el resto las captura RH.
DISCIPLINAS_SEED: dict[str, list[str]] = {
    "ENG": [
        "Manufactura",
        "Industrial",
        "Automatizacion",
        "Procesos",
        "Diseno",
    ],
    "AHR": [
        "HR Generalist",
        "Compensation",
        "Talent Acquisition",
        "Learning",
        "Labor Relations",
        "HRIS",
    ],
}

# ── Categorias de competencia (grupos) ────────────────────────────────────────
# 'tecnica' y 'blanda' ya existen como grupos; aqui solo van los que faltan.
# El codigo debe coincidir con `slug_codigo_grupo(nombre)`: si el grupo ya existe en
# la BD, el backfill le pone el slug, y la semilla tiene que converger al mismo valor.
GRUPOS_COMPETENCIA_NUEVOS_SEED: list[dict] = [
    {"codigo": "liderazgo", "nombre": "Liderazgo"},
    {"codigo": "digitales", "nombre": "Digitales"},
]

# ── Valores fijos validados en backend (no son catalogo editable) ─────────────
ESTADOS_PERFIL = ("activo", "inactivo", "en_revision")
PRIORIDADES_TAREA = ("alta", "media", "baja")
FRECUENCIAS_TAREA = (
    "diaria",
    "semanal",
    "mensual",
    "trimestral",
    "anual",
    "eventual",
)

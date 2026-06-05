"""Datos iniciales del catálogo de cualificaciones (usado en migración y seed)."""

from __future__ import annotations

ESCOLARIDAD_OPCIONES: list[dict] = [
    {"valor": "ninguno", "etiqueta": "Ninguno", "peso": 0, "orden": 0},
    {"valor": "primaria", "etiqueta": "Primaria", "peso": 1, "orden": 1},
    {"valor": "secundaria", "etiqueta": "Secundaria", "peso": 2, "orden": 2},
    {"valor": "preparatoria", "etiqueta": "Preparatoria / Bachillerato", "peso": 3, "orden": 3},
    {"valor": "licenciatura", "etiqueta": "Licenciatura", "peso": 4, "orden": 4},
    {"valor": "maestria", "etiqueta": "Maestría", "peso": 5, "orden": 5},
    {"valor": "doctorado", "etiqueta": "Doctorado", "peso": 6, "orden": 6},
]

NIVEL_DOMINIO_OPCIONES: list[dict] = [
    {"valor": "1", "etiqueta": "Básico", "peso": 1, "orden": 1},
    {"valor": "2", "etiqueta": "Medio", "peso": 2, "orden": 2},
    {"valor": "3", "etiqueta": "Avanzado", "peso": 3, "orden": 3},
    {"valor": "4", "etiqueta": "Experto", "peso": 4, "orden": 4},
]

SI_NO_OPCIONES: list[dict] = [
    {"valor": "si", "etiqueta": "Cumple", "peso": 1, "orden": 1},
    {"valor": "no", "etiqueta": "No cumple", "peso": 0, "orden": 2},
]

LEGACY_TIPOS: list[dict] = [
    {
        "legacy_tipo": "estudios_finalizados",
        "nombre": "Nivel de estudios finalizados",
        "descripcion": "Nivel mínimo de escolaridad concluida",
    },
    {
        "legacy_tipo": "formacion_profesional",
        "nombre": "Formación profesional / especialización (académica) / diplomas",
        "descripcion": "Formación profesional o diplomas académicos",
    },
    {
        "legacy_tipo": "ampliacion_formacion",
        "nombre": "Ampliación de la formación profesional / especialización",
        "descripcion": "Ampliación de formación profesional o diplomas",
    },
    {
        "legacy_tipo": "estudios_universitarios",
        "nombre": "Estudios universitarios / especialización (académica) / diplomas",
        "descripcion": "Estudios universitarios o especialización académica",
    },
    {
        "legacy_tipo": "experiencia_profesional",
        "nombre": "Experiencia profesional",
        "descripcion": "Experiencia profesional en el área",
    },
    {
        "legacy_tipo": "experiencia_direccion",
        "nombre": "Experiencia de dirección / gerencia",
        "descripcion": "Experiencia en dirección o gerencia",
    },
    {
        "legacy_tipo": "complementos",
        "nombre": "Complementos individuales",
        "descripcion": "Requisitos complementarios del puesto",
    },
]

METODOS_SEED: list[dict] = [
    {
        "slug": "escolaridad_jerarquica",
        "nombre": "Escolaridad jerárquica",
        "tipo": "lista_ordenada",
        "descripcion": "Comparación ordinal por nivel de estudios",
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
        "descripcion": "Comparación por años mínimos de experiencia",
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
        "descripcion": "Evaluación binaria de cumplimiento",
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
        "descripcion": "Escala ordinal de dominio (Básico a Experto)",
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
        "descripcion": "Captura textual sin auto-compliance",
        "config": {
            "comparador": "none",
            "permite_na": True,
            "requiere_opciones": False,
            "captura": {"campos": ["texto"], "anios_habilitado": False},
        },
        "opciones": [],
    },
]

LEGACY_TIPO_METODO: dict[str, str] = {
    "estudios_finalizados": "escolaridad_jerarquica",
    "estudios_universitarios": "escolaridad_jerarquica",
    "formacion_profesional": "nivel_dominio",
    "ampliacion_formacion": "nivel_dominio",
    "experiencia_profesional": "anios_experiencia_min",
    "experiencia_direccion": "experiencia_si_no",
    "complementos": "texto_libre",
}

NA_VARIANTS = frozenset({"N/A", "NA", "n.a", "n.a.", "Ninguna", "ninguna", "N/a"})

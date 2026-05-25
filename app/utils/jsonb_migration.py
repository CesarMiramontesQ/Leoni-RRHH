# app/utils/jsonb_migration.py
"""
Utilidades para migrar datos JSONB de puestos_perfil a tablas normalizadas.
"""

CATEGORY_MAP = {
    "competencias_tecnicas": "profesional",
    "habilidades_blandas": "social",
    "maquinas_herramientas": "complementos",
}


def extract_items(raw) -> list[str]:
    """Extrae lista de strings de un valor JSONB (puede ser list, dict, o None)."""
    if raw is None:
        return []
    if isinstance(raw, list):
        result = []
        for item in raw:
            if isinstance(item, str):
                text = item.strip()
                if text:
                    result.append(text)
            elif isinstance(item, dict):
                nombre = item.get("nombre") or item.get("name") or item.get("descripcion") or ""
                nivel = item.get("nivel") or item.get("level") or ""
                text = nombre.strip()
                if nivel:
                    text = f"{text} ({nivel})"
                if text:
                    result.append(text)
        return result
    elif isinstance(raw, dict):
        result = []
        for key, val in raw.items():
            if isinstance(val, list):
                for item in val:
                    if isinstance(item, str) and item.strip():
                        result.append(item.strip())
            elif isinstance(val, str) and val.strip():
                result.append(f"{key}: {val.strip()}")
        return result
    return []

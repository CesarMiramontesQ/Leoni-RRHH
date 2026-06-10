/** Etiquetas en español para tipos y reglas de métodos de calificación (valores técnicos en API). */

export const METODO_TIPO_LABELS: Record<string, string> = {
  lista_ordenada: "Lista ordenada",
  escala_numerica: "Escala numérica",
  si_no: "Sí / No",
  anios_experiencia: "Años de experiencia",
  nivel_dominio: "Nivel de dominio",
  seleccion_simple: "Selección simple",
  seleccion_multiple: "Selección múltiple",
  texto_libre: "Texto libre",
};

export const METODO_TIPO_DESCRIPCIONES: Record<string, string> = {
  lista_ordenada: "Opciones con jerarquía (ej. escolaridad)",
  escala_numerica: "Valor numérico en escala configurable",
  si_no: "Cumple o no cumple",
  anios_experiencia: "Años mínimos de experiencia",
  nivel_dominio: "Básico → Experto",
  seleccion_simple: "Una sola opción del catálogo",
  seleccion_multiple: "Varias opciones permitidas",
  texto_libre: "Sin evaluación automática",
};

export const COMPARADOR_LABELS: Record<string, string> = {
  ordinal_gte: "Mayor o igual (jerarquía)",
  numeric_gte: "Mayor o igual (numérico)",
  numeric_range: "Dentro de un rango",
  exact: "Coincidencia exacta",
  boolean_yes: "Debe ser Sí",
  set_superset: "Incluye todas las opciones",
  none: "Sin comparación automática",
};

export const COMPARADOR_DESCRIPCIONES: Record<string, string> = {
  ordinal_gte: "El valor capturado debe ser igual o superior en la lista ordenada",
  numeric_gte: "El número capturado debe ser igual o mayor al requerido",
  numeric_range: "El valor debe estar entre un mínimo y un máximo",
  exact: "Debe coincidir exactamente con la opción requerida",
  boolean_yes: "Solo cumple si la respuesta es Sí",
  set_superset: "Debe incluir todas las opciones requeridas",
  none: "No calcula cumplimiento; solo captura texto",
};

export const METODO_TIPOS = Object.keys(METODO_TIPO_LABELS) as (keyof typeof METODO_TIPO_LABELS)[];
export const COMPARADORES = Object.keys(COMPARADOR_LABELS) as (keyof typeof COMPARADOR_LABELS)[];

export function labelMetodoTipo(tipo: string): string {
  return METODO_TIPO_LABELS[tipo] ?? tipo;
}

export function labelComparador(comparador: string | undefined | null): string {
  if (!comparador) return "—";
  return COMPARADOR_LABELS[comparador] ?? comparador;
}

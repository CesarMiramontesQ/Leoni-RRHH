export type CompetenciaTipoKey =
  | "informatica"
  | "idiomas"
  | "profesional"
  | "social"
  | "personal"
  | "metodos";

export interface CompetenciaTipoOption {
  value: CompetenciaTipoKey;
  label: string;
  grupo: "tecnica" | "habilidad_blanda";
}

export const TIPO_COMPETENCIA_OPTIONS: CompetenciaTipoOption[] = [
  { value: "informatica", label: "Conocimientos de Informática", grupo: "tecnica" },
  { value: "idiomas", label: "Lenguas", grupo: "tecnica" },
  { value: "profesional", label: "Competencia profesional", grupo: "habilidad_blanda" },
  { value: "social", label: "Competencia social", grupo: "habilidad_blanda" },
  { value: "personal", label: "Competencias personales", grupo: "habilidad_blanda" },
  { value: "metodos", label: "Competencias en métodos", grupo: "habilidad_blanda" },
];

export const TIPO_COMPETENCIA_LABELS: Record<string, string> = Object.fromEntries(
  TIPO_COMPETENCIA_OPTIONS.map(o => [o.value, o.label]),
);

export function grupoFromTipo(tipo: string): "tecnica" | "habilidad_blanda" {
  return TIPO_COMPETENCIA_OPTIONS.find(o => o.value === tipo)?.grupo ?? "habilidad_blanda";
}

export function esTipoCompetenciaValido(tipo: string): tipo is CompetenciaTipoKey {
  return TIPO_COMPETENCIA_OPTIONS.some(o => o.value === tipo);
}

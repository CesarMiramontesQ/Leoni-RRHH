export interface NivelEscolaridad {
  key: string;
  label: string;
  peso: number;
}

export const CATALOGO_ESCOLARIDAD: NivelEscolaridad[] = [
  { key: "ninguno", label: "Ninguno", peso: 0 },
  { key: "primaria", label: "Primaria", peso: 1 },
  { key: "secundaria", label: "Secundaria", peso: 2 },
  { key: "preparatoria", label: "Preparatoria / Bachillerato", peso: 3 },
  { key: "licenciatura", label: "Licenciatura", peso: 4 },
  { key: "maestria", label: "Maestría", peso: 5 },
  { key: "doctorado", label: "Doctorado", peso: 6 },
];

export const ESCOLARIDAD_MAP: Record<string, NivelEscolaridad> = Object.fromEntries(
  CATALOGO_ESCOLARIDAD.map(n => [n.key, n]),
);

export function escolaridadLabel(key: string): string {
  return ESCOLARIDAD_MAP[key]?.label ?? key;
}

import type { FaltaRetardoTipo } from "../../api/faltasRetardos.ts";

export const FALTA_RETARDO_TIPOS: readonly FaltaRetardoTipo[] = [
  "falta_justificada",
  "falta_injustificada",
  "retardo",
  "incapacidad",
  "suspension",
  "matrimonio",
  "incapacidad_interna",
  "defuncion",
  "paternidad",
  "vacaciones",
] as const;

/** Tipos disponibles al crear un registro manual desde RH. */
export const FALTA_RETARDO_TIPOS_NUEVO_REGISTRO: readonly FaltaRetardoTipo[] = [
  "suspension",
  "matrimonio",
  "incapacidad_interna",
  "defuncion",
  "paternidad",
] as const;

export const FALTA_RETARDO_TIPOS_GOCE: ReadonlySet<FaltaRetardoTipo> = new Set([
  "matrimonio",
  "incapacidad_interna",
  "defuncion",
  "paternidad",
]);

export const FALTA_RETARDO_TIPO_LABELS: Record<FaltaRetardoTipo, string> = {
  falta_justificada: "Falta justificada",
  falta_injustificada: "Falta injustificada",
  retardo: "Retardo",
  incapacidad: "Incapacidad",
  suspension: "Suspensión",
  matrimonio: "Matrimonio (goce)",
  incapacidad_interna: "Incapacidad interna (goce)",
  defuncion: "Defunción (goce)",
  paternidad: "Paternidad (goce)",
  vacaciones: "Vacaciones",
};

export const FALTA_RETARDO_TIPOS_RANGO: ReadonlySet<FaltaRetardoTipo> = new Set([
  "incapacidad",
  "suspension",
  "matrimonio",
  "incapacidad_interna",
  "defuncion",
  "paternidad",
]);

export function labelFaltaRetardoTipo(tipo: FaltaRetardoTipo): string {
  return FALTA_RETARDO_TIPO_LABELS[tipo] ?? tipo;
}

/**
 * Un color por tipo. Los hues salen de una paleta categórica validada (banda de
 * luminosidad, piso de croma, separación para daltonismo y contraste); los estilos
 * viven en `style.css` como `--t-<tipo>`. El pill siempre muestra la etiqueta, así
 * que el color refuerza la lectura pero no es el único identificador.
 */
const TIPO_PILL_CLASSES: Record<FaltaRetardoTipo, string> = {
  falta_injustificada: "rh-inc-type-pill--t-falta-injustificada",
  retardo: "rh-inc-type-pill--t-retardo",
  falta_justificada: "rh-inc-type-pill--t-falta-justificada",
  suspension: "rh-inc-type-pill--t-suspension",
  incapacidad: "rh-inc-type-pill--t-incapacidad",
  incapacidad_interna: "rh-inc-type-pill--t-incapacidad-interna",
  vacaciones: "rh-inc-type-pill--t-vacaciones",
  matrimonio: "rh-inc-type-pill--t-matrimonio",
  paternidad: "rh-inc-type-pill--t-paternidad",
  defuncion: "rh-inc-type-pill--t-defuncion",
};

export function badgeClassFaltaRetardoTipo(tipo: FaltaRetardoTipo): string {
  return TIPO_PILL_CLASSES[tipo] ?? "rh-inc-type-pill--default";
}

export function formatFaltaRetardoFechas(
  fechaEvento: string,
  fechaFin: string | null,
): string {
  if (!fechaFin || fechaFin === fechaEvento) return fechaEvento;
  return `${fechaEvento} — ${fechaFin}`;
}

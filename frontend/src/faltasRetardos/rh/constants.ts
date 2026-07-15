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
] as const;

/** Tipos disponibles al crear un registro manual desde RH. */
export const FALTA_RETARDO_TIPOS_NUEVO_REGISTRO: readonly FaltaRetardoTipo[] = [
  "retardo",
  "falta_injustificada",
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

export function badgeClassFaltaRetardoTipo(tipo: FaltaRetardoTipo): string {
  switch (tipo) {
    case "falta_justificada":
      return "rh-inc-type-pill--tiempo";
    case "falta_injustificada":
      return "rh-inc-type-pill--seguridad";
    case "retardo":
      return "rh-inc-type-pill--tiempo";
    case "incapacidad":
      return "rh-inc-type-pill--evaluacion";
    case "suspension":
      return "rh-inc-type-pill--default";
    case "matrimonio":
    case "incapacidad_interna":
    case "defuncion":
    case "paternidad":
      return "rh-inc-type-pill--tiempo";
    default:
      return "rh-inc-type-pill--default";
  }
}

export function formatFaltaRetardoFechas(
  fechaEvento: string,
  fechaFin: string | null,
): string {
  if (!fechaFin || fechaFin === fechaEvento) return fechaEvento;
  return `${fechaEvento} — ${fechaFin}`;
}

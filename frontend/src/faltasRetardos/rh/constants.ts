import type { FaltaRetardoTipo } from "../../api/faltasRetardos.ts";

export const FALTA_RETARDO_TIPOS: readonly FaltaRetardoTipo[] = [
  "falta_justificada",
  "falta_injustificada",
  "retardo",
  "incapacidad",
  "suspension",
] as const;

export const FALTA_RETARDO_TIPO_LABELS: Record<FaltaRetardoTipo, string> = {
  falta_justificada: "Falta justificada",
  falta_injustificada: "Falta injustificada",
  retardo: "Retardo",
  incapacidad: "Incapacidad",
  suspension: "Suspensión",
};

export const FALTA_RETARDO_TIPOS_RANGO: ReadonlySet<FaltaRetardoTipo> = new Set([
  "incapacidad",
  "suspension",
]);

export function labelFaltaRetardoTipo(tipo: FaltaRetardoTipo): string {
  return FALTA_RETARDO_TIPO_LABELS[tipo] ?? tipo;
}

export function badgeClassFaltaRetardoTipo(tipo: FaltaRetardoTipo): string {
  switch (tipo) {
    case "falta_justificada":
      return "bg-amber-50 text-amber-800 ring-amber-200/80";
    case "falta_injustificada":
      return "bg-red-50 text-red-800 ring-red-200/80";
    case "retardo":
      return "bg-orange-50 text-orange-800 ring-orange-200/80";
    case "incapacidad":
      return "bg-sky-50 text-sky-800 ring-sky-200/80";
    case "suspension":
      return "bg-violet-50 text-violet-800 ring-violet-200/80";
    default:
      return "bg-slate-50 text-slate-700 ring-slate-200/80";
  }
}

export function formatFaltaRetardoFechas(
  fechaEvento: string,
  fechaFin: string | null,
): string {
  if (!fechaFin || fechaFin === fechaEvento) return fechaEvento;
  return `${fechaEvento} — ${fechaFin}`;
}

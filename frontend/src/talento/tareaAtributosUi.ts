/**
 * Presentación de los atributos de una responsabilidad del puesto:
 * categoría, prioridad, frecuencia y porcentaje de dedicación.
 *
 * Prioridad y frecuencia son conjuntos fijos validados en backend, no catálogo
 * editable: cargan lógica de lectura y el repo usa `String` + validación para
 * este tipo de campo. Las etiquetas viven aquí para que el modal, el detalle y
 * cualquier vista futura las lean igual.
 */

import { escapeHtml } from "../ui/uiUtils.ts";
import type { FrecuenciaTarea, PrioridadTarea } from "../api/puestos.ts";

export const PRIORIDADES: { value: PrioridadTarea; label: string }[] = [
  { value: "alta", label: "Alta" },
  { value: "media", label: "Media" },
  { value: "baja", label: "Baja" },
];

export const FRECUENCIAS: { value: FrecuenciaTarea; label: string }[] = [
  { value: "diaria", label: "Diaria" },
  { value: "semanal", label: "Semanal" },
  { value: "mensual", label: "Mensual" },
  { value: "trimestral", label: "Trimestral" },
  { value: "anual", label: "Anual" },
  { value: "eventual", label: "Eventual" },
];

export function prioridadLabel(valor: string | null | undefined): string {
  return PRIORIDADES.find((p) => p.value === valor)?.label ?? "";
}

export function frecuenciaLabel(valor: string | null | undefined): string {
  return FRECUENCIAS.find((f) => f.value === valor)?.label ?? "";
}

/** Badge de prioridad. El tono ordena de un vistazo; el texto siempre está. */
export function prioridadBadge(valor: string | null | undefined): string {
  const label = prioridadLabel(valor);
  if (!label) return "";
  const tono =
    valor === "alta"
      ? "border-red-200 bg-red-50 text-red-800"
      : valor === "media"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-slate-50 text-text-secondary";
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tono}">${escapeHtml(label)}</span>`;
}

export function frecuenciaBadge(valor: string | null | undefined): string {
  const label = frecuenciaLabel(valor);
  if (!label) return "";
  return `<span class="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-text-secondary">${escapeHtml(label)}</span>`;
}

export function categoriaTareaBadge(nombre: string | null | undefined): string {
  const texto = (nombre ?? "").trim();
  if (!texto) return "";
  return `<span class="inline-flex items-center rounded-full border border-accent/20 bg-accent-light px-2 py-0.5 text-[11px] font-semibold text-accent">${escapeHtml(texto)}</span>`;
}

export function dedicacionBadge(porcentaje: number | null | undefined): string {
  if (porcentaje == null) return "";
  return `<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-text-secondary" title="Porcentaje del tiempo del puesto">${porcentaje}%</span>`;
}

/**
 * Resumen de la carga de un alcance.
 *
 * El aviso es informativo a propósito: repartir el 100% es una guía de análisis,
 * no una regla que deba impedir guardar. Se distingue "no llega" de "se pasa"
 * porque son problemas distintos, y se menciona cuántas tareas no tienen
 * porcentaje para que el total no se lea como un dato completo cuando no lo es.
 */
export function dedicacionResumen(opts: {
  total: number;
  sinPorcentaje: number;
  alcance?: string;
}): string {
  const { total, sinPorcentaje } = opts;
  const alcance = opts.alcance ? ` en ${opts.alcance}` : "";

  let tono = "border-emerald-200 bg-emerald-50 text-emerald-900";
  let mensaje = `La dedicación${alcance} suma <strong class="tabular-nums">100%</strong>.`;
  if (total > 100) {
    tono = "border-red-200 bg-red-50 text-red-900";
    mensaje = `La dedicación${alcance} suma <strong class="tabular-nums">${total}%</strong>, por encima del 100%.`;
  } else if (total < 100) {
    tono = "border-amber-200 bg-amber-50 text-amber-900";
    mensaje = `La dedicación${alcance} suma <strong class="tabular-nums">${total}%</strong>; faltan <strong class="tabular-nums">${100 - total}%</strong> por repartir.`;
  }

  const pendientes =
    sinPorcentaje > 0
      ? ` <span class="opacity-80">${sinPorcentaje} tarea${sinPorcentaje !== 1 ? "s" : ""} sin porcentaje.</span>`
      : "";

  return `<p class="rounded-lg border px-3 py-2 text-xs leading-relaxed ${tono}" role="status">${mensaje}${pendientes}</p>`;
}

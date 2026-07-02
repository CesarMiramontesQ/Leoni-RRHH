import { escapeHtml } from "./html.ts";

export type Vista360TableTabId = "incidencias" | "actas" | "registros-comedor";

export type Vista360TabId =
  | "resumen"
  | Vista360TableTabId
  | "historial"
  | "beneficios"
  | "capacidades"
  | "plan_desarrollo"
  | "evaluacion360";

const TABS: { id: Vista360TabId; label: string }[] = [
  { id: "resumen", label: "Resumen" },
  { id: "incidencias", label: "Incidencias" },
  { id: "historial", label: "Historial" },
  { id: "beneficios", label: "Beneficios" },
  { id: "capacidades", label: "Capacidades" },
  { id: "plan_desarrollo", label: "Plan de desarrollo" },
  { id: "evaluacion360", label: "Evaluación 360°" },
  { id: "actas", label: "Actas" },
  { id: "registros-comedor", label: "Registros comedor" },
];

const TAB_BTN_BASE =
  "inline-flex min-h-10 items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2";

/** Clases del botón de pestaña (sincronizar con `bindVista360TabDelegation`). */
export function vista360TabButtonClass(isActive: boolean): string {
  if (isActive) {
    return `${TAB_BTN_BASE} border-leoni-blue/20 bg-leoni-blue text-white shadow-sm shadow-leoni-blue/20`;
  }
  return `${TAB_BTN_BASE} border-transparent bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-text-primary`;
}

export function vista360TabsHtml(active: Vista360TabId): string {
  const buttons = TABS.map((t) => {
    const isActive = t.id === active;
    return `
      <button
        type="button"
        role="tab"
        id="v360-tab-${t.id}"
        aria-selected="${isActive ? "true" : "false"}"
        aria-controls="v360-panel-${t.id}"
        data-v360-tab="${t.id}"
        class="${vista360TabButtonClass(isActive)}"
      >${escapeHtml(t.label)}</button>`;
  }).join("");

  return `
    <div role="tablist" aria-label="Secciones del empleado" class="mt-1 overflow-x-auto pb-1">
      <div class="inline-flex min-w-full items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-1.5 sm:min-w-0">${buttons}</div>
    </div>`;
}

/** Tabs con tablas paginadas vía API (incidencias, actas, comedor). */
export const VISTA360_TABLE_TAB_IDS: readonly Vista360TableTabId[] = [
  "incidencias",
  "actas",
  "registros-comedor",
];

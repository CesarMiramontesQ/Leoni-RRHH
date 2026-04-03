import { escapeHtml } from "./html.ts";

export type Vista360TabId = "resumen" | "incidencias" | "historial" | "beneficios";

const TABS: { id: Vista360TabId; label: string }[] = [
  { id: "resumen", label: "Resumen" },
  { id: "incidencias", label: "Incidencias" },
  { id: "historial", label: "Historial" },
  { id: "beneficios", label: "Beneficios" },
];

const TAB_BTN_BASE =
  "-mb-px border-b-2 border-transparent px-1 py-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue focus-visible:ring-offset-2";

/** Clases del botón de pestaña (sincronizar con `bindVista360TabDelegation`). */
export function vista360TabButtonClass(isActive: boolean): string {
  if (isActive) {
    return `${TAB_BTN_BASE} border-leoni-blue text-leoni-blue`;
  }
  return `${TAB_BTN_BASE} text-slate-500 hover:text-text-primary`;
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
    <div role="tablist" aria-label="Secciones del empleado" class="mt-1">
      <div class="flex flex-wrap gap-x-8 gap-y-1 border-b border-slate-200/70">${buttons}</div>
    </div>`;
}

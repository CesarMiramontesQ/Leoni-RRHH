import { escapeHtml } from "./html.ts";

export type Vista360TabId = "resumen" | "incidencias" | "historial" | "beneficios";

const TABS: { id: Vista360TabId; label: string }[] = [
  { id: "resumen", label: "Resumen" },
  { id: "incidencias", label: "Incidencias" },
  { id: "historial", label: "Historial" },
  { id: "beneficios", label: "Beneficios" },
];

export function vista360TabsHtml(active: Vista360TabId): string {
  const buttons = TABS.map((t) => {
    const isActive = t.id === active;
    const cls = isActive
      ? "border-leoni-blue text-leoni-blue"
      : "border-transparent text-text-muted hover:border-slate-200 hover:text-text-primary";
    return `
      <button
        type="button"
        role="tab"
        id="v360-tab-${t.id}"
        aria-selected="${isActive ? "true" : "false"}"
        aria-controls="v360-panel-${t.id}"
        data-v360-tab="${t.id}"
        class="-mb-px border-b-2 px-1 py-3 text-sm font-semibold transition-colors ${cls}"
      >${escapeHtml(t.label)}</button>`;
  }).join("");

  return `
    <div class="border-b border-border" role="tablist" aria-label="Secciones del empleado">
      <div class="flex flex-wrap gap-x-6 gap-y-1">${buttons}</div>
    </div>`;
}

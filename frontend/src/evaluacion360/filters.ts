import {
  FIELD_FOCUS,
  FILTER_FIELD_WRAP,
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_FOCUS_RING,
  RH_LISTADO_LABEL,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
  SELECT_CHEVRON,
} from "../ui/uiTokens.ts";
import type { Eval360Filters } from "./types.ts";

export const EMPTY_EVAL360_FILTERS: Eval360Filters = {
  area: "",
  subarea: "",
  puesto: "",
  estado: "",
};

export const FILTER_OPTIONS = {
  areas: ["Producción", "Calidad", "Logística", "Mantenimiento", "Ingeniería", "RH"],
  subareas: ["Cableado L1", "Cableado L3", "Ensamble L2", "Ensamble L5", "Prueba Eléctrica", "Calidad", "Mantenimiento", "Operaciones RH"],
  puestos: ["Supervisor de línea", "Supervisora de Calidad", "Coordinador", "Líder de área", "Analista RH", "Ingeniero de procesos", "Gerente de planta adj.", "Coordinador logístico", "Jefe de mantenimiento"],
  estados: [
    { value: "pendiente", label: "Pendiente" },
    { value: "en_progreso", label: "En progreso" },
    { value: "completada", label: "Completada" },
  ],
} as const;

const E360_FILTER_SELECT = `${RH_LISTADO_SELECT} rh-sol-filter-select min-h-[42px] rounded-[12px] border-[rgba(148,163,184,0.35)] py-2.5 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color] duration-150 ease-out hover:border-[rgba(100,116,139,0.45)] hover:bg-[#fafbfc]`;

function selectField(name: keyof Eval360Filters, id: string, label: string, options: readonly string[], filters: Eval360Filters): string {
  return `
    <div class="${FILTER_FIELD_WRAP}">
      <label for="${id}" class="${RH_LISTADO_LABEL}">${label}</label>
      <div class="grid grid-cols-1">
        <select id="${id}" name="${name}" data-filter="${name}" class="${E360_FILTER_SELECT} col-start-1 row-start-1 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}">
          <option value="">Todos</option>
          ${options.map((o) => `<option value="${o}" ${filters[name] === o ? "selected" : ""}>${o}</option>`).join("")}
        </select>
        ${SELECT_CHEVRON}
      </div>
    </div>`;
}

export function renderEval360Filters(filters: Eval360Filters): string {
  const estadoOptions = FILTER_OPTIONS.estados
    .map((o) => `<option value="${o.value}" ${filters.estado === o.value ? "selected" : ""}>${o.label}</option>`)
    .join("");

  return `
    <section class="${RH_LISTADO_SURFACE} p-4 sm:p-5" aria-label="Filtros del dashboard">
      <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 class="text-sm font-semibold text-text-primary">Filtros globales RH</h2>
          <p class="mt-0.5 text-xs text-text-muted">Actualizan KPIs, gráficas y tablas del dashboard</p>
        </div>
        <button type="button" class="${RH_LISTADO_BTN_GHOST} w-full shrink-0 sm:w-auto" data-action="e360-clear-filters">Limpiar filtros</button>
      </div>
      <div class="flex flex-wrap gap-3">
        ${selectField("area", "e360-filter-area", "Área", FILTER_OPTIONS.areas, filters)}
        ${selectField("subarea", "e360-filter-subarea", "Subárea", FILTER_OPTIONS.subareas, filters)}
        ${selectField("puesto", "e360-filter-puesto", "Puesto", FILTER_OPTIONS.puestos, filters)}
        <div class="${FILTER_FIELD_WRAP}">
          <label for="e360-filter-estado" class="${RH_LISTADO_LABEL}">Estado de evaluación</label>
          <div class="grid grid-cols-1">
            <select id="e360-filter-estado" name="estado" data-filter="estado" class="${E360_FILTER_SELECT} col-start-1 row-start-1 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}">
              <option value="">Todos</option>
              ${estadoOptions}
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
      </div>
    </section>`;
}

export function readEval360FiltersFromDom(root: ParentNode): Eval360Filters {
  const get = (name: keyof Eval360Filters) =>
    (root.querySelector<HTMLSelectElement>(`[data-filter="${name}"]`)?.value ?? "").trim();
  return {
    area: get("area"),
    subarea: get("subarea"),
    puesto: get("puesto"),
    estado: get("estado"),
  };
}

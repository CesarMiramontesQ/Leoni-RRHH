import type { Eval360Filters } from "./types.ts";

export const EMPTY_EVAL360_FILTERS: Eval360Filters = {
  planta: "",
  departamento: "",
  area: "",
  puesto: "",
  turno: "",
  campana: "",
  periodo: "",
  estado: "",
};

export const FILTER_OPTIONS = {
  plantas: ["Hermosillo", "Durango"],
  departamentos: ["Producción", "Calidad", "Logística", "Mantenimiento", "Ingeniería", "RH"],
  areas: ["Cableado L1", "Cableado L3", "Ensamble L2", "Ensamble L5", "Prueba Eléctrica", "Calidad", "Mantenimiento", "Operaciones RH"],
  puestos: ["Supervisor de línea", "Supervisora de Calidad", "Coordinador", "Líder de área", "Analista RH", "Ingeniero de procesos"],
  turnos: ["Matutino", "Vespertino", "Mixto"],
  campanas: ["Evaluación Liderazgo Q2 2026", "Evaluación Anual 2025", "Onboarding Líderes Nuevos"],
  periodos: ["Q2 2026", "Q1 2026", "Q4 2025"],
  estados: ["completada", "en_progreso", "pendiente"],
} as const;

export function renderEval360Filters(filters: Eval360Filters): string {
  const select = (name: keyof Eval360Filters, label: string, options: readonly string[]) => `
    <div class="min-w-0 flex-1 basis-[calc(50%-0.375rem)] sm:basis-[calc(33.333%-0.5rem)] lg:basis-0 lg:min-w-[9rem]">
      <label class="mb-1 block text-xs font-medium text-text-muted">${label}</label>
      <select name="${name}" data-filter="${name}" class="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary">
        <option value="">Todos</option>
        ${options.map((o) => `<option value="${o}" ${filters[name] === o ? "selected" : ""}>${o}</option>`).join("")}
      </select>
    </div>`;

  return `
    <div class="rounded-xl border border-border bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div class="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 class="text-sm font-semibold text-text-primary">Filtros globales RH</h2>
          <p class="text-xs text-text-muted">Actualizan KPIs, gráficas, tablas y detalle individual</p>
        </div>
        <button type="button" class="text-xs font-semibold text-accent hover:underline" data-action="e360-clear-filters">Limpiar filtros</button>
      </div>
      <div class="flex flex-wrap gap-3">
        ${select("planta", "Planta", FILTER_OPTIONS.plantas)}
        ${select("departamento", "Departamento", FILTER_OPTIONS.departamentos)}
        ${select("area", "Área", FILTER_OPTIONS.areas)}
        ${select("puesto", "Puesto", FILTER_OPTIONS.puestos)}
        ${select("turno", "Turno", FILTER_OPTIONS.turnos)}
        ${select("campana", "Campaña", FILTER_OPTIONS.campanas)}
        ${select("periodo", "Periodo", FILTER_OPTIONS.periodos)}
        ${select("estado", "Estado de evaluación", FILTER_OPTIONS.estados)}
      </div>
    </div>`;
}

export function readEval360FiltersFromDom(root: ParentNode): Eval360Filters {
  const get = (name: keyof Eval360Filters) =>
    (root.querySelector<HTMLSelectElement>(`[data-filter="${name}"]`)?.value ?? "").trim();
  return {
    planta: get("planta"),
    departamento: get("departamento"),
    area: get("area"),
    puesto: get("puesto"),
    turno: get("turno"),
    campana: get("campana"),
    periodo: get("periodo"),
    estado: get("estado"),
  };
}

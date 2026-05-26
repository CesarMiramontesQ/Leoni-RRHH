import { mountAppShell } from "../layouts/appShell.ts";
import {
  getCompetencias,
  getCompetenciasFilterOptions,
  getMatrizData,
  updateMatrizBulk,
  getBrechas,
  createCompetencia,
  updateCompetencia,
  deleteCompetencia,
  getCompetenciaPuestos,
  type CompetenciasFetchError,
} from "../api/competencias.ts";
import type {
  BrechaItem,
  CeldaMatriz,
  Competencia,
  CompetenciaFila,
  CompetenciasFilterOptions,
  CompetenciasFilterState,
  CompetenciasTab,
  GapCritico,
  MatrizResumen,
  NivelMatriz,
  PuestoColumna,
} from "../dashboard/competencias/types.ts";
import { clearAuth } from "../auth/session.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_DANGER,
  FIELD_FOCUS,
  SELECT_CHEVRON,
} from "../ui/uiTokens.ts";

// ── Helpers ───────────────────────────────────────────────────────────

function nivelColorClass(nivel: NivelMatriz): string {
  switch (nivel) {
    case 0: return "bg-slate-100 text-slate-400";
    case 1: return "bg-red-50 text-red-700 border-red-200";
    case 2: return "bg-amber-50 text-amber-700 border-amber-200";
    case 3: return "bg-blue-50 text-blue-700 border-blue-200";
    case 4: return "bg-emerald-50 text-emerald-700 border-emerald-200";
    default: return "bg-slate-100 text-slate-400";
  }
}

function nivelLabel(nivel: NivelMatriz): string {
  switch (nivel) {
    case 0: return "N/A";
    case 1: return "Basico";
    case 2: return "Intermedio";
    case 3: return "Avanzado";
    case 4: return "Experto";
    default: return "—";
  }
}

function severidadBadge(sev: BrechaItem["severidad"]): string {
  switch (sev) {
    case "critica":
      return `<span class="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800"><span class="size-1.5 shrink-0 rounded-full bg-red-500" aria-hidden="true"></span>Critica</span>`;
    case "alta":
      return `<span class="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-800"><span class="size-1.5 shrink-0 rounded-full bg-orange-500" aria-hidden="true"></span>Alta</span>`;
    case "media":
      return `<span class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900"><span class="size-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true"></span>Media</span>`;
    case "baja":
      return `<span class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700"><span class="size-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden="true"></span>Baja</span>`;
  }
}

function grupoBadge(grupo: "tecnica" | "habilidad_blanda"): string {
  if (grupo === "tecnica") {
    return `<span class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">Tecnica</span>`;
  }
  return `<span class="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-800">Habilidad blanda</span>`;
}

// ── Tab rendering ─────────────────────────────────────────────────────

function renderTabs(active: CompetenciasTab): string {
  const tabs: Array<{ key: CompetenciasTab; label: string }> = [
    { key: "catalogo", label: "Catalogo" },
    { key: "matriz", label: "Matriz" },
    { key: "brechas", label: "Brechas" },
  ];
  return `
    <nav class="flex border-b border-slate-200" aria-label="Tabs de competencias">
      ${tabs.map((t) => {
        const isActive = t.key === active;
        const cls = isActive
          ? "border-b-2 border-leoni-blue px-4 py-2.5 text-sm font-semibold text-leoni-blue"
          : "border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700 cursor-pointer";
        return `<button type="button" data-action="tab" data-tab="${t.key}" class="${cls}">${escapeHtml(t.label)}</button>`;
      }).join("")}
    </nav>`;
}

// ── Catalogo tab ──────────────────────────────────────────────────────

function renderCatalogoTab(items: Competencia[], filterText: string): string {
  const filtered = filterText.trim()
    ? items.filter((c) => c.nombre.toLowerCase().includes(filterText.toLowerCase()) || c.descripcion.toLowerCase().includes(filterText.toLowerCase()))
    : items;

  const subcatLabels: Record<string, string> = {
    informatica: "Informatica", idiomas: "Idiomas", profesional: "Profesional",
    social: "Social", personal: "Personal", metodos: "Metodos", complementos: "Complementos",
  };

  const rows = filtered.length === 0
    ? `<tr><td colspan="5" class="px-4 py-10 text-center text-sm text-slate-500">No hay competencias registradas.</td></tr>`
    : filtered.map((c) => `
      <tr class="hover:bg-slate-50/80 transition-colors">
        <td class="px-4 py-3 text-sm font-medium text-slate-900">${escapeHtml(c.nombre)}</td>
        <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(c.descripcion)}</td>
        <td class="px-4 py-3">${grupoBadge(c.grupo)}</td>
        <td class="px-4 py-3 text-sm text-slate-600">${c.subcategoria ? escapeHtml(subcatLabels[c.subcategoria] ?? c.subcategoria) : `<span class="text-slate-400">—</span>`}</td>
        <td class="px-4 py-3 text-right">
          <button type="button" data-action="edit-competencia" data-id="${c.id}" class="mr-2 rounded p-1 text-slate-500 hover:text-leoni-blue" title="Editar">
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4"><path d="M5.433 13.917l1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" /></svg>
          </button>
          <button type="button" data-action="delete-competencia" data-id="${c.id}" class="rounded p-1 text-slate-500 hover:text-red-600" title="Eliminar">
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-4"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clip-rule="evenodd" /></svg>
          </button>
        </td>
      </tr>
    `).join("");

  return `
    <div class="flex flex-col gap-4">
      <!-- Filter bar + Add button -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="relative max-w-sm flex-1">
          <input
            type="text"
            id="comp-catalogo-search"
            data-action="catalogo-filter"
            placeholder="Buscar competencia..."
            value="${escapeHtml(filterText)}"
            class="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-9 text-sm text-slate-900 placeholder:text-slate-400 ${FIELD_FOCUS}"
          />
          <svg viewBox="0 0 20 20" fill="currentColor" class="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true">
            <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd" />
          </svg>
        </div>
        <button type="button" data-action="add-competencia" class="${BTN_PRIMARY}">
          <span aria-hidden="true">+</span> Nueva competencia
        </button>
      </div>

      <!-- Table -->
      <div class="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5">
        <div class="overflow-x-auto">
          <table class="min-w-full w-full text-left">
            <thead class="border-b border-slate-200 bg-slate-50">
              <tr>
                <th class="px-4 py-3 text-sm font-semibold text-slate-700">Nombre</th>
                <th class="px-4 py-3 text-sm font-semibold text-slate-700">Descripcion</th>
                <th class="px-4 py-3 text-sm font-semibold text-slate-700">Grupo</th>
                <th class="px-4 py-3 text-sm font-semibold text-slate-700">Subcategoría</th>
                <th class="px-4 py-3 text-right text-sm font-semibold text-slate-700">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">${rows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

// ── Matriz tab ────────────────────────────────────────────────────────

function renderMatrizFilters(filters: CompetenciasFilterState, options: CompetenciasFilterOptions): string {
  const areaOpts = `<option value="">Todas las areas</option>${options.areas.map((a) => `<option value="${escapeHtml(a.id)}" ${a.id === filters.area_id ? "selected" : ""}>${escapeHtml(a.label)}</option>`).join("")}`;
  const lineaOpts = `<option value="">Todas las lineas</option>${options.lineas.map((l) => `<option value="${escapeHtml(l.id)}" ${l.id === filters.linea_id ? "selected" : ""}>${escapeHtml(l.label)}</option>`).join("")}`;
  const sectorOpts = `<option value="">Todos los sectores</option>${options.sectores.map((s) => `<option value="${escapeHtml(s.id)}" ${s.id === filters.sector_id ? "selected" : ""}>${escapeHtml(s.label)}</option>`).join("")}`;

  return `
    <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
      <div class="min-w-[10rem] flex-1">
        <label class="block text-xs font-semibold text-slate-700 mb-1">Area</label>
        <div class="grid grid-cols-1">
          <select data-action="filter" data-filter="area" class="col-start-1 row-start-1 h-9 w-full appearance-none rounded-md border border-slate-200 bg-white py-1 pr-8 pl-2.5 text-sm text-slate-900 ${FIELD_FOCUS}">
            ${areaOpts}
          </select>
          ${SELECT_CHEVRON}
        </div>
      </div>
      <div class="min-w-[10rem] flex-1">
        <label class="block text-xs font-semibold text-slate-700 mb-1">Linea</label>
        <div class="grid grid-cols-1">
          <select data-action="filter" data-filter="linea" class="col-start-1 row-start-1 h-9 w-full appearance-none rounded-md border border-slate-200 bg-white py-1 pr-8 pl-2.5 text-sm text-slate-900 ${FIELD_FOCUS}">
            ${lineaOpts}
          </select>
          ${SELECT_CHEVRON}
        </div>
      </div>
      <div class="min-w-[10rem] flex-1">
        <label class="block text-xs font-semibold text-slate-700 mb-1">Sector</label>
        <div class="grid grid-cols-1">
          <select data-action="filter" data-filter="sector" class="col-start-1 row-start-1 h-9 w-full appearance-none rounded-md border border-slate-200 bg-white py-1 pr-8 pl-2.5 text-sm text-slate-900 ${FIELD_FOCUS}">
            ${sectorOpts}
          </select>
          ${SELECT_CHEVRON}
        </div>
      </div>
    </div>`;
}

function renderMatrizLegend(): string {
  const levels: NivelMatriz[] = [0, 1, 2, 3, 4];
  return `
    <div class="flex flex-wrap items-center gap-3 text-xs text-slate-600">
      <span class="font-semibold text-slate-700">Niveles:</span>
      ${levels.map((n) => `<span class="inline-flex items-center gap-1.5"><span class="inline-block size-5 rounded border text-center text-xs font-bold leading-5 ${nivelColorClass(n)}">${n}</span>${nivelLabel(n)}</span>`).join("")}
    </div>`;
}

function renderMatrizTable(
  competencias: CompetenciaFila[],
  puestos: PuestoColumna[],
  celdas: CeldaMatriz[],
  celdasModificadas: Map<string, NivelMatriz>,
): string {
  if (competencias.length === 0 || puestos.length === 0) {
    return `
      <div class="rounded-xl border border-dashed border-slate-300 bg-slate-50/40 py-8 text-center">
        <p class="text-sm font-semibold text-slate-800">Sin competencias configuradas</p>
        <p class="mt-1.5 text-xs text-slate-500">Selecciona un area o configura requisitos para esta combinacion.</p>
      </div>`;
  }

  // Build lookup: "comp_id:puesto_id" -> nivel
  const celdasMap = new Map<string, NivelMatriz>();
  for (const c of celdas) {
    celdasMap.set(`${c.competencia_id}:${c.puesto_id}`, c.nivel);
  }
  // Override with local modifications
  for (const [key, nivel] of celdasModificadas) {
    celdasMap.set(key, nivel);
  }

  const headerCols = puestos.map((p) =>
    `<th class="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-2 py-2.5 text-center text-xs font-semibold text-slate-700 whitespace-nowrap" title="${escapeHtml(p.nombre)}">${escapeHtml(p.abreviacion || p.nombre)}</th>`
  ).join("");

  const bodyRows = competencias.map((comp) => {
    const cells = puestos.map((p) => {
      const key = `${comp.id}:${p.id}`;
      const nivel = celdasMap.get(key) ?? 0;
      const isModified = celdasModificadas.has(key);
      const modifiedCls = isModified ? " ring-2 ring-amber-400 ring-inset" : "";
      return `<td
        data-action="cell-edit"
        data-comp-id="${escapeHtml(comp.id)}"
        data-puesto-id="${escapeHtml(p.id)}"
        data-nivel="${nivel}"
        class="border border-slate-100 px-2 py-2 text-center cursor-pointer transition hover:bg-slate-100${modifiedCls}"
        title="${escapeHtml(comp.nombre)} / ${escapeHtml(p.nombre)} — Nivel ${nivel}"
      >
        <span class="inline-flex size-7 items-center justify-center rounded text-xs font-bold ${nivelColorClass(nivel as NivelMatriz)}">${nivel}</span>
      </td>`;
    }).join("");
    return `<tr>
      <td class="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 whitespace-nowrap">${escapeHtml(comp.nombre)}</td>
      ${cells}
    </tr>`;
  }).join("");

  return `
    <div class="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5">
      <div class="max-h-[min(65vh,600px)] overflow-auto">
        <table class="min-w-full w-full border-collapse text-left">
          <thead>
            <tr>
              <th class="sticky left-0 top-0 z-20 border-b border-r border-slate-200 bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-700">Competencia</th>
              ${headerCols}
            </tr>
          </thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
    </div>`;
}

function renderMatrizResumen(resumen: MatrizResumen | null): string {
  if (!resumen) return "";
  const pct = resumen.porcentaje_cumplimiento;
  const pctColor = pct >= 80 ? "text-emerald-700" : pct >= 60 ? "text-amber-700" : "text-red-700";
  return `
    <div class="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
      <h3 class="text-sm font-semibold text-slate-700">Resumen</h3>
      <div class="mt-3 space-y-2">
        <div class="flex items-baseline justify-between">
          <span class="text-xs text-slate-500">Cumplimiento</span>
          <span class="text-lg font-bold tabular-nums ${pctColor}">${pct}%</span>
        </div>
        <div class="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div class="h-full rounded-full ${pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-400" : "bg-red-500"}" style="width: ${Math.min(pct, 100)}%"></div>
        </div>
        <div class="flex items-baseline justify-between text-xs text-slate-500">
          <span>Empleados: <strong class="text-slate-700">${resumen.total_empleados}</strong></span>
          <span>Requisitos: <strong class="text-slate-700">${resumen.total_requisitos}</strong></span>
        </div>
      </div>
    </div>`;
}

function renderMatrizGapsPanel(gaps: GapCritico[]): string {
  if (gaps.length === 0) {
    return `
      <div class="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <h3 class="text-sm font-semibold text-slate-700">Gaps Criticos</h3>
        <p class="mt-3 text-xs text-slate-500">No se detectaron brechas criticas.</p>
      </div>`;
  }
  const rows = gaps.slice(0, 5).map((g) => `
    <div class="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
      <span class="mt-0.5 size-2 shrink-0 rounded-full bg-red-500" aria-hidden="true"></span>
      <div class="min-w-0 flex-1">
        <p class="text-xs font-semibold text-slate-800 truncate">${escapeHtml(g.competencia_nombre)}</p>
        <p class="text-xs text-slate-500 truncate">${escapeHtml(g.puesto_nombre)} — ${g.empleados_afectados} empleados</p>
        <p class="text-xs text-red-600 font-medium">Brecha: ${g.porcentaje_brecha}%</p>
      </div>
    </div>
  `).join("");
  return `
    <div class="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
      <h3 class="text-sm font-semibold text-slate-700">Gaps Criticos</h3>
      <div class="mt-3 flex flex-col gap-2">${rows}</div>
    </div>`;
}

function renderMatrizTab(
  filters: CompetenciasFilterState,
  filterOptions: CompetenciasFilterOptions,
  competencias: CompetenciaFila[],
  puestos: PuestoColumna[],
  celdas: CeldaMatriz[],
  celdasModificadas: Map<string, NivelMatriz>,
  resumen: MatrizResumen | null,
  gaps: GapCritico[],
): string {
  return `
    <div class="flex flex-col gap-4">
      <!-- Filters -->
      ${renderMatrizFilters(filters, filterOptions)}

      <!-- Save button -->
      <div class="flex items-center justify-between">
        ${renderMatrizLegend()}
        <div class="flex items-center gap-2">
          ${celdasModificadas.size > 0 ? `<span class="text-xs font-semibold text-amber-700">${celdasModificadas.size} cambio${celdasModificadas.size > 1 ? "s" : ""} sin guardar</span>` : ""}
          <button type="button" data-action="save-matriz" class="${BTN_PRIMARY}" ${celdasModificadas.size === 0 ? "disabled" : ""}>
            Guardar Cambios
          </button>
        </div>
      </div>

      <!-- Matrix + sidebar -->
      <div class="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div class="xl:col-span-3">
          ${renderMatrizTable(competencias, puestos, celdas, celdasModificadas)}
        </div>
        <div class="flex flex-col gap-4 xl:col-span-1">
          ${renderMatrizResumen(resumen)}
          ${renderMatrizGapsPanel(gaps)}
        </div>
      </div>
    </div>`;
}

// ── Brechas tab ───────────────────────────────────────────────────────

function renderBrechasTab(brechas: BrechaItem[], filters: CompetenciasFilterState, filterOptions: CompetenciasFilterOptions): string {
  const areaOpts = `<option value="">Todas las areas</option>${filterOptions.areas.map((a) => `<option value="${escapeHtml(a.id)}" ${a.id === filters.area_id ? "selected" : ""}>${escapeHtml(a.label)}</option>`).join("")}`;

  const rows = brechas.length === 0
    ? `<tr><td colspan="6" class="px-4 py-10 text-center text-sm text-slate-500">No se detectaron brechas para el area seleccionada.</td></tr>`
    : brechas.map((b) => `
      <tr class="hover:bg-slate-50/80 transition-colors">
        <td class="px-4 py-3 text-sm font-medium text-slate-900">${escapeHtml(b.competencia_nombre)}</td>
        <td class="px-4 py-3 text-sm text-slate-600">${escapeHtml(b.puesto_nombre)}</td>
        <td class="px-4 py-3 text-sm tabular-nums text-slate-600">${b.nivel_actual_promedio.toFixed(1)}</td>
        <td class="px-4 py-3 text-sm tabular-nums text-slate-600">${b.nivel_requerido}</td>
        <td class="px-4 py-3 text-sm font-semibold tabular-nums ${b.porcentaje_brecha >= 50 ? "text-red-700" : "text-amber-700"}">${b.porcentaje_brecha}%</td>
        <td class="px-4 py-3">${severidadBadge(b.severidad)}</td>
      </tr>
    `).join("");

  return `
    <div class="flex flex-col gap-4">
      <!-- Area filter -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3">
        <div class="min-w-[12rem] max-w-xs">
          <label class="block text-xs font-semibold text-slate-700 mb-1">Filtrar por area</label>
          <div class="grid grid-cols-1">
            <select data-action="filter-brechas" class="col-start-1 row-start-1 h-9 w-full appearance-none rounded-md border border-slate-200 bg-white py-1 pr-8 pl-2.5 text-sm text-slate-900 ${FIELD_FOCUS}">
              ${areaOpts}
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
      </div>

      <!-- Table -->
      <div class="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-900/5">
        <div class="overflow-x-auto">
          <table class="min-w-full w-full text-left">
            <thead class="border-b border-slate-200 bg-slate-50">
              <tr>
                <th class="px-4 py-3 text-sm font-semibold text-slate-700">Competencia</th>
                <th class="px-4 py-3 text-sm font-semibold text-slate-700">Puesto</th>
                <th class="px-4 py-3 text-sm font-semibold text-slate-700">Nivel actual</th>
                <th class="px-4 py-3 text-sm font-semibold text-slate-700">Requerido</th>
                <th class="px-4 py-3 text-sm font-semibold text-slate-700">Brecha %</th>
                <th class="px-4 py-3 text-sm font-semibold text-slate-700">Severidad</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">${rows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

// ── Loading / Error ───────────────────────────────────────────────────

function renderLoading(): string {
  return `
    <div class="flex flex-col gap-4">
      <div class="h-10 w-64 animate-pulse rounded-lg bg-slate-200"></div>
      <div class="h-48 w-full animate-pulse rounded-lg bg-slate-100"></div>
      <div class="h-48 w-full animate-pulse rounded-lg bg-slate-100"></div>
    </div>`;
}

function renderError(message: string | null): string {
  return `
    <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
      <p class="font-semibold">Error al cargar datos</p>
      <p class="mt-1">${escapeHtml(message || "Error inesperado")}</p>
      <button type="button" data-action="retry" class="${BTN_SECONDARY} mt-3">Reintentar</button>
    </div>`;
}

// ── Modal inline (crear / editar competencia) ─────────────────────────

function renderCompetenciaModal(comp: Competencia | null): string {
  const isEdit = comp !== null;
  const title = isEdit ? "Editar Competencia" : "Nueva Competencia";
  const nombre = comp?.nombre ?? "";
  const descripcion = comp?.descripcion ?? "";
  const grupo = comp?.grupo ?? "tecnica";
  const subcategoria = comp?.subcategoria ?? "";

  const subcatOptions = [
    { value: "", label: "Sin subcategoría" },
    { value: "informatica", label: "Informatica" },
    { value: "idiomas", label: "Idiomas" },
    { value: "profesional", label: "Profesional" },
    { value: "social", label: "Social" },
    { value: "personal", label: "Personal" },
    { value: "metodos", label: "Metodos" },
    { value: "complementos", label: "Complementos" },
  ];

  return `
    <div id="comp-modal-backdrop" data-action="close-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl" data-modal-inner>
        <h2 class="text-lg font-semibold text-slate-900">${title}</h2>
        <form id="comp-modal-form" class="mt-4 flex flex-col gap-4">
          ${isEdit ? `<input type="hidden" name="id" value="${comp.id}" />` : ""}
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
            <input type="text" name="nombre" value="${escapeHtml(nombre)}" required
              class="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm ${FIELD_FOCUS}" />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Descripcion</label>
            <textarea name="descripcion" rows="3" required
              class="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm ${FIELD_FOCUS}">${escapeHtml(descripcion)}</textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Grupo</label>
            <div class="grid grid-cols-1">
              <select name="grupo" class="col-start-1 row-start-1 h-9 w-full appearance-none rounded-md border border-slate-200 bg-white py-1 pr-8 pl-2.5 text-sm text-slate-900 ${FIELD_FOCUS}">
                <option value="tecnica" ${grupo === "tecnica" ? "selected" : ""}>Tecnica</option>
                <option value="habilidad_blanda" ${grupo === "habilidad_blanda" ? "selected" : ""}>Habilidad blanda</option>
              </select>
              ${SELECT_CHEVRON}
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Subcategoría</label>
            <div class="grid grid-cols-1">
              <select name="subcategoria" class="col-start-1 row-start-1 h-9 w-full appearance-none rounded-md border border-slate-200 bg-white py-1 pr-8 pl-2.5 text-sm text-slate-900 ${FIELD_FOCUS}">
                ${subcatOptions.map((o) => `<option value="${o.value}" ${subcategoria === o.value ? "selected" : ""}>${escapeHtml(o.label)}</option>`).join("")}
              </select>
              ${SELECT_CHEVRON}
            </div>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" data-action="close-modal" class="${BTN_SECONDARY}">Cancelar</button>
            <button type="submit" class="${BTN_PRIMARY}">${isEdit ? "Guardar" : "Crear"}</button>
          </div>
        </form>
      </div>
    </div>`;
}

// ── Page mount ────────────────────────────────────────────────────────

export function mountCompetencias(container: HTMLElement, signal: AbortSignal): void {
  // State
  let status: "loading" | "ready" | "error" = "loading";
  let activeTab: CompetenciasTab = "catalogo";
  let catalogoItems: Competencia[] = [];
  let catalogoFilter = "";
  let filters: CompetenciasFilterState = { area_id: "", linea_id: "", sector_id: "" };
  let filterOptions: CompetenciasFilterOptions = { areas: [], lineas: [], sectores: [] };
  let puestos: PuestoColumna[] = [];
  let competencias: CompetenciaFila[] = [];
  let celdas: CeldaMatriz[] = [];
  let celdasModificadas = new Map<string, NivelMatriz>();
  let resumen: MatrizResumen | null = null;
  let gaps: GapCritico[] = [];
  let brechas: BrechaItem[] = [];
  let errorMessage: string | null = null;
  let editingCompetencia: Competencia | null = null;
  let showModal = false;

  mountAppShell(container, {
    pageTitle: "Matriz de Competencias",
    activeNav: "empleados",
    mainClass: "py-5 sm:py-6",
    mainHtml: `<div id="competencias-page-root" class="flex min-h-0 flex-1 flex-col gap-4 sm:gap-5">
      <div id="competencias-inner">${renderLoading()}</div>
      <div id="comp-modal-host"></div>
      <div id="comp-delete-modal-host"></div>
    </div>`,
  });

  function paint(): void {
    const inner = container.querySelector("#competencias-inner");
    if (!inner) return;

    if (status === "loading") {
      inner.innerHTML = renderLoading();
      return;
    }
    if (status === "error") {
      inner.innerHTML = renderError(errorMessage);
      return;
    }

    let tabContent = "";
    switch (activeTab) {
      case "catalogo":
        tabContent = renderCatalogoTab(catalogoItems, catalogoFilter);
        break;
      case "matriz":
        tabContent = renderMatrizTab(filters, filterOptions, competencias, puestos, celdas, celdasModificadas, resumen, gaps);
        break;
      case "brechas":
        tabContent = renderBrechasTab(brechas, filters, filterOptions);
        break;
    }

    inner.innerHTML = `
      <!-- Breadcrumb -->
      <nav class="text-xs text-slate-500" aria-label="Breadcrumb">
        <ol class="flex items-center gap-1">
          <li><a href="#/" class="hover:text-leoni-blue">Inicio</a></li>
          <li><span class="mx-1">/</span></li>
          <li class="font-semibold text-slate-800">Competencias</li>
        </ol>
      </nav>

      <!-- Header -->
      <div class="flex flex-col gap-1">
        <h1 class="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Matriz de Competencias</h1>
        <p class="text-sm text-slate-500">Administra el catalogo, niveles requeridos por puesto y detecta brechas.</p>
      </div>

      <!-- Tabs -->
      ${renderTabs(activeTab)}

      <!-- Tab content -->
      <div class="mt-1">${tabContent}</div>
    `;
  }

  function paintModal(): void {
    const host = container.querySelector("#comp-modal-host");
    if (!host) return;
    if (!showModal) {
      host.innerHTML = "";
      return;
    }
    host.innerHTML = renderCompetenciaModal(editingCompetencia);
  }

  function showDeleteConfirmModal(id: number, nombre: string, puestos: { id: number; codigo: string; nombre: string }[]): void {
    const host = container.querySelector("#comp-delete-modal-host");
    if (!host) return;

    const puestosHtml = puestos.length === 0
      ? `<p class="text-sm text-slate-500 italic">No está asociada a ningún perfil de puesto.</p>`
      : `<p class="text-sm text-slate-600 mb-2">Se eliminará de <strong>${puestos.length}</strong> perfil${puestos.length !== 1 ? "es" : ""} de puesto:</p>
         <ul class="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2">
           ${puestos.map(p => `<li class="flex items-center gap-2 text-sm text-slate-700 py-1"><span class="font-mono text-xs text-slate-400">${escapeHtml(p.codigo)}</span> ${escapeHtml(p.nombre)}</li>`).join("")}
         </ul>`;

    host.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div class="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
          <h3 class="text-base font-semibold text-slate-900 mb-3">Eliminar competencia</h3>
          <p class="text-sm text-slate-700 mb-3">¿Eliminar <strong>${escapeHtml(nombre)}</strong> del catálogo?</p>
          ${puestosHtml}
          <div class="mt-4 flex justify-end gap-2">
            <button type="button" data-action="cancel-delete-competencia" class="${BTN_SECONDARY}">Cancelar</button>
            <button type="button" data-action="confirm-delete-competencia" data-id="${id}" class="${BTN_DANGER}">Eliminar</button>
          </div>
        </div>
      </div>`;
  }

  function closeDeleteConfirmModal(): void {
    const host = container.querySelector("#comp-delete-modal-host");
    if (host) host.innerHTML = "";
  }

  function handleSessionExpired(): void {
    clearAuth();
    void import("../shellRouter.ts").then(({ abortAuthenticatedShell }) => {
      abortAuthenticatedShell();
      void import("./login.ts").then(({ mountLogin }) => mountLogin(container));
    });
  }

  async function loadCatalogo(): Promise<void> {
    try {
      catalogoItems = await getCompetencias();
    } catch (e: unknown) {
      const err = e as CompetenciasFetchError;
      if (err?.status === 401) { handleSessionExpired(); return; }
      // silent fail on catalogo, keep empty
    }
  }

  async function loadMatriz(): Promise<void> {
    try {
      const [opts, data] = await Promise.all([
        getCompetenciasFilterOptions(),
        getMatrizData(filters),
      ]);
      filterOptions = opts;
      puestos = data.puestos;
      competencias = data.competencias;
      celdas = data.celdas;
      resumen = data.resumen;
      gaps = data.gaps;
    } catch (e: unknown) {
      const err = e as CompetenciasFetchError;
      if (err?.status === 401) { handleSessionExpired(); return; }
      // keep existing data
    }
  }

  async function loadBrechas(): Promise<void> {
    try {
      brechas = await getBrechas(filters.area_id || undefined);
    } catch (e: unknown) {
      const err = e as CompetenciasFetchError;
      if (err?.status === 401) { handleSessionExpired(); return; }
    }
  }

  async function init(): Promise<void> {
    status = "loading";
    paint();
    try {
      const [opts] = await Promise.all([
        getCompetenciasFilterOptions(),
        loadCatalogo(),
      ]);
      filterOptions = opts;
      status = "ready";
    } catch (e: unknown) {
      const err = e as CompetenciasFetchError;
      if (err?.status === 401) { handleSessionExpired(); return; }
      status = "error";
      errorMessage = (e as CompetenciasFetchError)?.detail || "Error de conexion.";
    }
    paint();
  }

  // ── Event delegation ────────────────────────────────────────────────

  const root = container.querySelector("#competencias-page-root");
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  root?.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;

    // Tab switch
    const tabBtn = t.closest<HTMLButtonElement>("[data-action='tab']");
    if (tabBtn) {
      const tab = tabBtn.getAttribute("data-tab") as CompetenciasTab;
      if (tab && tab !== activeTab) {
        activeTab = tab;
        if (tab === "matriz" && competencias.length === 0) {
          void loadMatriz().then(() => paint());
        } else if (tab === "brechas" && brechas.length === 0) {
          void loadBrechas().then(() => paint());
        } else {
          paint();
        }
      }
      return;
    }

    // Add competencia
    if (t.closest("[data-action='add-competencia']")) {
      editingCompetencia = null;
      showModal = true;
      paintModal();
      return;
    }

    // Edit competencia
    const editBtn = t.closest<HTMLElement>("[data-action='edit-competencia']");
    if (editBtn) {
      const id = Number.parseInt(editBtn.getAttribute("data-id") ?? "", 10);
      const comp = catalogoItems.find((c) => c.id === id);
      if (comp) {
        editingCompetencia = comp;
        showModal = true;
        paintModal();
      }
      return;
    }

    // Delete competencia — show confirmation with affected puestos
    const delBtn = t.closest<HTMLElement>("[data-action='delete-competencia']");
    if (delBtn) {
      const id = Number.parseInt(delBtn.getAttribute("data-id") ?? "", 10);
      if (!Number.isFinite(id)) return;
      void (async () => {
        try {
          const puestos = await getCompetenciaPuestos(id);
          const comp = catalogoItems.find(c => c.id === id);
          const nombre = comp?.nombre ?? "esta competencia";
          showDeleteConfirmModal(id, nombre, puestos);
        } catch (err: unknown) {
          const fe = err as CompetenciasFetchError;
          if (fe?.status === 401) { handleSessionExpired(); return; }
          alert(fe?.detail || "Error al consultar puestos asociados");
        }
      })();
      return;
    }

    // Confirm delete from modal
    const confirmDelBtn = t.closest<HTMLElement>("[data-action='confirm-delete-competencia']");
    if (confirmDelBtn) {
      const id = Number.parseInt(confirmDelBtn.getAttribute("data-id") ?? "", 10);
      if (!Number.isFinite(id)) return;
      confirmDelBtn.setAttribute("disabled", "true");
      confirmDelBtn.textContent = "Eliminando...";
      void (async () => {
        try {
          await deleteCompetencia(id);
          closeDeleteConfirmModal();
          await loadCatalogo();
          paint();
        } catch (err: unknown) {
          const fe = err as CompetenciasFetchError;
          if (fe?.status === 401) { handleSessionExpired(); return; }
          alert(fe?.detail || "Error al eliminar");
          confirmDelBtn.removeAttribute("disabled");
          confirmDelBtn.textContent = "Eliminar";
        }
      })();
      return;
    }

    // Cancel delete from modal
    const cancelDelBtn = t.closest<HTMLElement>("[data-action='cancel-delete-competencia']");
    if (cancelDelBtn) {
      closeDeleteConfirmModal();
      return;
    }

    // Close modal (button click or direct backdrop click)
    const closeBtn = t.closest<HTMLElement>("[data-action='close-modal']");
    if (closeBtn) {
      // If backdrop was clicked, only close if click was directly on backdrop (not inner content)
      if (closeBtn.id === "comp-modal-backdrop" && t.closest("[data-modal-inner]")) {
        // Click was inside modal content, ignore
      } else {
        showModal = false;
        paintModal();
      }
      return;
    }

    // Cell edit
    const cellEl = t.closest<HTMLElement>("[data-action='cell-edit']");
    if (cellEl) {
      const compId = cellEl.getAttribute("data-comp-id");
      const puestoId = cellEl.getAttribute("data-puesto-id");
      const currentNivel = Number.parseInt(cellEl.getAttribute("data-nivel") ?? "0", 10);
      if (!compId || !puestoId) return;

      // Replace content with input
      cellEl.innerHTML = `<input type="number" min="0" max="4" value="${currentNivel}" data-action="cell-input" data-comp-id="${escapeHtml(compId)}" data-puesto-id="${escapeHtml(puestoId)}" class="w-10 h-7 rounded border border-leoni-blue bg-white text-center text-sm font-bold text-slate-900 ${FIELD_FOCUS}" autofocus />`;
      const inp = cellEl.querySelector("input");
      inp?.focus();
      inp?.select();
      return;
    }

    // Save matriz
    if (t.closest("[data-action='save-matriz']")) {
      if (celdasModificadas.size === 0) return;
      void (async () => {
        const cambios = Array.from(celdasModificadas.entries()).map(([key, nivel]) => {
          const [competencia_id, puesto_id] = key.split(":");
          return { competencia_id, puesto_id, nivel };
        });
        try {
          await updateMatrizBulk({ cambios });
          celdasModificadas = new Map();
          const matrizData = await getMatrizData(filters);
          celdas = matrizData.celdas;
          competencias = matrizData.competencias;
          puestos = matrizData.puestos;
          resumen = matrizData.resumen;
          gaps = matrizData.gaps;
          paint();
        } catch (err: unknown) {
          const fe = err as CompetenciasFetchError;
          if (fe?.status === 401) { handleSessionExpired(); return; }
          alert(fe?.detail || "Error al guardar");
        }
      })();
      return;
    }

    // Retry
    if (t.closest("[data-action='retry']")) {
      void init();
      return;
    }
  }, { signal });

  // Input / change events
  root?.addEventListener("input", (e) => {
    const t = e.target as HTMLElement;

    // Catalogo search
    if (t.id === "comp-catalogo-search" || t.closest("[data-action='catalogo-filter']")) {
      clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => {
        catalogoFilter = (t as HTMLInputElement).value;
        paint();
      }, 250);
      return;
    }
  }, { signal });

  root?.addEventListener("change", (e) => {
    const t = e.target as HTMLElement;

    // Matriz filters
    const filterSelect = t.closest<HTMLSelectElement>("[data-action='filter']");
    if (filterSelect) {
      const filterKey = filterSelect.getAttribute("data-filter");
      const value = filterSelect.value;
      if (filterKey === "area") filters.area_id = value;
      else if (filterKey === "linea") filters.linea_id = value;
      else if (filterKey === "sector") filters.sector_id = value;
      void (async () => {
        await loadMatriz();
        paint();
      })();
      return;
    }

    // Brechas filter
    const brechasFilter = t.closest<HTMLSelectElement>("[data-action='filter-brechas']");
    if (brechasFilter) {
      filters.area_id = brechasFilter.value;
      void (async () => {
        await loadBrechas();
        paint();
      })();
      return;
    }
  }, { signal });

  // Cell input blur/keydown (commit cell value)
  root?.addEventListener("focusout", (e) => {
    const inp = (e.target as HTMLElement).closest<HTMLInputElement>("[data-action='cell-input']");
    if (!inp) return;
    commitCellInput(inp);
  }, { signal });

  root?.addEventListener("keydown", (e) => {
    const ke = e as KeyboardEvent;
    if (ke.key === "Escape" && showModal) {
      ke.preventDefault();
      showModal = false;
      paintModal();
      return;
    }
    const inp = (ke.target as HTMLElement).closest<HTMLInputElement>("[data-action='cell-input']");
    if (!inp) return;
    if (ke.key === "Enter") {
      ke.preventDefault();
      commitCellInput(inp);
    }
    if (ke.key === "Escape") {
      ke.preventDefault();
      paint(); // revert
    }
  }, { signal });

  function commitCellInput(inp: HTMLInputElement): void {
    const compId = inp.getAttribute("data-comp-id");
    const puestoId = inp.getAttribute("data-puesto-id");
    if (!compId || !puestoId) return;
    let val = Number.parseInt(inp.value, 10);
    if (Number.isNaN(val) || val < 0) val = 0;
    if (val > 4) val = 4;
    const key = `${compId}:${puestoId}`;
    celdasModificadas.set(key, val as NivelMatriz);
    paint();
  }

  // Modal form submit
  container.addEventListener("submit", (e) => {
    const form = (e.target as HTMLElement).closest("#comp-modal-form");
    if (!form) return;
    e.preventDefault();
    const fd = new FormData(form as HTMLFormElement);
    const nombre = (fd.get("nombre") as string)?.trim();
    const descripcion = (fd.get("descripcion") as string)?.trim();
    const grupo = fd.get("grupo") as "tecnica" | "habilidad_blanda";
    const subcategoria = (fd.get("subcategoria") as string) || undefined;
    const idRaw = fd.get("id") as string | null;

    if (!nombre || !descripcion) return;

    void (async () => {
      try {
        if (idRaw) {
          const id = Number.parseInt(idRaw, 10);
          await updateCompetencia(id, { nombre, descripcion, grupo, subcategoria });
        } else {
          await createCompetencia({ nombre, descripcion, grupo, subcategoria });
        }
        showModal = false;
        paintModal();
        await loadCatalogo();
        paint();
      } catch (err: unknown) {
        const fe = err as CompetenciasFetchError;
        if (fe?.status === 401) { handleSessionExpired(); return; }
        alert(fe?.detail || "Error al guardar");
      }
    })();
  }, { signal });

  // Cleanup
  signal.addEventListener("abort", () => {
    clearTimeout(searchTimer);
  });

  // Init
  void init();
}

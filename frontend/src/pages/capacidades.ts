import { mountAppShell } from "../layouts/appShell.ts";
import {
  getMultihabilidadesPuestos,
  getMultihabilidadesData,
  type MultihabilidadesPuestoOption,
  type MultihabilidadesCompetencia,
  type MultihabilidadesEmpleado,
  type MultihabilidadesResponse,
} from "../api/competencias.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import { FIELD_FOCUS, SELECT_CHEVRON, FILTER_FIELD_WRAP } from "../ui/uiTokens.ts";

// ── Color helpers ────────────────────────────────────────────────────────────

function capCellColor(level: number): string {
  if (level === 0) return "bg-slate-50 text-slate-400";
  if (level === 1) return "bg-red-100 text-red-900";
  if (level === 2) return "bg-orange-100 text-orange-900";
  if (level === 3) return "bg-amber-100 text-amber-900";
  return "bg-emerald-100 text-emerald-900";
}

function capCellBorder(level: number, required: number): string {
  if (required > 0 && level < required) return "ring-1 ring-inset ring-red-300";
  return "";
}

// ── Render helpers ───────────────────────────────────────────────────────────

function renderLoading(): string {
  return `
  <div class="flex items-center justify-center py-24">
    <div class="flex flex-col items-center gap-3">
      <div class="size-8 animate-spin rounded-full border-2 border-slate-200 border-t-leoni-blue"></div>
      <p class="text-sm text-text-muted">Cargando datos&hellip;</p>
    </div>
  </div>`;
}

function renderError(msg: string): string {
  return `
  <div class="flex items-center justify-center py-24">
    <div class="flex flex-col items-center gap-3 text-center">
      <svg class="size-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
      <p class="text-sm text-red-700">${escapeHtml(msg)}</p>
      <button data-action="retry" class="mt-2 text-xs font-semibold text-leoni-blue hover:underline">Reintentar</button>
    </div>
  </div>`;
}

function renderEmptyState(): string {
  return `
  <div class="flex items-center justify-center py-24">
    <div class="flex flex-col items-center gap-3 text-center max-w-sm">
      <svg class="size-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"/></svg>
      <p class="text-sm font-medium text-slate-700">Selecciona un puesto para ver la matriz</p>
      <p class="text-xs text-slate-500">Elige un puesto del selector para visualizar las competencias requeridas y el nivel actual de cada colaborador asignado.</p>
    </div>
  </div>`;
}

function renderFilters(
  puestos: MultihabilidadesPuestoOption[],
  selectedId: number | null,
  searchValue: string,
): string {
  const options = puestos.map(p =>
    `<option value="${p.id}" ${p.id === selectedId ? "selected" : ""}>${escapeHtml(p.nombre)} (${p.num_empleados} emp.)</option>`
  ).join("");

  return `
  <div class="flex flex-wrap items-end gap-3">
    <div class="${FILTER_FIELD_WRAP}">
      <label class="block text-xs font-semibold text-slate-600 mb-1">Puesto</label>
      <div class="grid grid-cols-1">
        <select data-action="select-puesto" class="col-start-1 row-start-1 w-full appearance-none rounded-lg border-0 bg-white py-2 pl-3 pr-8 text-sm text-slate-900 shadow-sm ${FIELD_FOCUS}">
          <option value="">— Seleccionar puesto —</option>
          ${options}
        </select>
        ${SELECT_CHEVRON}
      </div>
    </div>
    <div class="${FILTER_FIELD_WRAP}">
      <label class="block text-xs font-semibold text-slate-600 mb-1">Buscar empleado</label>
      <input data-action="search-empleado" type="text" value="${escapeHtml(searchValue)}" placeholder="Nombre del colaborador&hellip;"
        class="w-full rounded-lg border-0 bg-white py-2 pl-3 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 ${FIELD_FOCUS}" />
    </div>
  </div>`;
}

function renderKpis(
  competencias: MultihabilidadesCompetencia[],
  empleados: MultihabilidadesEmpleado[],
): string {
  const numCaps = competencias.length;
  const numEvals = empleados.length;
  let totalLevel = 0;
  let totalCells = 0;
  let brechas = 0;

  for (const emp of empleados) {
    for (const comp of competencias) {
      const nivel = emp.niveles[comp.competencia_id] ?? 0;
      totalLevel += nivel;
      totalCells++;
      if (comp.nivel_requerido > 0 && nivel < comp.nivel_requerido) brechas++;
    }
  }

  const promedio = totalCells > 0 ? (totalLevel / totalCells).toFixed(1) : "0.0";

  const items = [
    { label: "Competencias", value: String(numCaps), sub: "Requeridas para este puesto" },
    { label: "Personas evaluadas", value: String(numEvals), sub: "Asignadas al puesto" },
    { label: "Nivel promedio", value: promedio, sup: "/4", sub: "Todos los colaboradores" },
    { label: "Brechas activas", value: String(brechas), sub: "Celdas debajo del requerido" },
  ];

  return `
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    ${items.map(k => `
      <div class="rounded-xl border border-border bg-white p-4 shadow-sm">
        <p class="text-xs font-medium text-text-muted">${escapeHtml(k.label)}</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-text-primary">${k.value}${k.sup ? `<span class="text-sm font-medium text-slate-400">${k.sup}</span>` : ""}</p>
        <p class="mt-0.5 text-[11px] text-slate-500">${escapeHtml(k.sub)}</p>
      </div>
    `).join("")}
  </div>`;
}

function renderLegend(): string {
  return `
  <div class="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-slate-50 px-4 py-2.5 text-[11px]">
    <span class="font-semibold text-slate-600">Nivel de dominio</span>
    <span class="flex items-center gap-1.5"><span class="inline-block h-3.5 w-5 rounded bg-red-100" aria-hidden="true"></span>1 &ndash; B&aacute;sico</span>
    <span class="flex items-center gap-1.5"><span class="inline-block h-3.5 w-5 rounded bg-orange-100" aria-hidden="true"></span>2 &ndash; Intermedio</span>
    <span class="flex items-center gap-1.5"><span class="inline-block h-3.5 w-5 rounded bg-amber-100" aria-hidden="true"></span>3 &ndash; Avanzado</span>
    <span class="flex items-center gap-1.5"><span class="inline-block h-3.5 w-5 rounded bg-emerald-100" aria-hidden="true"></span>4 &ndash; Experto</span>
    <span class="flex items-center gap-1.5"><span class="inline-block h-3.5 w-5 rounded bg-slate-50 ring-1 ring-inset ring-slate-200" aria-hidden="true"></span>0 &ndash; Sin evaluar</span>
    <span class="flex items-center gap-1.5"><span class="inline-block h-3.5 w-5 rounded bg-white ring-1 ring-inset ring-red-300" aria-hidden="true"></span>Debajo del requerido</span>
  </div>`;
}

function renderHeatmap(
  competencias: MultihabilidadesCompetencia[],
  empleados: MultihabilidadesEmpleado[],
): string {
  if (empleados.length === 0) {
    return `
    <div class="rounded-2xl border border-border bg-white p-8 text-center">
      <p class="text-sm text-slate-500">No hay colaboradores asignados a este puesto.</p>
    </div>`;
  }

  const nivelNames = ["—", "Básico", "Intermedio", "Avanzado", "Experto"];
  const colHeaders = competencias.map(c => {
    const reqLabel = nivelNames[c.nivel_requerido] ?? "—";
    const catLabel = c.subcategoria ? c.subcategoria.charAt(0).toUpperCase() + c.subcategoria.slice(1) : "General";
    return `<th class="px-1 py-2 text-center align-bottom cursor-help" data-tooltip-name="${escapeHtml(c.competencia_nombre)}" data-tooltip-cat="${escapeHtml(catLabel)}" data-tooltip-req="${escapeHtml(reqLabel)}">
      <div class="flex flex-col items-center gap-0.5">
        <span class="text-[10px] font-semibold leading-tight text-slate-700 [writing-mode:vertical-rl] rotate-180 h-16">${escapeHtml(c.competencia_nombre)}</span>
      </div>
    </th>`;
  }).join("");


  const empRows = empleados.map(emp => {
    let scoreSum = 0;
    let scoreCount = 0;

    const cells = competencias.map(comp => {
      const nivel = emp.niveles[comp.competencia_id] ?? 0;
      const req = comp.nivel_requerido;
      if (nivel > 0) {
        scoreSum += nivel;
        scoreCount++;
      }
      const color = capCellColor(nivel);
      const border = capCellBorder(nivel, req);
      return `<td class="px-1 py-1 text-center"><span class="inline-flex size-7 items-center justify-center rounded text-[11px] font-semibold tabular-nums ${color} ${border}">${nivel}</span></td>`;
    }).join("");

    const score = scoreCount > 0 ? Math.round((scoreSum / (scoreCount * 4)) * 100) : 0;
    const scoreTone = score >= 90 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : score >= 75 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-800";
    const initials = emp.nombre.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
    const noEmpDisplay = emp.no_empleado.replace(/\.0$/, "");

    return `
    <tr class="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
      <td class="sticky left-0 z-10 bg-white px-2 py-1.5">
        <div class="flex items-center gap-2 min-w-[180px]">
          <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-leoni-blue text-[10px] font-bold text-white">${escapeHtml(initials)}</span>
          <div class="min-w-0">
            <div class="truncate text-xs font-semibold text-slate-900">${escapeHtml(emp.nombre)}</div>
            <div class="truncate text-[10px] text-slate-500">${escapeHtml(noEmpDisplay)}</div>
          </div>
        </div>
      </td>
      ${cells}
      <td class="px-2 py-1.5 text-center"><span class="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums ${scoreTone}">${score}%</span></td>
    </tr>`;
  }).join("");

  let totalBrechas = 0;
  let empConBrecha = 0;
  for (const emp of empleados) {
    let tieneBrecha = false;
    for (const comp of competencias) {
      if (comp.nivel_requerido > 0 && (emp.niveles[comp.competencia_id] ?? 0) < comp.nivel_requerido) {
        totalBrechas++;
        tieneBrecha = true;
      }
    }
    if (tieneBrecha) empConBrecha++;
  }

  return `
  <div class="rounded-2xl border border-border bg-white shadow-sm overflow-hidden flex flex-col">
    <div class="overflow-x-auto flex-1">
      <table class="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr class="border-b border-slate-200">
            <th class="sticky left-0 z-10 bg-white px-2 py-2 text-left text-xs font-semibold text-slate-500 min-w-[200px]">Colaborador</th>
            ${colHeaders}
            <th class="px-2 py-2 text-center text-[10px] font-semibold text-slate-500">SCORE</th>
          </tr>
        </thead>
        <tbody>
          ${empRows}
        </tbody>
      </table>
    </div>
    <div class="border-t border-slate-100 bg-slate-50 px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1 text-[11px] text-slate-600">
      <span><b class="font-mono text-sm text-slate-900">${totalBrechas}</b> brechas detectadas</span>
      <span><b class="font-mono text-sm text-slate-900">${empConBrecha}</b> colaboradores con brecha activa</span>
    </div>
  </div>`;
}

// ── Page mount ───────────────────────────────────────────────────────────────

export function mountCapacidades(container: HTMLElement, signal: AbortSignal): void {
  let status: "loading" | "ready" | "error" = "loading";
  let errorMessage = "";
  let puestoOptions: MultihabilidadesPuestoOption[] = [];
  let selectedPuestoId: number | null = null;
  let matrizData: MultihabilidadesResponse | null = null;
  let searchFilter = "";
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let loadVersion = 0;

  mountAppShell(container, {
    pageTitle: "Matriz de Multihabilidades",
    activeNav: "capacidades",
    mainHtml: `<div id="capacidades-root"></div>`,
  });

  const root = container.querySelector<HTMLElement>("#capacidades-root")!;

  function paint(): void {
    if (status === "loading") {
      root.innerHTML = renderLoading();
      return;
    }
    if (status === "error") {
      root.innerHTML = renderError(errorMessage);
      return;
    }

    let content = `
    <div class="flex flex-col gap-5">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Capacidades</p>
        <h1 class="mt-1 text-lg font-semibold text-text-primary">Matriz de multihabilidades</h1>
        <p class="mt-1 text-sm text-text-muted">Comparaci&oacute;n entre el nivel requerido por puesto y el nivel actual de cada colaborador.</p>
      </div>
      ${renderFilters(puestoOptions, selectedPuestoId, searchFilter)}`;

    if (!selectedPuestoId || !matrizData) {
      content += `<div id="cap-results">${renderEmptyState()}</div>`;
    } else {
      const filtered = searchFilter
        ? matrizData.empleados.filter(e => e.nombre.toLowerCase().includes(searchFilter.toLowerCase()))
        : matrizData.empleados;

      content += `<div id="cap-results">`;
      content += renderKpis(matrizData.competencias, filtered);
      content += renderLegend();
      content += renderHeatmap(matrizData.competencias, filtered);
      content += `</div>`;
    }

    content += `</div>`;
    root.innerHTML = content;
  }

  async function loadPuestos(): Promise<void> {
    try {
      puestoOptions = await getMultihabilidadesPuestos();
      status = "ready";
    } catch (err: unknown) {
      status = "error";
      errorMessage = (err as { detail?: string })?.detail ?? "Error al cargar puestos";
    }
    paint();
  }

  async function loadMatriz(): Promise<void> {
    if (!selectedPuestoId) return;
    const version = ++loadVersion;
    status = "loading";
    paint();
    try {
      const data = await getMultihabilidadesData(selectedPuestoId);
      if (version !== loadVersion) return;
      matrizData = data;
      status = "ready";
    } catch (err: unknown) {
      if (version !== loadVersion) return;
      status = "error";
      errorMessage = (err as { detail?: string })?.detail ?? "Error al cargar matriz";
    }
    paint();
  }

  function handleChange(e: Event): void {
    const target = e.target as HTMLElement;
    if (target.matches("[data-action='select-puesto']")) {
      const val = (target as HTMLSelectElement).value;
      selectedPuestoId = val ? Number(val) : null;
      matrizData = null;
      searchFilter = "";
      if (selectedPuestoId) {
        loadMatriz();
      } else {
        paint();
      }
    }
  }

  function paintResults(): void {
    const resultsEl = root.querySelector<HTMLElement>("#cap-results");
    if (!resultsEl) return;

    if (!selectedPuestoId || !matrizData) {
      resultsEl.innerHTML = renderEmptyState();
      return;
    }
    const filtered = searchFilter
      ? matrizData.empleados.filter(e => e.nombre.toLowerCase().includes(searchFilter.toLowerCase()))
      : matrizData.empleados;

    resultsEl.innerHTML = renderKpis(matrizData.competencias, filtered)
      + renderLegend()
      + renderHeatmap(matrizData.competencias, filtered);
  }

  function handleInput(e: Event): void {
    const target = e.target as HTMLElement;
    if (target.matches("[data-action='search-empleado']")) {
      const val = (target as HTMLInputElement).value;
      searchFilter = val;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        paintResults();
      }, 250);
    }
  }

  function handleClick(e: Event): void {
    const target = e.target as HTMLElement;
    if (target.closest("[data-action='retry']")) {
      status = "loading";
      paint();
      if (selectedPuestoId) {
        loadMatriz();
      } else {
        loadPuestos();
      }
    }
  }

  // ── Tooltip flotante ──
  let tooltip: HTMLDivElement | null = null;

  function showTooltip(target: HTMLElement): void {
    const name = target.dataset.tooltipName;
    const cat = target.dataset.tooltipCat;
    if (!name) return;

    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.className = "fixed z-[9999] pointer-events-none transition-opacity duration-150";
      document.body.appendChild(tooltip);
    }

    tooltip.innerHTML = `
      <div class="rounded-lg border border-slate-200 bg-white p-3 shadow-xl text-left w-56">
        <p class="text-xs font-bold text-slate-900 leading-snug">${escapeHtml(name)}</p>
        <div class="mt-2 text-[11px] text-slate-600">
          <div class="flex items-center justify-between"><span class="text-slate-500">Categor&iacute;a</span><span class="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700">${escapeHtml(cat ?? "")}</span></div>
        </div>
      </div>`;

    const rect = target.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2 - 104}px`;
    tooltip.style.top = `${rect.top - 8}px`;
    tooltip.style.transform = "translateY(-100%)";
    tooltip.style.opacity = "1";
  }

  function hideTooltip(): void {
    if (tooltip) {
      tooltip.style.opacity = "0";
      tooltip.innerHTML = "";
    }
  }

  let currentTooltipTarget: HTMLElement | null = null;

  function handleMouseOver(e: Event): void {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-tooltip-name]");
    if (target && target !== currentTooltipTarget) {
      currentTooltipTarget = target;
      showTooltip(target);
    }
  }

  function handleMouseOut(e: Event): void {
    const target = e.target as HTMLElement;
    const related = (e as MouseEvent).relatedTarget as HTMLElement | null;
    const tooltipCell = target.closest<HTMLElement>("[data-tooltip-name]");
    if (tooltipCell && related && tooltipCell.contains(related)) return;
    currentTooltipTarget = null;
    hideTooltip();
  }

  root.addEventListener("change", handleChange);
  root.addEventListener("input", handleInput);
  root.addEventListener("click", handleClick);
  root.addEventListener("mouseover", handleMouseOver);
  root.addEventListener("mouseout", handleMouseOut);

  signal.addEventListener("abort", () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (tooltip) { tooltip.remove(); tooltip = null; }
    root.removeEventListener("change", handleChange);
    root.removeEventListener("input", handleInput);
    root.removeEventListener("click", handleClick);
    root.removeEventListener("mouseover", handleMouseOver);
    root.removeEventListener("mouseout", handleMouseOut);
  });

  loadPuestos();
}

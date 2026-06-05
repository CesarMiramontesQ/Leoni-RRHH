import { mountAppShell } from "../layouts/appShell.ts";
import {
  getEmpleadoResumen,
  getNivelLabels,
  NIVEL_COLORS,
  type EmpleadoResumen,
  type CompetenciaResumenItem,
} from "../api/evaluaciones.ts";
import { ensureMetodosCalificacionCompetenciaLoaded } from "../ui/metodosCalificacionCompetencia.ts";

export function mountEvaluacionEmpleado(
  container: HTMLElement,
  empleadoId: number,
  _signal: AbortSignal,
): void {
  mountAppShell(container, {
    activeNav: "evaluaciones",
    mainHtml: `<div id="eval-empleado-page"></div>`,
    mainClass: "py-0",
  });

  const root = container.querySelector<HTMLElement>("#eval-empleado-page")!;

  function renderLoading(): string {
    return `<div class="px-6 py-12 text-center text-gray-500">Cargando resumen...</div>`;
  }

  function renderError(): string {
    return `
      <div class="px-6 py-6 max-w-4xl mx-auto">
        <a href="#/evaluaciones" class="text-sm text-blue-600 hover:text-blue-800">&larr; Volver a evaluaciones</a>
        <div class="mt-6 rounded-lg border border-dashed border-gray-300 py-12 text-center text-gray-500">
          <p class="text-sm">No se pudo cargar el resumen de este empleado.</p>
          <p class="text-xs mt-1">Puede que no tenga competencias requeridas asignadas a su área.</p>
        </div>
      </div>`;
  }

  function renderNivelBadge(nivel: number): string {
    const label = getNivelLabels()[nivel] ?? `${nivel}`;
    const color = NIVEL_COLORS[nivel] ?? "bg-gray-100 text-gray-600";
    return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}">${label}</span>`;
  }

  function renderProgressBar(actual: number, required: number): string {
    const pct = required > 0 ? Math.round((actual / required) * 100) : 0;
    const clampedPct = Math.min(100, pct);
    const barColor = pct >= 100 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";
    return `
      <div class="flex items-center gap-3 w-full">
        <div class="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
          <div class="h-full rounded-full ${barColor} transition-all" style="width:${clampedPct}%"></div>
        </div>
        <span class="text-xs font-medium text-gray-600 w-10 text-right">${pct}%</span>
      </div>`;
  }

  function renderCompetenciaRow(item: CompetenciaResumenItem): string {
    const gapBadge = item.gap > 0
      ? `<span class="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">-${item.gap}</span>`
      : `<span class="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">OK</span>`;

    return `
      <tr class="border-b border-gray-100 hover:bg-gray-50/50">
        <td class="px-4 py-3">
          <div class="text-sm font-medium text-gray-900">${item.competencia_nombre}</div>
          <div class="text-xs text-gray-500 capitalize">${item.categoria}</div>
        </td>
        <td class="px-4 py-3 text-center">${renderNivelBadge(item.nivel_requerido)}</td>
        <td class="px-4 py-3 text-center">${renderNivelBadge(item.nivel_actual)}</td>
        <td class="px-4 py-3 text-center">${gapBadge}</td>
        <td class="px-4 py-3 w-40">${renderProgressBar(item.nivel_actual, item.nivel_requerido)}</td>
      </tr>`;
  }

  function renderResumen(data: EmpleadoResumen): string {
    const cumplimientoColor =
      data.cumplimiento_pct >= 80 ? "text-green-600" :
      data.cumplimiento_pct >= 50 ? "text-yellow-600" : "text-red-600";

    const competenciasTable = data.competencias.length === 0
      ? `<div class="rounded-lg border border-dashed border-gray-300 py-8 text-center text-gray-500 text-sm">
           No hay competencias requeridas definidas para el área de este empleado.
         </div>`
      : `<div class="overflow-hidden rounded-lg border border-gray-200">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Competencia</th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Requerido</th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actual</th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Gap</th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Progreso</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 bg-white">
              ${data.competencias.map(renderCompetenciaRow).join("")}
            </tbody>
          </table>
        </div>`;

    return `
      <div class="px-6 py-6 max-w-5xl mx-auto">
        <a href="#/evaluaciones" class="text-sm text-blue-600 hover:text-blue-800">&larr; Volver a evaluaciones</a>

        <div class="mt-4 flex items-center justify-between">
          <div>
            <h1 class="text-xl font-semibold text-gray-900">${data.empleado_nombre}</h1>
            <p class="text-sm text-gray-500 mt-0.5">${data.area_nombre ?? "Sin área"}</p>
          </div>
        </div>

        <!-- Stats cards -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div class="rounded-lg border border-gray-200 bg-white p-4 text-center">
            <p class="text-2xl font-bold ${cumplimientoColor}">${data.cumplimiento_pct}%</p>
            <p class="text-xs text-gray-500 mt-1">Cumplimiento</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-white p-4 text-center">
            <p class="text-2xl font-bold text-gray-900">${data.total_competencias}</p>
            <p class="text-xs text-gray-500 mt-1">Competencias requeridas</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-white p-4 text-center">
            <p class="text-2xl font-bold text-blue-600">${data.evaluadas}</p>
            <p class="text-xs text-gray-500 mt-1">Evaluadas</p>
          </div>
          <div class="rounded-lg border border-gray-200 bg-white p-4 text-center">
            <p class="text-2xl font-bold text-red-600">${data.con_gap}</p>
            <p class="text-xs text-gray-500 mt-1">Con brecha</p>
          </div>
        </div>

        <!-- Table -->
        <div class="mt-6">
          <h2 class="text-sm font-semibold text-gray-700 mb-3">Detalle por competencia</h2>
          ${competenciasTable}
        </div>
      </div>`;
  }

  async function load() {
    root.innerHTML = renderLoading();
    await ensureMetodosCalificacionCompetenciaLoaded();
    const data = await getEmpleadoResumen(empleadoId);
    if (!data) {
      root.innerHTML = renderError();
      return;
    }
    root.innerHTML = renderResumen(data);
  }

  load();
}

import { mountAppShell } from "../layouts/appShell.ts";
import { renderLevelUpBackBar } from "../navigation/levelUpBackLink.ts";
import {
  getEmpleadoResumen,
  getNivelLabels,
  type EmpleadoResumen,
  type CompetenciaResumenItem,
  type Severidad,
} from "../api/evaluaciones.ts";
import { ensureMetodosCalificacionCompetenciaLoaded } from "../ui/metodosCalificacionCompetencia.ts";

const SEVERIDAD_CONFIG: Record<Severidad, { dot: string; bg: string; text: string; label: string }> = {
  alineado: { dot: "bg-green-500", bg: "bg-green-50", text: "text-green-700", label: "Alineado" },
  media: { dot: "bg-yellow-500", bg: "bg-yellow-50", text: "text-yellow-700", label: "Media" },
  alta: { dot: "bg-orange-500", bg: "bg-orange-50", text: "text-orange-700", label: "Alta" },
  critica: { dot: "bg-red-500", bg: "bg-red-50", text: "text-red-700", label: "Crítica" },
};

const ACCION_COLORS: Record<string, string> = {
  green: "border-green-200 bg-green-50 text-green-700",
  yellow: "border-yellow-200 bg-yellow-50 text-yellow-700",
  orange: "border-orange-200 bg-orange-50 text-orange-700",
  red: "border-red-200 bg-red-50 text-red-700",
};

const BAR_COLORS: Record<Severidad, string> = {
  alineado: "bg-green-500",
  media: "bg-yellow-500",
  alta: "bg-orange-500",
  critica: "bg-red-500",
};

function renderCircularGauge(value: number, maxValue: number, color: string, size = 48): string {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = maxValue > 0 ? Math.min(value / maxValue, 1) : 0;
  const dashArray = pct * circumference;
  const center = size / 2;
  const pctLabel = Math.round(pct * 100);

  return `
    <div class="relative inline-flex items-center justify-center" style="width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}" class="transform -rotate-90">
        <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="#E5E7EB" stroke-width="4"/>
        <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${color}" stroke-width="4"
          stroke-dasharray="${dashArray} ${circumference}" stroke-linecap="round"/>
      </svg>
      <span class="absolute text-xs font-bold text-gray-700">${pctLabel}%</span>
    </div>`;
}

function gaugeColor(nivel: number): string {
  if (nivel >= 4) return "#22C55E";
  if (nivel >= 3) return "#3B82F6";
  if (nivel >= 2) return "#F59E0B";
  if (nivel >= 1) return "#EF4444";
  return "#D1D5DB";
}

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
    return `
      <div class="px-6 py-6 max-w-6xl mx-auto">
        ${renderLevelUpBackBar()}
        <div class="py-12 text-center text-gray-500">Cargando resumen...</div>
      </div>`;
  }

  function renderError(): string {
    return `
      <div class="px-6 py-6 max-w-6xl mx-auto">
        ${renderLevelUpBackBar()}
        <div class="mt-6 rounded-lg border border-dashed border-gray-300 py-12 text-center text-gray-500">
          <p class="text-sm">No se pudo cargar el resumen de este empleado.</p>
          <p class="text-xs mt-1">Puede que no tenga competencias requeridas asignadas.</p>
        </div>
      </div>`;
  }

  function renderHeader(data: EmpleadoResumen): string {
    const puestoInfo = data.puesto_nombre
      ? `${data.nivel_puesto ?? ""} ${data.nivel_puesto ? "•" : ""} ${data.departamento ?? data.area_nombre ?? ""}`.trim()
      : data.area_nombre ?? "Sin puesto asignado";
    const evaluador = data.evaluador_nombre ? `Evaluador: ${data.evaluador_nombre}` : "";

    return `
      <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div class="border-l-4 border-green-500 pl-4">
          <h1 class="text-xl font-bold text-gray-900">Evaluación Individual vs Perfil Ideal</h1>
          <p class="text-sm text-gray-500 mt-0.5">Análisis detallado de competencias y alineación de carrera.</p>
        </div>
        <div class="flex flex-col sm:flex-row gap-4 text-sm">
          <div>
            <p class="text-xs font-medium text-gray-500 uppercase">Empleado Seleccionado</p>
            <p class="font-semibold text-gray-900 mt-0.5">${data.empleado_nombre}${data.puesto_nombre ? ` - ${data.puesto_nombre}` : ""}</p>
          </div>
          <div>
            <p class="text-xs font-medium text-gray-500 uppercase">Información del Puesto</p>
            <p class="font-medium text-gray-700 mt-0.5">${puestoInfo}</p>
            ${evaluador ? `<p class="text-xs text-gray-500 italic">${evaluador}</p>` : ""}
          </div>
        </div>
      </div>`;
  }

  function renderKPIs(data: EmpleadoResumen): string {
    const alinPct = data.total_competencias > 0
      ? Math.round((data.competencias_alineadas / data.total_competencias) * 100)
      : 0;
    const sevCfg = SEVERIDAD_CONFIG[data.severidad_promedio as Severidad] ?? SEVERIDAD_CONFIG.alineado;
    const readinessColor = data.readiness_score >= 70 ? "bg-green-500" : data.readiness_score >= 40 ? "bg-yellow-500" : "bg-red-500";

    return `
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <div class="rounded-lg border border-gray-200 bg-white p-4">
          <p class="text-xs font-medium text-gray-500 uppercase">Competencias Alineadas</p>
          <div class="flex items-baseline gap-2 mt-2">
            <span class="text-2xl font-bold text-gray-900">${data.competencias_alineadas}/${data.total_competencias}</span>
            <span class="text-sm font-semibold text-blue-600">${alinPct}%</span>
          </div>
          <div class="mt-2 h-1 rounded-full bg-gray-100 overflow-hidden">
            <div class="h-full rounded-full bg-blue-500" style="width:${alinPct}%"></div>
          </div>
        </div>

        <div class="rounded-lg border border-gray-200 bg-white p-4">
          <p class="text-xs font-medium text-gray-500 uppercase">Brechas Identificadas</p>
          <div class="flex items-baseline gap-2 mt-2">
            <span class="text-2xl font-bold text-gray-900">${data.brechas_identificadas}</span>
            <span class="text-xs text-gray-500">Puntos de mejora</span>
          </div>
        </div>

        <div class="rounded-lg border border-gray-200 bg-white p-4">
          <p class="text-xs font-medium text-gray-500 uppercase">Brecha Promedio</p>
          <div class="flex items-baseline gap-2 mt-2">
            <span class="text-2xl font-bold text-gray-900">${data.brecha_promedio}%</span>
            <span class="inline-flex items-center gap-1 rounded-full ${sevCfg.bg} px-2 py-0.5 text-xs font-medium ${sevCfg.text}">
              <span class="size-1.5 rounded-full ${sevCfg.dot}"></span>${sevCfg.label}
            </span>
          </div>
        </div>

        <div class="rounded-lg border border-gray-200 bg-white p-4">
          <p class="text-xs font-medium text-gray-500 uppercase">Readiness Score</p>
          <div class="flex items-baseline gap-2 mt-2">
            <span class="text-2xl font-bold text-gray-900">${data.readiness_score}%</span>
          </div>
          <div class="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div class="h-full rounded-full ${readinessColor}" style="width:${Math.min(100, data.readiness_score)}%"></div>
          </div>
        </div>
      </div>`;
  }

  function renderCompetenciaRow(item: CompetenciaResumenItem): string {
    const nivelLabels = getNivelLabels();
    const maxNivel = Object.keys(nivelLabels).length - 1 || 4;
    const sevCfg = SEVERIDAD_CONFIG[item.severidad] ?? SEVERIDAD_CONFIG.alineado;
    const accionClasses = item.accion_color ? (ACCION_COLORS[item.accion_color] ?? ACCION_COLORS.green) : "";

    return `
      <tr class="border-b border-gray-100 hover:bg-gray-50/50">
        <td class="px-4 py-3">
          <div class="text-sm font-medium text-gray-900">${item.competencia_nombre}</div>
          <div class="text-xs text-gray-500 capitalize">${item.categoria}</div>
        </td>
        <td class="px-4 py-3 text-center">
          ${renderCircularGauge(item.nivel_actual, maxNivel, gaugeColor(item.nivel_actual))}
        </td>
        <td class="px-4 py-3 text-center">
          ${renderCircularGauge(item.nivel_requerido, maxNivel, "#94A3B8")}
        </td>
        <td class="px-4 py-3">
          <div class="flex items-center gap-2">
            <span class="size-2 rounded-full ${sevCfg.dot}"></span>
            <span class="text-sm font-medium text-gray-900">${item.brecha_pct}%</span>
            <span class="text-xs ${sevCfg.text}">(${sevCfg.label})</span>
          </div>
        </td>
        <td class="px-4 py-3">
          ${item.accion_recomendada
            ? `<span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${accionClasses}">${item.accion_recomendada}</span>`
            : ""}
        </td>
      </tr>`;
  }

  function renderComparisonTable(data: EmpleadoResumen): string {
    if (data.competencias.length === 0) {
      return `
        <div class="mt-8 rounded-lg border border-dashed border-gray-300 py-8 text-center text-gray-500 text-sm">
          No hay competencias requeridas definidas para este empleado.
        </div>`;
    }

    return `
      <div class="mt-8">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-gray-900">Tabla de Comparación Unificada</h2>
          <span class="text-xs text-gray-500 uppercase">Detalle por Competencia</span>
        </div>
        <div class="overflow-hidden rounded-lg border border-gray-200">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Competencia</th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Nivel Actual</th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Nivel Ideal</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Brecha (%)</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acción Recomendada</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 bg-white">
              ${data.competencias.map(renderCompetenciaRow).join("")}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function renderBreachBars(data: EmpleadoResumen): string {
    const withBrecha = data.competencias
      .filter(c => c.brecha_pct > 0)
      .sort((a, b) => b.brecha_pct - a.brecha_pct);

    if (withBrecha.length === 0) return "";

    const bars = withBrecha.map(item => {
      const barColor = BAR_COLORS[item.severidad] ?? BAR_COLORS.media;
      return `
        <div class="flex items-center gap-3">
          <span class="text-xs font-medium text-gray-700 uppercase w-40 truncate">${item.competencia_nombre}</span>
          <div class="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
            <div class="h-full rounded-full ${barColor} transition-all" style="width:${Math.min(100, item.brecha_pct)}%"></div>
          </div>
          <span class="text-xs font-medium text-gray-600 w-20 text-right">${item.brecha_pct}% BRECHA</span>
        </div>`;
    }).join("");

    return `
      <div class="mt-8">
        <h2 class="text-sm font-semibold text-gray-900 mb-4">Visualización de Brechas</h2>
        <div class="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
          ${bars}
          <div class="flex justify-between text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">
            <span>0% ALINEADO</span>
            <span>50% MODERADO</span>
            <span>100% CRÍTICO</span>
          </div>
        </div>
      </div>`;
  }

  function renderResumen(data: EmpleadoResumen): string {
    return `
      <div class="px-6 py-6 max-w-6xl mx-auto">
        ${renderLevelUpBackBar()}
        <div class="mt-4">
          ${renderHeader(data)}
          ${renderKPIs(data)}
          ${renderComparisonTable(data)}
          ${renderBreachBars(data)}
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

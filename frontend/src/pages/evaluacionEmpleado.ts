import { mountAppShell } from "../layouts/appShell.ts";
import { renderLevelUpBackBar } from "../navigation/levelUpBackLink.ts";
import {
  getEmpleadoResumen,
  getNivelLabels,
  getPDI,
  createPDI,
  updatePDI,
  deletePDI,
  type EmpleadoResumen,
  type CompetenciaResumenItem,
  type Severidad,
  type PDIAccion,
  type EstadoPDI,
  type PDICreatePayload,
  type PDIUpdatePayload,
} from "../api/evaluaciones.ts";
import { ensureMetodosCalificacionCompetenciaLoaded } from "../ui/metodosCalificacionCompetencia.ts";
import { getRolFromAccessToken } from "../auth/jwt.ts";
import { BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER, FIELD_FOCUS, SELECT_CHEVRON } from "../ui/uiTokens.ts";

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

const PDI_ESTADO_BADGE: Record<EstadoPDI, string> = {
  pendiente: "bg-amber-50 text-amber-700 border-amber-200",
  en_proceso: "bg-blue-50 text-blue-700 border-blue-200",
  completado: "bg-green-50 text-green-700 border-green-200",
  cancelado: "bg-gray-100 text-gray-500 border-gray-200",
};

const PDI_ESTADO_LABEL: Record<EstadoPDI, string> = {
  pendiente: "Pendiente",
  en_proceso: "En Proceso",
  completado: "Completado",
  cancelado: "Cancelado",
};

const PDI_TIPOS = ["E-Learning", "Presencial", "Mentoring", "Coaching", "Certificación", "Rotación"];

const PRINT_STYLES = `
@media print {
  body * { visibility: hidden; }
  #eval-empleado-page, #eval-empleado-page * { visibility: visible; }
  #eval-empleado-page { position: absolute; left: 0; top: 0; width: 100%; }
  .print\\:hidden { display: none !important; }
  nav, aside, header, [data-shell-sidebar], [data-shell-topbar] { display: none !important; }
  @page { size: A4 landscape; margin: 10mm; }
  table { page-break-inside: auto; }
  tr { page-break-inside: avoid; }
}`;

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

  // Inject print styles
  if (!document.getElementById("eval-print-styles")) {
    const style = document.createElement("style");
    style.id = "eval-print-styles";
    style.textContent = PRINT_STYLES;
    document.head.appendChild(style);
  }

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
        <div class="flex items-start gap-4 text-sm">
          <div class="flex flex-col sm:flex-row gap-4">
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
          <button id="btn-export-pdf" class="${BTN_SECONDARY} text-xs px-3 py-1.5 print:hidden" title="Exportar a PDF">
            <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>PDF
          </button>
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

  function renderPDIBadge(estado: EstadoPDI): string {
    const cls = PDI_ESTADO_BADGE[estado] ?? PDI_ESTADO_BADGE.pendiente;
    const label = PDI_ESTADO_LABEL[estado] ?? estado;
    return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}">${label}</span>`;
  }

  function renderPDISection(pdiItems: PDIAccion[], _competencias: CompetenciaResumenItem[], currentEstado?: string): string {
    const isRH = getRolFromAccessToken() === "rh";
    const estadoOptions = ["", "pendiente", "en_proceso", "completado", "cancelado"];
    const estadoLabels = ["Todos", "Pendiente", "En Proceso", "Completado", "Cancelado"];

    const filterHtml = `
      <div class="flex items-center gap-3 print:hidden">
        <div class="relative">
          <select id="pdi-filter-estado" class="appearance-none rounded-md border border-gray-300 bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-gray-700 ${FIELD_FOCUS}">
            ${estadoOptions.map((v, i) => `<option value="${v}" ${v === (currentEstado ?? "") ? "selected" : ""}>${estadoLabels[i]}</option>`).join("")}
          </select>
          <div class="absolute inset-y-0 right-0 flex items-center pr-1 pointer-events-none">${SELECT_CHEVRON}</div>
        </div>
        ${isRH ? `<button id="pdi-btn-add" class="${BTN_PRIMARY} text-xs px-3 py-1.5">+ Agregar acción</button>` : ""}
      </div>`;

    const rows = pdiItems.length > 0
      ? pdiItems.map(item => `
        <tr class="border-b border-gray-100 hover:bg-gray-50/50 ${isRH ? "cursor-pointer" : ""}" data-pdi-id="${item.id}">
          <td class="px-4 py-3 text-sm text-gray-900">${item.competencia_nombre}</td>
          <td class="px-4 py-3 text-sm text-gray-700 max-w-[200px] truncate">${item.accion}</td>
          <td class="px-4 py-3 text-xs text-gray-600">${item.tipo}</td>
          <td class="px-4 py-3 text-xs text-gray-600 text-center">${item.duracion_horas ?? "—"}</td>
          <td class="px-4 py-3 text-xs text-gray-600">${item.fecha_inicio} / ${item.fecha_fin}</td>
          <td class="px-4 py-3 text-xs text-gray-600">${item.responsable}</td>
          <td class="px-4 py-3">${renderPDIBadge(item.estado)}</td>
        </tr>`).join("")
      : `<tr><td colspan="7" class="px-4 py-8 text-center text-sm text-gray-400">Sin acciones de desarrollo registradas.</td></tr>`;

    return `
      <div class="mt-8" id="pdi-section">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-gray-900 uppercase">Plan de Acción de Desarrollo (PDI)</h2>
          ${filterHtml}
        </div>
        <div class="overflow-hidden rounded-lg border border-gray-200">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Competencia</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acción</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Hrs</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inicio / Fin</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Responsable</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 bg-white" id="pdi-tbody">
              ${rows}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function renderPDIModal(
    competencias: CompetenciaResumenItem[],
    existing?: PDIAccion,
  ): string {
    const isEdit = !!existing;
    const title = isEdit ? "Editar Acción PDI" : "Nueva Acción PDI";

    const compOptions = competencias.map(c =>
      `<option value="${c.competencia_id}" ${existing && existing.competencia_id === c.competencia_id ? "selected" : ""}>${c.competencia_nombre}</option>`
    ).join("");

    const tipoOptions = PDI_TIPOS.map(t =>
      `<option value="${t}" ${existing && existing.tipo === t ? "selected" : ""}>${t}</option>`
    ).join("");

    const estadoField = isEdit ? `
      <div>
        <label class="block text-xs font-medium text-gray-700 mb-1">Estado</label>
        <select id="pdi-modal-estado" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm ${FIELD_FOCUS}">
          ${(["pendiente", "en_proceso", "completado", "cancelado"] as EstadoPDI[]).map(e =>
            `<option value="${e}" ${existing!.estado === e ? "selected" : ""}>${PDI_ESTADO_LABEL[e]}</option>`
          ).join("")}
        </select>
      </div>` : "";

    return `
      <div id="pdi-modal-overlay" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
          <h3 class="text-base font-semibold text-gray-900 mb-4">${title}</h3>
          <form id="pdi-modal-form" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div class="col-span-2">
                <label class="block text-xs font-medium text-gray-700 mb-1">Competencia</label>
                <select id="pdi-modal-competencia" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm ${FIELD_FOCUS}" ${isEdit ? "disabled" : ""}>
                  ${compOptions}
                </select>
              </div>
              <div class="col-span-2">
                <label class="block text-xs font-medium text-gray-700 mb-1">Acción</label>
                <input id="pdi-modal-accion" type="text" maxlength="300" required class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm ${FIELD_FOCUS}" value="${existing?.accion ?? ""}">
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Tipo</label>
                <select id="pdi-modal-tipo" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm ${FIELD_FOCUS}">
                  ${tipoOptions}
                </select>
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Duración (hrs)</label>
                <input id="pdi-modal-duracion" type="number" min="1" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm ${FIELD_FOCUS}" value="${existing?.duracion_horas ?? ""}">
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Fecha inicio</label>
                <input id="pdi-modal-inicio" type="date" required class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm ${FIELD_FOCUS}" value="${existing?.fecha_inicio ?? ""}">
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">Fecha fin</label>
                <input id="pdi-modal-fin" type="date" required class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm ${FIELD_FOCUS}" value="${existing?.fecha_fin ?? ""}">
              </div>
              <div class="col-span-2">
                <label class="block text-xs font-medium text-gray-700 mb-1">Responsable</label>
                <input id="pdi-modal-responsable" type="text" maxlength="200" required class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm ${FIELD_FOCUS}" value="${existing?.responsable ?? ""}">
              </div>
              ${estadoField}
            </div>
            <div class="flex items-center justify-between pt-2 border-t border-gray-100">
              <div>
                ${isEdit ? `<button type="button" id="pdi-modal-delete" class="${BTN_DANGER} text-xs px-3 py-1.5">Eliminar</button>` : ""}
              </div>
              <div class="flex gap-2">
                <button type="button" id="pdi-modal-cancel" class="${BTN_SECONDARY} text-xs px-3 py-1.5">Cancelar</button>
                <button type="submit" class="${BTN_PRIMARY} text-xs px-3 py-1.5">${isEdit ? "Guardar" : "Crear"}</button>
              </div>
            </div>
          </form>
        </div>
      </div>`;
  }

  function renderGanttTimeline(pdiItems: PDIAccion[]): string {
    const active = pdiItems.filter(p => p.estado !== "cancelado");
    if (active.length === 0) return "";

    const today = new Date();
    const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const months: { label: string; start: Date; end: Date }[] = [];
    for (let i = 0; i < 12; i++) {
      const m = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1);
      const mEnd = new Date(m.getFullYear(), m.getMonth() + 1, 0);
      months.push({
        label: m.toLocaleString("es-MX", { month: "short" }).toUpperCase(),
        start: m,
        end: mEnd,
      });
    }

    const timelineStart = months[0].start.getTime();
    const timelineEnd = months[11].end.getTime();
    const totalDuration = timelineEnd - timelineStart;

    const GANTT_COLORS: Record<string, string> = {
      en_proceso: "bg-blue-500",
      completado: "bg-green-500",
      pendiente: "bg-gray-400",
    };

    const grouped: Record<string, PDIAccion[]> = {};
    for (const item of active) {
      const key = item.competencia_nombre;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    }

    const rows = Object.entries(grouped).map(([comp, items]) => {
      const bars = items.map(item => {
        const iStart = new Date(item.fecha_inicio).getTime();
        const iEnd = new Date(item.fecha_fin).getTime();

        const clampedStart = Math.max(iStart, timelineStart);
        const clampedEnd = Math.min(iEnd, timelineEnd);
        if (clampedStart >= timelineEnd || clampedEnd <= timelineStart) return "";

        const leftPct = ((clampedStart - timelineStart) / totalDuration) * 100;
        const widthPct = ((clampedEnd - clampedStart) / totalDuration) * 100;
        const displayWidth = Math.max(widthPct, 2.5);
        const color = GANTT_COLORS[item.estado] ?? GANTT_COLORS.pendiente;
        const showLabel = displayWidth > 5;

        const tooltip = `${item.accion} (${item.tipo}) — ${PDI_ESTADO_LABEL[item.estado]}`;
        const tooltipBg: Record<string, string> = {
          en_proceso: "bg-blue-600",
          completado: "bg-green-600",
          pendiente: "bg-gray-600",
        };
        const tipBg = tooltipBg[item.estado] ?? tooltipBg.pendiente;
        return `<div class="absolute h-5 rounded ${color} opacity-80 flex items-center px-1 cursor-default group/bar"
          style="left:${leftPct}%;width:${displayWidth}%;top:2px;z-index:1">
          ${showLabel ? `<span class="text-[9px] text-white font-medium truncate">${item.tipo}</span>` : ""}
          <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/bar:block z-50 pointer-events-none">
            <div class="whitespace-nowrap rounded ${tipBg} px-2 py-1 text-[10px] text-white shadow-lg">${tooltip}</div>
          </div>
        </div>`;
      }).join("");

      return `
        <div class="flex items-stretch border-b border-gray-100 last:border-0">
          <div class="w-36 shrink-0 px-3 py-2 text-xs font-medium text-gray-700 truncate flex items-center">${comp}</div>
          <div class="flex-1 relative h-9 border-l border-gray-100">
            ${bars}
          </div>
        </div>`;
    }).join("");

    const monthHeaders = months.map(m =>
      `<div class="flex-1 text-center text-[10px] font-medium text-gray-500 py-1.5 border-l border-gray-100 first:border-l-0">${m.label}</div>`
    ).join("");

    const gridLines = months.map((_, i) => {
      const leftPct = (i / 12) * 100;
      return i > 0 ? `<div class="absolute top-0 bottom-0 border-l border-gray-100" style="left:${leftPct}%"></div>` : "";
    }).join("");

    const todayPct = ((today.getTime() - timelineStart) / totalDuration) * 100;
    const todayLine = todayPct > 0 && todayPct < 100
      ? `<div class="absolute top-0 bottom-0 border-l-2 border-red-400 z-10" style="left:${todayPct}%" title="Hoy"></div>`
      : "";

    return `
      <div class="mt-8" id="gantt-section">
        <h2 class="text-sm font-semibold text-gray-900 uppercase mb-3">Proyección de Cierre de Brechas (Próximos 12 meses)</h2>
        <div class="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div class="flex border-b border-gray-200 bg-gray-50">
            <div class="w-36 shrink-0 px-3 py-1.5 text-[10px] font-medium text-gray-500 uppercase">Competencia</div>
            <div class="flex-1 flex">
              ${monthHeaders}
            </div>
          </div>
          <div class="relative">
            ${gridLines}
            ${todayLine}
            ${rows}
          </div>
          <div class="flex items-center gap-4 px-3 py-2 border-t border-gray-100 bg-gray-50">
            <div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-blue-500"></span><span class="text-[10px] text-gray-600">En Proceso</span></div>
            <div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-gray-400"></span><span class="text-[10px] text-gray-600">Pendiente</span></div>
            <div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-green-500"></span><span class="text-[10px] text-gray-600">Completado</span></div>
            <div class="flex items-center gap-1.5"><span class="w-0.5 h-3 border-l-2 border-red-400"></span><span class="text-[10px] text-gray-600">Hoy</span></div>
          </div>
        </div>
      </div>`;
  }

  function renderResumen(data: EmpleadoResumen, pdiItems: PDIAccion[]): string {
    return `
      <div class="px-6 py-6 max-w-6xl mx-auto">
        ${renderLevelUpBackBar()}
        <div class="mt-4">
          ${renderHeader(data)}
          ${renderKPIs(data)}
          ${renderComparisonTable(data)}
          ${renderBreachBars(data)}
          ${renderPDISection(pdiItems, data.competencias)}
          ${renderGanttTimeline(pdiItems)}
        </div>
      </div>`;
  }

  let resumenData: EmpleadoResumen | null = null;
  let pdiData: PDIAccion[] = [];

  async function loadPDI(estado?: string) {
    const params = estado ? { estado } : undefined;
    const resp = await getPDI(empleadoId, params);
    pdiData = resp.items;
  }

  function openModal(existing?: PDIAccion) {
    if (!resumenData) return;
    const html = renderPDIModal(resumenData.competencias, existing);
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper.firstElementChild!);

    const overlay = document.getElementById("pdi-modal-overlay")!;
    const form = document.getElementById("pdi-modal-form") as HTMLFormElement;
    const cancelBtn = document.getElementById("pdi-modal-cancel")!;
    const deleteBtn = document.getElementById("pdi-modal-delete");

    function closeModal() { overlay.remove(); }

    cancelBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });

    if (deleteBtn && existing) {
      deleteBtn.addEventListener("click", async () => {
        if (!confirm("¿Eliminar esta acción?")) return;
        await deletePDI(empleadoId, existing.id);
        closeModal();
        await refreshPDI();
      });
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const compEl = document.getElementById("pdi-modal-competencia") as HTMLSelectElement;
      const accionEl = document.getElementById("pdi-modal-accion") as HTMLInputElement;
      const tipoEl = document.getElementById("pdi-modal-tipo") as HTMLSelectElement;
      const duracionEl = document.getElementById("pdi-modal-duracion") as HTMLInputElement;
      const inicioEl = document.getElementById("pdi-modal-inicio") as HTMLInputElement;
      const finEl = document.getElementById("pdi-modal-fin") as HTMLInputElement;
      const responsableEl = document.getElementById("pdi-modal-responsable") as HTMLInputElement;
      const estadoEl = document.getElementById("pdi-modal-estado") as HTMLSelectElement | null;

      if (existing) {
        const payload: PDIUpdatePayload = {};
        if (accionEl.value !== existing.accion) payload.accion = accionEl.value;
        if (tipoEl.value !== existing.tipo) payload.tipo = tipoEl.value;
        const dur = duracionEl.value ? Number(duracionEl.value) : null;
        if (dur !== existing.duracion_horas) payload.duracion_horas = dur;
        if (inicioEl.value !== existing.fecha_inicio) payload.fecha_inicio = inicioEl.value;
        if (finEl.value !== existing.fecha_fin) payload.fecha_fin = finEl.value;
        if (responsableEl.value !== existing.responsable) payload.responsable = responsableEl.value;
        if (estadoEl && estadoEl.value !== existing.estado) payload.estado = estadoEl.value as EstadoPDI;
        await updatePDI(empleadoId, existing.id, payload);
      } else {
        const payload: PDICreatePayload = {
          competencia_id: Number(compEl.value),
          accion: accionEl.value,
          tipo: tipoEl.value,
          duracion_horas: duracionEl.value ? Number(duracionEl.value) : undefined,
          fecha_inicio: inicioEl.value,
          fecha_fin: finEl.value,
          responsable: responsableEl.value,
        };
        await createPDI(empleadoId, payload);
      }
      closeModal();
      await refreshPDI();
    });
  }

  async function refreshPDI() {
    const filterEl = document.getElementById("pdi-filter-estado") as HTMLSelectElement | null;
    const estado = filterEl?.value || undefined;
    await loadPDI(estado);
    if (!resumenData) return;

    const pdiSection = document.getElementById("pdi-section");
    if (pdiSection) {
      const tmp = document.createElement("div");
      tmp.innerHTML = renderPDISection(pdiData, resumenData.competencias, estado);
      pdiSection.replaceWith(tmp.firstElementChild!);
    }

    const allResp = await getPDI(empleadoId);
    const ganttSection = document.getElementById("gantt-section");
    if (ganttSection) {
      const ganttHtml = renderGanttTimeline(allResp.items);
      if (ganttHtml) {
        const tmp = document.createElement("div");
        tmp.innerHTML = ganttHtml;
        ganttSection.replaceWith(tmp.firstElementChild!);
      } else {
        ganttSection.remove();
      }
    } else {
      const ganttHtml = renderGanttTimeline(allResp.items);
      if (ganttHtml) {
        const pdiNew = document.getElementById("pdi-section");
        if (pdiNew) {
          const tmp = document.createElement("div");
          tmp.innerHTML = ganttHtml;
          pdiNew.insertAdjacentElement("afterend", tmp.firstElementChild!);
        }
      }
    }

    bindPDIEvents();
  }

  function bindPDIEvents() {
    const isRH = getRolFromAccessToken() === "rh";
    const addBtn = document.getElementById("pdi-btn-add");
    if (addBtn) addBtn.addEventListener("click", () => openModal());

    const filterEl = document.getElementById("pdi-filter-estado") as HTMLSelectElement | null;
    if (filterEl) {
      filterEl.addEventListener("change", () => refreshPDI());
    }

    if (isRH) {
      const rows = root.querySelectorAll<HTMLElement>("[data-pdi-id]");
      rows.forEach(row => {
        row.addEventListener("click", () => {
          const id = Number(row.dataset.pdiId);
          const item = pdiData.find(p => p.id === id);
          if (item) openModal(item);
        });
      });
    }
  }

  function bindExportPDF() {
    const btn = document.getElementById("btn-export-pdf");
    if (btn) btn.addEventListener("click", () => window.print());
  }

  async function load() {
    root.innerHTML = renderLoading();
    await ensureMetodosCalificacionCompetenciaLoaded();
    const [data, pdiResp] = await Promise.all([
      getEmpleadoResumen(empleadoId),
      getPDI(empleadoId),
    ]);
    if (!data) {
      root.innerHTML = renderError();
      return;
    }
    resumenData = data;
    pdiData = pdiResp.items;
    root.innerHTML = renderResumen(data, pdiData);
    bindPDIEvents();
    bindExportPDF();
  }

  load();
}

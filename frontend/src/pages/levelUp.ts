import { mountAppShell } from "../layouts/appShell.ts";
import { renderLevelUpBackBar } from "../navigation/levelUpBackLink.ts";
import { escapeHtml, paginationRange } from "../ui/uiUtils.ts";
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  FIELD_FOCUS,
  FILTER_FIELD_WRAP,
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_BTN_PRIMARY,
  RH_LISTADO_FOCUS_RING,
  RH_LISTADO_LABEL,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
  SELECT_CHEVRON,
} from "../ui/uiTokens.ts";
import { getCursos, getCursoById, createCurso, updateCurso, deleteCurso, getCursoPuestos, getCursoEmpleadosExtra, getCursoSesiones, createCursoSesion, deleteCursoSesion, getSesionEmpleados, inscribirEmpleadoSesion, quitarEmpleadoSesion, getSesionEmpleadosElegibles, getCursoCatalogosAsignacion, getCursoGrupos, agregarGrupoCurso, quitarGrupoCurso } from "../api/cursos.ts";
import { getProveedores, createProveedor, getCategorias, getTipos, getClasificaciones } from "../api/cursosCatalogo.ts";
import type { Proveedor, CursoCatSimple } from "../api/cursosCatalogo.ts";
import type { CursoPuestoDetail, CursoEmpleadoDetail, EmpleadoElegible, CursoGrupoItem, CursoCatalogos } from "../api/cursos.ts";
import type { Curso, CursoListResponse, CursoCreatePayload, CursoSesion, CursoSesionCreatePayload, SesionEmpleadoItem } from "../dashboard/cursos/types.ts";
import { TIPO_LABELS, CLASIFICACION_LABELS, CATEGORIA_LABELS, ESTADO_SESION_LABELS } from "../dashboard/cursos/types.ts";
import { hasRhModule } from "../auth/rhModulePermissions.ts";
import { getEmpleadosPage } from "../api/empleados.ts";
import type { UsuarioListItem } from "../api/usuarios.ts";


// ── Dashboard: tipos, datos fake y helpers ──────────────────────────────────

interface DashKpi {
  label: string;
  value: string;
  suffix?: string;
  spark: number[];
  delta: string;
  deltaPositive: boolean;
  sub: string;
}

interface DashAreaRow {
  nombre: string;
  personas: number;
  cumplimiento: number;
  brechas: number;
}

interface DashCapacitacion {
  dia: string;
  mes: string;
  curso: string;
  instructor: string;
  modalidad: string;
  cuposUsados: number;
  cuposTotal: number;
}

interface DashEvidencia {
  colaborador: string;
  curso: string;
  tipo: "documento" | "video";
  subida: string;
  estado: string;
  estadoColor: "warn" | "info";
}

interface DashSugerencia {
  nombre: string;
  razon: string;
  impacto: "Alto" | "Medio";
  fuente: string;
}

const DASH_KPIS: DashKpi[] = [
  { label: "Cumplimiento global", value: "87", suffix: "%", spark: [12,14,13,15,17,16,18,19,18,20,21,22], delta: "+2.4", deltaPositive: true, sub: "vs. abril 2026" },
  { label: "Brechas críticas abiertas", value: "34", spark: [44,46,42,41,40,38,40,37,36,35,34,34], delta: "-6", deltaPositive: true, sub: "11 colaboradores · 4 áreas" },
  { label: "Capacitaciones activas", value: "84", spark: [50,55,52,60,58,65,68,72,75,78,80,84], delta: "+12", deltaPositive: true, sub: "esta semana · 6 vencidas" },
  { label: "Score medio post curso", value: "4.4", suffix: "/5", spark: [40,42,41,43,44,43,44,45,44,44,45,44], delta: "+0.2", deltaPositive: true, sub: "218 encuestas mes" },
];

const DASH_AREAS: DashAreaRow[] = [
  { nombre: "Cableado · Línea 1", personas: 28, cumplimiento: 92, brechas: 5 },
  { nombre: "Cableado · Línea 3", personas: 32, cumplimiento: 78, brechas: 12 },
  { nombre: "Ensamble · Línea 2", personas: 24, cumplimiento: 84, brechas: 7 },
  { nombre: "Ensamble · Línea 5", personas: 36, cumplimiento: 71, brechas: 14 },
  { nombre: "Prueba Eléctrica", personas: 18, cumplimiento: 88, brechas: 4 },
  { nombre: "Calidad", personas: 14, cumplimiento: 95, brechas: 2 },
  { nombre: "Mantenimiento", personas: 22, cumplimiento: 81, brechas: 9 },
];

const DASH_CAPACITACIONES: DashCapacitacion[] = [
  { dia: "13", mes: "MAY", curso: "IPC-A-620 · Inspección visual", instructor: "Sandra Peña", modalidad: "Aula B-2", cuposUsados: 12, cuposTotal: 14 },
  { dia: "14", mes: "MAY", curso: "Seguridad eléctrica LOTO", instructor: "Hugo Cárdenas", modalidad: "Aula A-1", cuposUsados: 18, cuposTotal: 20 },
  { dia: "14", mes: "MAY", curso: "OPL-2041 · Cambio herramental", instructor: "Rafael Cuevas", modalidad: "En piso · L3", cuposUsados: 8, cuposTotal: 8 },
  { dia: "16", mes: "MAY", curso: "Lectura de plano eléctrico", instructor: "Jorge Salazar", modalidad: "Aula B-1", cuposUsados: 6, cuposTotal: 12 },
  { dia: "18", mes: "MAY", curso: "Hi-Pot · Operación segura", instructor: "Patricia Loera", modalidad: "Lab E.E.", cuposUsados: 4, cuposTotal: 10 },
];

const DASH_EVIDENCIAS: DashEvidencia[] = [
  { colaborador: "Diego Hurtado Vidal", curso: "OPL-2041 · Cambio herramental", tipo: "documento", subida: "hace 2h", estado: "En revisión", estadoColor: "warn" },
  { colaborador: "Brenda Valdez Aguilar", curso: "Crimpado manual · Nivel 2", tipo: "video", subida: "hace 5h", estado: "En revisión", estadoColor: "warn" },
  { colaborador: "Adrián Carmona Soto", curso: "IPC-A-620 · Inspección visual", tipo: "documento", subida: "hace 6h", estado: "Esperando firma", estadoColor: "info" },
];

const DASH_SUGERENCIAS: DashSugerencia[] = [
  { nombre: "Diagnóstico de continuidad · avanzado", razon: "Brecha L5 · 14 personas debajo del nivel", impacto: "Alto", fuente: "Brecha interna" },
  { nombre: "IPC/WHMA-A-620 Rev.D 2026", razon: "Estándar sector · cambio versión ene 2026", impacto: "Medio", fuente: "Mercado laboral" },
];

function dashSparkline(values: number[], color: string): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 64;
  const h = 24;
  const padding = 2;
  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (w - padding * 2);
    const y = h - padding - ((v - min) / range) * (h - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return `<svg width="${w}" height="${h}" class="shrink-0" aria-hidden="true"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function renderDashHeader(): string {
  return `
  <div class="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <p class="text-xs font-medium text-text-muted">Inicio · Planta Hermosillo</p>
      <h1 class="mt-0.5 text-xl font-bold text-text-primary">Resumen operativo</h1>
      <p class="mt-1 text-sm text-text-muted">Vista consolidada de capacitación, brechas y cumplimiento de la planta para la semana del 12 al 18 de mayo.</p>
    </div>
    <div class="mt-3 flex flex-wrap items-center gap-2 sm:mt-0">
      <button type="button" class="${BTN_SECONDARY} opacity-60 cursor-not-allowed" disabled>Semana 19</button>
      <button type="button" class="${BTN_SECONDARY} opacity-60 cursor-not-allowed" disabled>Exportar</button>
      <button type="button" class="${BTN_PRIMARY} opacity-60 cursor-not-allowed" disabled>Asignar capacitación</button>
    </div>
  </div>`;
}

function renderDashKpis(): string {
  return `
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    ${DASH_KPIS.map(k => `
      <div class="rounded-xl border border-border bg-white p-4">
        <p class="text-xs font-medium text-text-muted">${escapeHtml(k.label)}</p>
        <div class="mt-2 flex items-end justify-between gap-2">
          <p class="text-2xl font-bold tabular-nums text-text-primary">${k.value}${k.suffix ? `<span class="text-sm font-medium text-slate-400">${k.suffix}</span>` : ""}</p>
          ${dashSparkline(k.spark, "var(--color-accent, #2563EB)")}
        </div>
        <div class="mt-2 flex items-center gap-1.5">
          <span class="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-700">
            <span aria-hidden="true">${k.deltaPositive ? "↑" : "↓"}</span>${k.delta}
          </span>
          <span class="text-[11px] text-slate-500">${escapeHtml(k.sub)}</span>
        </div>
      </div>
    `).join("")}
  </div>`;
}

function dashSemaforoPill(cumplimiento: number): string {
  if (cumplimiento >= 90) return `<span class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">Verde</span>`;
  if (cumplimiento >= 80) return `<span class="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Ámbar</span>`;
  return `<span class="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-800">Rojo</span>`;
}

function renderDashAreas(): string {
  return `
  <div class="rounded-xl border border-border bg-white">
    <div class="flex flex-col gap-1 border-b border-slate-100 px-5 py-4">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold text-text-primary">Cumplimiento y brechas por área</h2>
      </div>
      <p class="text-xs text-text-muted">Brechas activas detectadas por la matriz de multihabilidades</p>
      <div class="mt-2 flex items-center gap-3">
        <span class="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600"><span class="inline-block size-2.5 rounded-sm bg-blue-500" aria-hidden="true"></span>Cumplimiento</span>
        <span class="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600"><span class="inline-block size-2.5 rounded-sm bg-red-400" aria-hidden="true"></span>Brechas</span>
      </div>
    </div>
    <div class="flex flex-col divide-y divide-slate-100 px-5">
      ${DASH_AREAS.map(a => {
        const brecha = 100 - a.cumplimiento;
        return `
        <div class="flex items-center gap-3 py-3">
          <div class="w-36 shrink-0">
            <p class="text-sm font-medium text-text-primary">${escapeHtml(a.nombre)}</p>
            <p class="text-[11px] text-slate-500">${a.personas} personas</p>
          </div>
          <div class="relative flex h-5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div class="flex h-full items-center justify-end rounded-l-full bg-blue-500 pr-1.5 text-[10px] font-semibold text-white" style="width:${a.cumplimiento}%">${a.cumplimiento}%</div>
            <div class="h-full bg-red-400" style="width:${brecha}%"></div>
          </div>
          <span class="w-12 text-right text-xs font-semibold tabular-nums text-slate-700">${a.brechas}</span>
          ${dashSemaforoPill(a.cumplimiento)}
        </div>`;
      }).join("")}
    </div>
  </div>`;
}

function renderDashCapacitaciones(): string {
  return `
  <div class="rounded-xl border border-border bg-white">
    <div class="flex items-start justify-between border-b border-slate-100 px-5 py-4">
      <div>
        <h2 class="text-sm font-semibold text-text-primary">Próximas capacitaciones</h2>
        <p class="mt-0.5 text-xs text-text-muted">Semana en curso · 5 sesiones programadas</p>
      </div>
      <button type="button" class="text-xs font-semibold text-blue-600 opacity-60 cursor-not-allowed" disabled>Ver calendario ›</button>
    </div>
    <div class="flex flex-col divide-y divide-slate-100">
      ${DASH_CAPACITACIONES.map(c => {
        const cupoFull = c.cuposUsados >= c.cuposTotal;
        const cupoCls = cupoFull
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-slate-200 bg-slate-50 text-slate-700";
        return `
        <div class="flex items-center gap-3 px-5 py-3">
          <div class="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
            <span class="text-sm font-bold leading-none text-text-primary">${c.dia}</span>
            <span class="text-[9px] font-semibold uppercase text-slate-500">${c.mes}</span>
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-text-primary">${escapeHtml(c.curso)}</p>
            <p class="text-[11px] text-slate-500">${escapeHtml(c.instructor)} · ${escapeHtml(c.modalidad)}</p>
          </div>
          <span class="inline-flex items-center rounded-full border ${cupoCls} px-2 py-0.5 text-[10px] font-semibold tabular-nums">${c.cuposUsados}/${c.cuposTotal}</span>
        </div>`;
      }).join("")}
    </div>
  </div>`;
}

function renderDashEvidencias(): string {
  const tipoIcon = (tipo: "documento" | "video"): string => {
    if (tipo === "documento") return `<svg class="size-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg>`;
    return `<svg class="size-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"/></svg>`;
  };

  return `
  <div class="rounded-xl border border-border bg-white">
    <div class="flex items-start justify-between border-b border-slate-100 px-5 py-4">
      <div>
        <h2 class="text-sm font-semibold text-text-primary">Evidencias pendientes de validar</h2>
        <p class="mt-0.5 text-xs text-text-muted">18 evidencias en bandeja · SLA promedio 1.4 días</p>
      </div>
      <button type="button" class="text-xs font-semibold text-blue-600 opacity-60 cursor-not-allowed" disabled>Ir a bandeja ›</button>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr class="border-b border-slate-100 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            <th class="px-5 py-2">Colaborador</th>
            <th class="px-3 py-2">Curso / OPL</th>
            <th class="px-3 py-2">Tipo</th>
            <th class="px-3 py-2">Subida</th>
            <th class="px-3 py-2">Estado</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${DASH_EVIDENCIAS.map(e => {
            const initials = e.colaborador.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
            const estadoCls = e.estadoColor === "warn"
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-blue-200 bg-blue-50 text-blue-800";
            const tipoCls = "border-slate-200 bg-slate-50 text-slate-700";
            return `
            <tr>
              <td class="px-5 py-2.5">
                <div class="flex items-center gap-2">
                  <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-leoni-blue text-[10px] font-bold text-white">${initials}</span>
                  <span class="text-sm font-medium text-text-primary">${escapeHtml(e.colaborador)}</span>
                </div>
              </td>
              <td class="px-3 py-2.5 text-xs text-slate-700">${escapeHtml(e.curso)}</td>
              <td class="px-3 py-2.5"><span class="inline-flex items-center gap-1 rounded-full border ${tipoCls} px-2 py-0.5 text-[10px] font-semibold">${tipoIcon(e.tipo)}${e.tipo}</span></td>
              <td class="px-3 py-2.5 text-xs text-slate-500">${escapeHtml(e.subida)}</td>
              <td class="px-3 py-2.5"><span class="inline-flex items-center rounded-full border ${estadoCls} px-2 py-0.5 text-[10px] font-semibold">${escapeHtml(e.estado)}</span></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderDashSugerencias(): string {
  return `
  <div class="rounded-xl border border-border bg-white">
    <div class="flex items-start justify-between border-b border-slate-100 px-5 py-4">
      <div>
        <h2 class="text-sm font-semibold text-text-primary">Sugerencias del motor</h2>
        <p class="mt-0.5 text-xs text-text-muted">Justificadas por brechas y mercado</p>
      </div>
      <span class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold tabular-nums text-blue-800">11</span>
    </div>
    <div class="flex flex-col gap-3 p-5">
      ${DASH_SUGERENCIAS.map(s => {
        const impactoCls = s.impacto === "Alto"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-amber-200 bg-amber-50 text-amber-800";
        return `
        <div class="rounded-lg border border-slate-200 p-3">
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700">${escapeHtml(s.fuente)}</span>
            <span class="inline-flex items-center rounded-full border ${impactoCls} px-2 py-0.5 text-[10px] font-semibold">${escapeHtml(s.impacto)}</span>
          </div>
          <p class="mt-2 text-sm font-medium text-text-primary">${escapeHtml(s.nombre)}</p>
          <p class="mt-0.5 text-[11px] text-slate-500">${escapeHtml(s.razon)}</p>
        </div>`;
      }).join("")}
    </div>
  </div>`;
}

function renderDashboardPage(): string {
  return `
  <div class="flex flex-col gap-5">
    ${renderDashHeader()}
    ${renderDashKpis()}
    <div class="grid grid-cols-1 gap-5 lg:grid-cols-[1.35fr_1fr]">
      ${renderDashAreas()}
      ${renderDashCapacitaciones()}
    </div>
    <div class="grid grid-cols-1 gap-5 lg:grid-cols-[1.35fr_1fr]">
      ${renderDashEvidencias()}
      ${renderDashSugerencias()}
    </div>
  </div>`;
}

export function mountLevelUpDashboard(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Level Up",
    activeNav: "level-up",
    mainHtml: renderDashboardPage(),
  });
}

export function mountCursos(container: HTMLElement, signal: AbortSignal): void {
  const isRH = hasRhModule("cursos");

  const ICON_PLUS = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/></svg>`;
  const ICON_SEARCH = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-5" aria-hidden="true"><path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd"/></svg>`;
  const ICON_BOOK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0118 18a8.967 8.967 0 016 2.292m0-14.25v14.25"/></svg>`;
  const ICON_SHIELD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>`;
  const ICON_BUILDING = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z"/></svg>`;
  const ICON_GLOBE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"/></svg>`;
  const ICON_CLIPBOARD_EMPTY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="mx-auto size-12 text-slate-300" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>`;

  const FILTER_SELECT_CLS = `${RH_LISTADO_SELECT} col-start-1 row-start-1 appearance-none ${RH_LISTADO_FOCUS_RING}`;
  const FILTER_INPUT_CLS = `block w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}`;

  interface CursoModalDraft {
    nombre: string;
    clasificacion_id: string;
    tipo_id: string;
    duracion_horas: string;
    categoria_id: string;
    proveedor_id: string;
    centro_costos: string;
    descripcion: string;
    requisitos: string;
    obligatorio: boolean;
  }

  interface CursosState {
    cursos: CursoListResponse;
    loading: boolean;
    page: number;
    filters: { tipo: string; clasificacion: string; obligatorio: string; categoria: string; busqueda: string };
    showCreateModal: boolean;
    editingCurso: Curso | null;
    viewMode: "tarjetas" | "tabla";
    empleados: { id: number; nombre: string }[];
    empleadosLoaded: boolean;
    detailCurso: Curso | null;
    detailPuestos: CursoPuestoDetail[];
    detailEmpleadosExtra: CursoEmpleadoDetail[];
    detailGrupos: CursoGrupoItem[];
    detailSesiones: CursoSesion[];
    showCreateSesionModal: boolean;
    viewingSesion: CursoSesion | null;
    sesionEmpleados: SesionEmpleadoItem[];
    selectedEmpleados: Set<number>;
    showAssignSesionPicker: boolean;
    expandedGrupos: Set<number>;
    expandedPuestos: Set<number>;
    expandedExtras: boolean;
    showAsignacionMasivaModal: boolean;
    asignacionCatalogos: CursoCatalogos | null;
    asignacionCatalogosLoading: boolean;
    asignacionAreaId: number | null;
    asignacionSubareaId: number | null;
    asignacionPuestoId: number | null;
    asignacionLoading: boolean;
    asignacionResult: { asignados: number; ya_asignados: number } | null;
    proveedoresCatalog: Proveedor[];
    proveedoresLoading: boolean;
    categoriasCatalog: CursoCatSimple[];
    tiposCatalog: CursoCatSimple[];
    clasificacionesCatalog: CursoCatSimple[];
    showNuevoProveedorPanel: boolean;
    nuevoProveedorNombre: string;
    nuevoProveedorSaving: boolean;
    nuevoProveedorError: string;
    pendingProveedorId: number | null;
    cursoModalDraft: CursoModalDraft | null;
  }

  const state: CursosState = {
    cursos: { items: [], total: 0, page: 1, page_size: 20 },
    loading: true,
    page: 1,
    filters: { tipo: "", clasificacion: "", obligatorio: "", categoria: "", busqueda: "" },
    showCreateModal: false,
    editingCurso: null,
    viewMode: "tabla",
    empleados: [],
    empleadosLoaded: false,
    detailCurso: null,
    detailPuestos: [],
    detailEmpleadosExtra: [],
    detailGrupos: [],
    detailSesiones: [],
    showCreateSesionModal: false,
    viewingSesion: null,
    sesionEmpleados: [],
    selectedEmpleados: new Set(),
    showAssignSesionPicker: false,
    expandedGrupos: new Set(),
    expandedPuestos: new Set(),
    expandedExtras: false,
    showAsignacionMasivaModal: false,
    asignacionCatalogos: null,
    asignacionCatalogosLoading: false,
    asignacionAreaId: null,
    asignacionSubareaId: null,
    asignacionPuestoId: null,
    asignacionLoading: false,
    asignacionResult: null,
    proveedoresCatalog: [],
    proveedoresLoading: false,
    categoriasCatalog: [],
    tiposCatalog: [],
    clasificacionesCatalog: [],
    showNuevoProveedorPanel: false,
    nuevoProveedorNombre: "",
    nuevoProveedorSaving: false,
    nuevoProveedorError: "",
    pendingProveedorId: null,
    cursoModalDraft: null,
  };

  async function loadEmpleados() {
    if (state.empleadosLoaded) return;
    try {
      let page = 1;
      let all: { id: number; nombre: string }[] = [];
      let total = Infinity;
      while (all.length < total) {
        const res = await getEmpleadosPage({ page, page_size: 100 });
        total = res.total;
        all = all.concat(res.items.map((e: UsuarioListItem) => ({ id: e.id, nombre: e.nombre })));
        page++;
        if (res.items.length < 100) break;
      }
      all.sort((a, b) => a.nombre.localeCompare(b.nombre));
      state.empleados = all;
      state.empleadosLoaded = true;
    } catch { /* ignore */ }
  }

  async function loadCursos() {
    try {
      state.cursos = await getCursos({
        page: state.page,
        page_size: 20,
        tipo: state.filters.tipo || undefined,
        clasificacion: state.filters.clasificacion || undefined,
        obligatorio: state.filters.obligatorio ? state.filters.obligatorio === "true" : undefined,
        categoria: state.filters.categoria || undefined,
        busqueda: state.filters.busqueda || undefined,
      });
    } catch {
      state.cursos = { items: [], total: 0, page: 1, page_size: 20 };
    }
  }

  function captureCursoModalDraft(): void {
    if (!state.showCreateModal && !state.editingCurso) return;
    const form = container.querySelector<HTMLFormElement>('form[data-action="submit-curso"]');
    if (!form) return;
    const fd = new FormData(form);
    state.cursoModalDraft = {
      nombre: String(fd.get("nombre") ?? ""),
      clasificacion_id: String(fd.get("clasificacion_id") ?? ""),
      tipo_id: String(fd.get("tipo_id") ?? ""),
      duracion_horas: String(fd.get("duracion_horas") ?? ""),
      categoria_id: String(fd.get("categoria_id") ?? ""),
      proveedor_id: String(fd.get("proveedor_id") ?? ""),
      centro_costos: String(fd.get("centro_costos") ?? ""),
      descripcion: String(fd.get("descripcion") ?? ""),
      requisitos: String(fd.get("requisitos") ?? ""),
      obligatorio: form.querySelector<HTMLInputElement>("[name='obligatorio']")?.checked ?? false,
    };
  }

  function resetProveedorPanelState(): void {
    state.showNuevoProveedorPanel = false;
    state.nuevoProveedorNombre = "";
    state.nuevoProveedorSaving = false;
    state.nuevoProveedorError = "";
    state.pendingProveedorId = null;
  }

  async function loadCursoModalCatalogos(): Promise<void> {
    state.proveedoresLoading = true;
    render();
    const params = { page: 1, page_size: 200, solo_activos: true };
    try {
      const [categorias, tipos, clasificaciones, proveedores] = await Promise.all([
        getCategorias(params),
        getTipos(params),
        getClasificaciones(params),
        getProveedores(params),
      ]);
      state.categoriasCatalog = categorias.items;
      state.tiposCatalog = tipos.items;
      state.clasificacionesCatalog = clasificaciones.items;
      state.proveedoresCatalog = proveedores.items;
    } catch {
      state.categoriasCatalog = [];
      state.tiposCatalog = [];
      state.clasificacionesCatalog = [];
      state.proveedoresCatalog = [];
    }
    state.proveedoresLoading = false;
    render();
  }

  function catalogItemLabel(nombre: string, labels: Record<string, string>): string {
    return labels[nombre] ?? nombre;
  }

  function renderCatalogSelect(
    name: string,
    items: CursoCatSimple[],
    selectedId: number | null | undefined,
    draftValue: string | undefined,
    labels: Record<string, string>,
    modalFieldCls: string,
    inactiveLabel: string | null | undefined,
  ): string {
    const selected = draftValue || (selectedId != null ? String(selectedId) : "");
    const matched = items.some((item) => String(item.id) === selected);
    const disabled = state.proveedoresLoading ? " disabled" : "";
    let options = state.proveedoresLoading
      ? `<option value="" selected>Cargando…</option>`
      : `<option value="">—</option>`;
    if (!state.proveedoresLoading) {
      for (const item of items) {
        const isSelected = String(item.id) === selected ? " selected" : "";
        options += `<option value="${item.id}"${isSelected}>${escapeHtml(catalogItemLabel(item.nombre, labels))}</option>`;
      }
      if (selected && !matched) {
        options += `<option value="${escapeHtml(selected)}" selected>${escapeHtml(inactiveLabel ?? "Registro")} (inactivo)</option>`;
      }
    }
    return `<select name="${name}" class="${modalFieldCls}"${disabled}>${options}</select>`;
  }

  async function loadProveedoresForCursoModal(): Promise<void> {
    await loadCursoModalCatalogos();
  }

  async function openCursoModal(curso: Curso | null): Promise<void> {
    if (curso) {
      state.editingCurso = curso;
      state.showCreateModal = false;
    } else {
      state.showCreateModal = true;
      state.editingCurso = null;
    }
    state.proveedoresCatalog = [];
    state.categoriasCatalog = [];
    state.tiposCatalog = [];
    state.clasificacionesCatalog = [];
    state.cursoModalDraft = null;
    resetProveedorPanelState();
    render();
    await loadCursoModalCatalogos();
  }

  function closeCursoModal(): void {
    state.showCreateModal = false;
    state.editingCurso = null;
    state.proveedoresCatalog = [];
    state.categoriasCatalog = [];
    state.tiposCatalog = [];
    state.clasificacionesCatalog = [];
    state.proveedoresLoading = false;
    state.cursoModalDraft = null;
    resetProveedorPanelState();
  }

  async function saveNuevoProveedorFromCursoModal(): Promise<void> {
    const nombre = state.nuevoProveedorNombre.trim();
    if (nombre.length < 2) {
      state.nuevoProveedorError = "El nombre debe tener al menos 2 caracteres.";
      render();
      return;
    }
    state.nuevoProveedorSaving = true;
    state.nuevoProveedorError = "";
    render();
    try {
      const created = await createProveedor({ nombre });
      state.proveedoresCatalog = [...state.proveedoresCatalog, created]
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
      if (state.cursoModalDraft) state.cursoModalDraft.proveedor_id = String(created.id);
      state.pendingProveedorId = created.id;
      state.showNuevoProveedorPanel = false;
      state.nuevoProveedorNombre = "";
      state.nuevoProveedorSaving = false;
      state.nuevoProveedorError = "";
      render();
      container.querySelector<HTMLInputElement>('form[data-action="submit-curso"] input[name="nombre"]')?.focus();
    } catch (err: unknown) {
      state.nuevoProveedorSaving = false;
      state.nuevoProveedorError = (err as { detail?: string }).detail ?? "No se pudo crear el proveedor.";
      render();
    }
  }

  function renderProveedorSectionForCurso(
    c: Curso | null,
    draft: CursoModalDraft | null,
    modalFieldCls: string,
  ): string {
    const selectedId = state.pendingProveedorId
      ?? (draft?.proveedor_id ? Number(draft.proveedor_id) : null)
      ?? c?.proveedor_id
      ?? null;
    const proveedores = state.proveedoresCatalog;
    const matched = proveedores.some((p) => p.id === selectedId);
    const disabled = state.proveedoresLoading ? " disabled" : "";
    let options = state.proveedoresLoading
      ? `<option value="" selected>Cargando proveedores…</option>`
      : `<option value="">Seleccionar proveedor…</option>`;
    if (!state.proveedoresLoading) {
      for (const p of proveedores) {
        const isSelected = p.id === selectedId ? " selected" : "";
        options += `<option value="${p.id}"${isSelected}>${escapeHtml(p.nombre)}</option>`;
      }
      if (selectedId && !matched) {
        options += `<option value="${selectedId}" selected>${escapeHtml(c?.proveedor_nombre ?? "Proveedor")} (inactivo)</option>`;
      }
    }
    const panel = state.showNuevoProveedorPanel ? `
      <div class="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-3">
        <p class="text-xs font-semibold text-text-primary">Nuevo proveedor</p>
        <div>
          <label for="nuevo-proveedor-nombre" class="${RH_LISTADO_LABEL}">Nombre <span class="text-red-600" aria-hidden="true">*</span></label>
          <input id="nuevo-proveedor-nombre" type="text" data-action="nuevo-proveedor-nombre" maxlength="255" value="${escapeHtml(state.nuevoProveedorNombre)}" class="${modalFieldCls}" />
        </div>
        ${state.nuevoProveedorError ? `<p class="text-xs text-red-700" role="alert">${escapeHtml(state.nuevoProveedorError)}</p>` : ""}
        <div class="flex flex-wrap gap-2">
          <button type="button" data-action="save-nuevo-proveedor" class="${RH_LISTADO_BTN_PRIMARY} text-xs" ${state.nuevoProveedorSaving ? "disabled" : ""}>${state.nuevoProveedorSaving ? "Guardando…" : "Guardar proveedor"}</button>
          <button type="button" data-action="cancel-nuevo-proveedor" class="${BTN_SECONDARY} text-xs">Cancelar</button>
        </div>
      </div>` : "";
    return `
      <div class="grid grid-cols-1">
        <select name="proveedor_id" class="${FILTER_SELECT_CLS}"${disabled}>
          ${options}
        </select>
        ${SELECT_CHEVRON}
      </div>
      <button type="button" data-action="toggle-nuevo-proveedor" class="mt-2 ${RH_LISTADO_BTN_GHOST} text-xs">
        ${state.showNuevoProveedorPanel ? "Ocultar formulario" : "+ Crear nuevo proveedor"}
      </button>
      ${panel}`;
  }

  function cursoCatBadge(cat: string | null): string {
    if (!cat) return "";
    const colors: Record<string, { border: string; bg: string; text: string; dot: string }> = {
      tecnico: { border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-800", dot: "bg-blue-500" },
      calidad: { border: "border-sky-200", bg: "bg-sky-50", text: "text-sky-800", dot: "bg-sky-500" },
      seguridad: { border: "border-red-200", bg: "bg-red-50", text: "text-red-800", dot: "bg-red-400" },
      operativo: { border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-800", dot: "bg-amber-400" },
      blanda: { border: "border-violet-200", bg: "bg-violet-50", text: "text-violet-800", dot: "bg-violet-500" },
    };
    const c = colors[cat] ?? { border: "border-gray-200", bg: "bg-gray-50", text: "text-gray-700", dot: "bg-gray-400" };
    const label = CATEGORIA_LABELS[cat] ?? cat;
    return `<span class="inline-flex items-center gap-1.5 rounded-full border ${c.border} ${c.bg} px-2 py-0.5 text-[11px] font-semibold ${c.text}"><span class="size-1.5 shrink-0 rounded-full ${c.dot}" aria-hidden="true"></span>${escapeHtml(label)}</span>`;
  }

  function cursoTipoBadge(tipo: string | null): string {
    if (!tipo) return "";
    const isInterno = tipo === "interno";
    const cls = isInterno
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-purple-200 bg-purple-50 text-purple-800";
    return `<span class="inline-flex items-center rounded-full border ${cls} px-2 py-0.5 text-[10px] font-semibold">${TIPO_LABELS[tipo] ?? tipo}</span>`;
  }

  function kpiSkeletonCard(): string {
    return `<article class="rh-dash-kpi-card rh-dash-kpi-card--skeleton animate-pulse rounded-[18px] p-5">
      <div class="h-3 w-24 rounded bg-slate-200/90"></div>
      <div class="mt-4 h-8 w-16 rounded bg-slate-200/90"></div>
      <div class="mt-2 h-3 w-32 rounded bg-slate-100/90"></div>
    </article>`;
  }

  function renderCursosPageHeader(): string {
    return `
    <header class="cc-page-header flex flex-col gap-3">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">Catálogo de cursos</h1>
          <p class="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
            Consulta, filtra y administra los cursos disponibles para capacitación y asignación a puestos.
          </p>
        </div>
        ${isRH ? `<button type="button" data-action="open-create-curso" class="${RH_LISTADO_BTN_PRIMARY} cc-btn-nueva w-full shrink-0 sm:w-auto sm:self-start">
          ${ICON_PLUS}<span>Nuevo curso</span>
        </button>` : ""}
      </div>
    </header>`;
  }

  function renderCursosLoading(): string {
    return `
    <div class="${RH_LISTADO_PAGE_OUTER} cc-page" aria-busy="true" aria-label="Cargando catálogo de cursos">
      ${renderLevelUpBackBar()}
      <div class="h-6 w-56 animate-pulse rounded-md bg-slate-200/90"></div>
      <div class="h-16 w-full max-w-2xl animate-pulse rounded-xl bg-slate-100/90"></div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">${kpiSkeletonCard()}${kpiSkeletonCard()}${kpiSkeletonCard()}${kpiSkeletonCard()}</div>
      <div class="h-36 animate-pulse rounded-2xl border border-slate-200/80 bg-white"></div>
      <div class="h-64 animate-pulse rounded-2xl border border-slate-200/80 bg-white"></div>
    </div>`;
  }

  function renderCursosKpis(): string {
    const total = state.cursos.total;
    const items = state.cursos.items;
    const obligatorios = items.filter(c => c.obligatorio).length;
    const internos = items.filter(c => c.tipo_nombre === "interno").length;
    const externos = items.filter(c => c.tipo_nombre === "externo").length;

    const kpis = [
      {
        label: "Total catálogo",
        value: String(total),
        sub: "Cursos registrados",
        icon: ICON_BOOK,
        iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--blue",
      },
      {
        label: "Obligatorios",
        value: String(obligatorios),
        sub: "En la página actual",
        icon: ICON_SHIELD,
        iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--violet",
      },
      {
        label: "Internos",
        value: String(internos),
        sub: "Impartidos en planta",
        icon: ICON_BUILDING,
        iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--sky",
      },
      {
        label: "Externos",
        value: String(externos),
        sub: "Con proveedor externo",
        icon: ICON_GLOBE,
        iconWrap: "rh-dash-kpi-icon rh-dash-kpi-icon--amber",
      },
    ];

    return `
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" role="group" aria-label="Resumen del catálogo">
      ${kpis.map((k) => `
      <article class="rh-dash-kpi-card rounded-[18px] p-5">
        <div class="flex items-start justify-between gap-3">
          <p class="text-xs font-semibold text-text-muted">${escapeHtml(k.label)}</p>
          <span class="${k.iconWrap} size-11 shrink-0 [&_svg]:size-5">${k.icon}</span>
        </div>
        <p class="mt-3 text-3xl font-bold tabular-nums tracking-tight text-text-primary">${k.value}</p>
        <p class="mt-1.5 text-xs leading-snug text-text-secondary">${escapeHtml(k.sub)}</p>
      </article>`).join("")}
    </div>`;
  }

  function hasActiveFilters(): boolean {
    return !!(state.filters.tipo || state.filters.clasificacion || state.filters.obligatorio || state.filters.categoria || state.filters.busqueda);
  }

  function renderFilterSection(): string {
    const total = state.cursos.total;
    const hasFilters = hasActiveFilters();
    const resultsLine = hasFilters
      ? `Mostrando <strong class="font-semibold text-text-primary tabular-nums">${total}</strong> cursos`
      : `<strong class="font-semibold text-text-primary tabular-nums">${total}</strong> cursos en catálogo`;

    return `
    <section class="${RH_LISTADO_SURFACE} cc-filters p-4 sm:p-5" aria-label="Filtros de cursos">
      <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-sm font-semibold text-text-primary">Buscar y filtrar</h2>
          <p class="mt-0.5 text-xs text-text-muted">Localiza cursos por nombre, tipo, categoría o clasificación.</p>
        </div>
        <p class="text-xs text-text-muted" aria-live="polite">${resultsLine}</p>
      </div>
      <div class="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-3 sm:gap-x-3">
        <div class="${FILTER_FIELD_WRAP} min-w-[min(100%,20rem)] flex-[1_1_18rem]">
          <label for="cursos-search" class="${RH_LISTADO_LABEL}">Buscar</label>
          <div class="relative mt-1">
            <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">${ICON_SEARCH}</span>
            <input id="cursos-search" data-action="cursos-search" type="search" autocomplete="off" placeholder="Nombre del curso…" value="${escapeHtml(state.filters.busqueda)}" class="${FILTER_INPUT_CLS}" />
          </div>
        </div>
        <div class="${FILTER_FIELD_WRAP}">
          <label for="cursos-filter-tipo" class="${RH_LISTADO_LABEL}">Tipo</label>
          <div class="relative mt-1 grid grid-cols-1">
            <select id="cursos-filter-tipo" data-action="cursos-filter-tipo" class="${FILTER_SELECT_CLS}">
              <option value="">Todos los tipos</option>
              <option value="interno" ${state.filters.tipo === "interno" ? "selected" : ""}>Interno</option>
              <option value="externo" ${state.filters.tipo === "externo" ? "selected" : ""}>Externo</option>
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
        <div class="${FILTER_FIELD_WRAP}">
          <label for="cursos-filter-clasificacion" class="${RH_LISTADO_LABEL}">Clasificación</label>
          <div class="relative mt-1 grid grid-cols-1">
            <select id="cursos-filter-clasificacion" data-action="cursos-filter-clasificacion" class="${FILTER_SELECT_CLS}">
              <option value="">Todas</option>
              <option value="adicional" ${state.filters.clasificacion === "adicional" ? "selected" : ""}>Adicional</option>
              <option value="contemplado" ${state.filters.clasificacion === "contemplado" ? "selected" : ""}>Contemplado</option>
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
        <div class="${FILTER_FIELD_WRAP}">
          <label for="cursos-filter-categoria" class="${RH_LISTADO_LABEL}">Categoría</label>
          <div class="relative mt-1 grid grid-cols-1">
            <select id="cursos-filter-categoria" data-action="cursos-filter-categoria" class="${FILTER_SELECT_CLS}">
              <option value="">Todas</option>
              <option value="tecnico" ${state.filters.categoria === "tecnico" ? "selected" : ""}>Técnico</option>
              <option value="calidad" ${state.filters.categoria === "calidad" ? "selected" : ""}>Calidad</option>
              <option value="seguridad" ${state.filters.categoria === "seguridad" ? "selected" : ""}>Seguridad</option>
              <option value="operativo" ${state.filters.categoria === "operativo" ? "selected" : ""}>Operativo</option>
              <option value="blanda" ${state.filters.categoria === "blanda" ? "selected" : ""}>Blanda</option>
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
        <div class="${FILTER_FIELD_WRAP}">
          <label for="cursos-filter-obligatorio" class="${RH_LISTADO_LABEL}">Obligatorio</label>
          <div class="relative mt-1 grid grid-cols-1">
            <select id="cursos-filter-obligatorio" data-action="cursos-filter-obligatorio" class="${FILTER_SELECT_CLS}">
              <option value="">Todos</option>
              <option value="true" ${state.filters.obligatorio === "true" ? "selected" : ""}>Sí</option>
              <option value="false" ${state.filters.obligatorio === "false" ? "selected" : ""}>No</option>
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
        ${hasFilters ? `
        <div class="w-full shrink-0 sm:w-auto xl:ml-1">
          <button type="button" data-action="cursos-clear-filters" class="${RH_LISTADO_BTN_GHOST} w-full text-xs sm:w-auto">Limpiar filtros</button>
        </div>` : ""}
      </div>
    </section>`;
  }

  function renderCursoCard(c: Curso): string {
    const horas = c.duracion_horas != null ? `${c.duracion_horas}h` : "—";
    return `
    <article class="cc-curso-card flex flex-col gap-3 rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.04)] transition hover:border-slate-300/90 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
      <div class="flex items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-2">
          ${cursoCatBadge(c.categoria_nombre)}
          ${c.obligatorio ? `<span class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">Obligatorio</span>` : ""}
        </div>
        ${cursoTipoBadge(c.tipo_nombre)}
      </div>
      <div class="min-w-0 flex-1">
        <button data-action="view-curso" data-id="${c.id}" class="text-left text-sm font-semibold leading-snug text-text-primary line-clamp-2 transition hover:text-leoni-blue hover:underline">${escapeHtml(c.nombre)}</button>
        <p class="mt-1.5 text-xs text-text-muted">${escapeHtml(c.proveedor_nombre ?? "—")} · ${horas}${c.cupo_max ? ` · cupo ${c.cupo_max}` : ""}</p>
      </div>
      ${c.instructor_nombre ? `
      <div class="flex items-center gap-2">
        <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-leoni-blue text-[10px] font-bold text-white">${c.instructor_nombre.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}</span>
        <span class="truncate text-xs text-slate-600">${escapeHtml(c.instructor_nombre)}</span>
      </div>` : ""}
      <div class="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px]">
        <span class="text-slate-500">${CLASIFICACION_LABELS[c.clasificacion_nombre ?? ""] ?? "—"}</span>
        ${isRH ? `
        <div class="flex shrink-0 items-center gap-2">
          <button data-action="edit-curso" data-id="${c.id}" class="${RH_LISTADO_BTN_GHOST} !px-2 !py-1 text-xs">Editar</button>
          <button data-action="delete-curso" data-id="${c.id}" class="text-xs font-semibold text-red-600 transition hover:text-red-800">Eliminar</button>
        </div>` : ""}
      </div>
    </article>`;
  }

  function renderEmptyState(): string {
    const hasFilters = hasActiveFilters();
    return `
    <div class="${RH_LISTADO_SURFACE} cc-empty px-6 py-14 text-center">
      ${ICON_CLIPBOARD_EMPTY}
      <p class="mt-4 text-base font-semibold text-text-primary">${hasFilters ? "Sin resultados" : "Catálogo vacío"}</p>
      <p class="mt-2 text-sm text-text-secondary">${hasFilters ? "Prueba ajustando los filtros de búsqueda." : "Aún no hay cursos registrados en el catálogo."}</p>
      ${hasFilters ? `<button type="button" data-action="cursos-clear-filters" class="${RH_LISTADO_BTN_GHOST} mx-auto mt-5 text-xs">Limpiar filtros</button>` : isRH ? `<button type="button" data-action="open-create-curso" class="${RH_LISTADO_BTN_PRIMARY} cc-btn-nueva mx-auto mt-6">${ICON_PLUS}<span>Crear primer curso</span></button>` : ""}
    </div>`;
  }

  function renderPagination(): string {
    const pageSize = state.cursos.page_size || 20;
    const totalPages = Math.max(1, Math.ceil(state.cursos.total / pageSize));
    if (totalPages <= 1 && state.cursos.total <= pageSize) return "";

    const from = (state.page - 1) * pageSize + 1;
    const to = Math.min(state.page * pageSize, state.cursos.total);

    const pageButtons = paginationRange(totalPages, state.page)
      .map((x) => {
        if (x === "ellipsis") {
          return `<span class="flex min-h-8 items-center px-1.5 text-xs text-slate-500" aria-hidden="true">…</span>`;
        }
        const active = x === state.page;
        const cls = active
          ? "cc-page-btn cc-page-btn--active min-h-8 min-w-8 rounded-lg px-2 text-xs font-bold sm:px-2.5 sm:text-sm"
          : "cc-page-btn min-h-8 min-w-8 rounded-lg px-2 text-xs font-semibold text-slate-600 sm:px-2.5 sm:text-sm";
        return `<button type="button" data-action="cursos-goto-page" data-page="${x}" class="${cls}" aria-current="${active ? "page" : "false"}">${x}</button>`;
      })
      .join("");

    return `
    <footer class="cc-table-footer flex shrink-0 flex-col gap-2 border-t border-slate-100 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
      <p class="text-xs font-medium text-slate-600 sm:text-sm">
        Mostrando <span class="tabular-nums text-slate-900">${from}</span>–<span class="tabular-nums text-slate-900">${to}</span> de <span class="tabular-nums text-slate-900">${state.cursos.total}</span>
      </p>
      <nav class="flex flex-wrap items-center justify-center gap-0.5 sm:justify-end" aria-label="Paginación del catálogo">
        <button type="button" data-action="cursos-prev" ${state.page <= 1 ? "disabled" : ""}
          class="cc-page-nav inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm disabled:cursor-not-allowed disabled:opacity-40">
          <span class="sr-only">Página anterior</span>
          <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z" clip-rule="evenodd" /></svg>
        </button>
        ${pageButtons}
        <button type="button" data-action="cursos-next" ${state.page >= totalPages ? "disabled" : ""}
          class="cc-page-nav inline-flex min-h-8 min-w-8 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600 shadow-sm disabled:cursor-not-allowed disabled:opacity-40">
          <span class="sr-only">Página siguiente</span>
          <svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clip-rule="evenodd" /></svg>
        </button>
      </nav>
    </footer>`;
  }

  function renderCreateEditModal(): string {
    const c = state.editingCurso;
    const d = state.cursoModalDraft;
    const isEdit = !!c;
    const title = isEdit ? "Editar curso" : "Nuevo curso";
    const subtitle = isEdit
      ? "Los cambios se reflejan en el catálogo y en las asignaciones existentes."
      : "Registra un curso reutilizable para sesiones y asignación a puestos.";
    const modalFieldCls = `block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}`;

    return `
    <div id="curso-modal-backdrop" data-action="close-curso-modal" class="cc-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]" role="presentation">
      <div data-modal-inner class="cc-modal-panel w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200/90 bg-white shadow-[0_24px_48px_rgba(15,23,42,0.18)]" role="dialog" aria-modal="true" aria-labelledby="curso-modal-title">
        <div class="border-b border-slate-100 px-6 py-5">
          <h2 id="curso-modal-title" class="text-lg font-semibold text-text-primary">${title}</h2>
          <p class="mt-1 text-sm text-text-muted">${subtitle}</p>
        </div>
        <form data-action="submit-curso" class="flex flex-col gap-4 px-6 py-5">
          <div>
            <label class="${RH_LISTADO_LABEL}">Nombre <span class="text-red-600" aria-hidden="true">*</span></label>
            <input type="text" name="nombre" required value="${escapeHtml(d?.nombre ?? c?.nombre ?? "")}" class="${modalFieldCls}" />
          </div>
          <div>
            <label class="${RH_LISTADO_LABEL}">Clasificación</label>
            ${renderCatalogSelect(
              "clasificacion_id",
              state.clasificacionesCatalog,
              c?.clasificacion_id,
              d?.clasificacion_id,
              CLASIFICACION_LABELS,
              modalFieldCls,
              c?.clasificacion_nombre ? catalogItemLabel(c.clasificacion_nombre, CLASIFICACION_LABELS) : null,
            )}
          </div>
          <div>
            <label class="${RH_LISTADO_LABEL}">Tipo</label>
            ${renderCatalogSelect(
              "tipo_id",
              state.tiposCatalog,
              c?.tipo_id,
              d?.tipo_id,
              TIPO_LABELS,
              modalFieldCls,
              c?.tipo_nombre ? catalogItemLabel(c.tipo_nombre, TIPO_LABELS) : null,
            )}
          </div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="${RH_LISTADO_LABEL}">Duración (horas)</label>
              <input type="number" name="duracion_horas" step="0.5" min="0.5" value="${d?.duracion_horas ?? c?.duracion_horas ?? ""}" class="${modalFieldCls}" />
            </div>
            <div>
              <label class="${RH_LISTADO_LABEL}">Categoría</label>
              ${renderCatalogSelect(
                "categoria_id",
                state.categoriasCatalog,
                c?.categoria_id,
                d?.categoria_id,
                CATEGORIA_LABELS,
                modalFieldCls,
                c?.categoria_nombre ? catalogItemLabel(c.categoria_nombre, CATEGORIA_LABELS) : null,
              )}
            </div>
          </div>
          <div>
            <label class="${RH_LISTADO_LABEL}">Proveedor</label>
            ${renderProveedorSectionForCurso(c, d, modalFieldCls)}
          </div>
          <div>
            <label class="${RH_LISTADO_LABEL}">Centro de costos</label>
            <input type="number" name="centro_costos" value="${d?.centro_costos ?? c?.centro_costos ?? ""}" class="${modalFieldCls}" />
          </div>
          <div>
            <label class="${RH_LISTADO_LABEL}">Descripción</label>
            <textarea name="descripcion" rows="3" class="${modalFieldCls}">${escapeHtml(d?.descripcion ?? c?.descripcion ?? "")}</textarea>
          </div>
          ${isEdit ? `
          <div>
            <label class="${RH_LISTADO_LABEL}">Requisitos</label>
            <textarea name="requisitos" rows="3" class="${modalFieldCls}">${escapeHtml(d?.requisitos ?? c?.requisitos ?? "")}</textarea>
          </div>` : ""}
          <div class="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-3">
            <input type="checkbox" name="obligatorio" id="curso-obligatorio" ${(d?.obligatorio ?? c?.obligatorio) ? "checked" : ""} class="mt-0.5 size-4 rounded border-slate-300 text-leoni-blue focus:ring-leoni-blue" />
            <div>
              <label for="curso-obligatorio" class="text-sm font-medium text-text-primary">Obligatorio</label>
              <p class="mt-0.5 text-xs text-text-muted">Marca el curso como requisito obligatorio para los puestos asignados.</p>
            </div>
          </div>
          <div class="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" data-action="close-curso-modal" class="${BTN_SECONDARY} w-full sm:w-auto">Cancelar</button>
            <button type="submit" class="${RH_LISTADO_BTN_PRIMARY} w-full sm:w-auto">${isEdit ? "Guardar cambios" : "Crear curso"}</button>
          </div>
        </form>
      </div>
    </div>`;
  }

  function renderDetailPuestos(): string {
    const puestos = state.detailPuestos;
    if (puestos.length === 0) {
      return `
      <div class="${RH_LISTADO_SURFACE} p-6">
        <h3 class="text-sm font-semibold text-text-primary mb-2">Puestos asignados</h3>
        <p class="text-xs text-slate-400 italic">Sin puestos asignados a este curso.</p>
      </div>`;
    }
    const totalEmps = puestos.reduce((s, p) => s + p.empleados_count, 0);
    const hasSesiones = state.detailSesiones.length > 0;

    const puestoBlocks = puestos.map(p => {
      const puestoEmpIds = p.empleados.map(e => e.empleado_id);
      const allSelected = puestoEmpIds.length > 0 && puestoEmpIds.every(id => state.selectedEmpleados.has(id));
      const isExpanded = state.expandedPuestos.has(p.id);

      const empRows = p.empleados.length > 0
        ? p.empleados.map(e => {
          const checked = state.selectedEmpleados.has(e.empleado_id);
          return `
          <li class="flex items-center gap-2 py-1.5 border-b border-slate-50 last:border-0">
            ${hasSesiones && isRH ? `<input type="checkbox" data-action="toggle-emp" data-emp-id="${e.empleado_id}" ${checked ? "checked" : ""} class="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />` : ""}
            <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">${escapeHtml((e.nombre ?? "?").slice(0, 2).toUpperCase())}</span>
            <span class="text-sm text-text-primary truncate">${escapeHtml(e.nombre ?? `#${e.empleado_id}`)}</span>
            ${e.no_empleado ? `<span class="text-xs text-slate-400 tabular-nums">No. ${escapeHtml(e.no_empleado)}</span>` : ""}
          </li>`;
        }).join("")
        : `<li class="text-xs text-slate-400 italic py-1">Sin empleados activos</li>`;

      return `
      <div class="border-b border-slate-100 last:border-0">
        <div class="flex items-center justify-between px-5 py-3 bg-slate-50/50 cursor-pointer" data-action="toggle-puesto-expand" data-puesto-id="${p.id}">
          <div class="flex items-center gap-2">
            ${hasSesiones && isRH && puestoEmpIds.length > 0 ? `<input type="checkbox" data-action="toggle-puesto" data-puesto-emps='${JSON.stringify(puestoEmpIds)}' ${allSelected ? "checked" : ""} class="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />` : ""}
            <svg class="size-4 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
            <a href="#/puestos/${p.puesto_perfil_id}" class="text-sm font-semibold text-leoni-blue hover:underline">${escapeHtml(p.puesto_nombre ?? `Puesto #${p.puesto_perfil_id}`)}</a>
            ${p.puesto_codigo ? `<span class="text-xs text-slate-400">${escapeHtml(p.puesto_codigo)}</span>` : ""}
            ${p.obligatorio ? `<span class="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200/70">Obligatorio</span>` : ""}
          </div>
          <span class="text-xs text-slate-500 tabular-nums">${p.empleados_count} empleado${p.empleados_count !== 1 ? "s" : ""}</span>
        </div>
        ${isExpanded ? `<ul class="px-5 py-2">${empRows}</ul>` : ""}
      </div>`;
    }).join("");

    return `
    <div class="${RH_LISTADO_SURFACE} overflow-hidden">
      <div class="border-b border-slate-100 px-6 py-4">
        <h3 class="text-sm font-semibold text-text-primary">Puestos asignados</h3>
        <p class="text-xs text-slate-500 mt-0.5">${puestos.length} puesto${puestos.length !== 1 ? "s" : ""} · ${totalEmps} empleado${totalEmps !== 1 ? "s" : ""} en total</p>
      </div>
      ${puestoBlocks}
    </div>`;
  }

  function renderDetailEmpleadosExtra(): string {
    const emps = state.detailEmpleadosExtra;
    if (emps.length === 0) {
      return `
      <div class="${RH_LISTADO_SURFACE} p-6">
        <h3 class="text-sm font-semibold text-text-primary mb-2">Empleados extra (individuales)</h3>
        <p class="text-xs text-slate-400 italic">Sin empleados extra asignados individualmente.</p>
      </div>`;
    }
    const hasSesiones = state.detailSesiones.length > 0;
    const allExtraIds = emps.map(e => e.empleado_id);
    const allSelected = allExtraIds.every(id => state.selectedEmpleados.has(id));

    const rows = emps.map(e => {
      const checked = state.selectedEmpleados.has(e.empleado_id);
      return `
      <tr class="border-b border-slate-100 hover:bg-slate-50/60">
        ${hasSesiones && isRH ? `<td class="px-4 py-2.5"><input type="checkbox" data-action="toggle-emp" data-emp-id="${e.empleado_id}" ${checked ? "checked" : ""} class="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" /></td>` : ""}
        <td class="px-4 py-2.5 text-sm font-medium text-text-primary">${escapeHtml(e.nombre_empleado ?? `Empleado #${e.empleado_id}`)}</td>
        <td class="px-4 py-2.5 text-sm text-slate-500 tabular-nums">${escapeHtml(e.no_empleado ?? "—")}</td>
      </tr>`;
    }).join("");

    return `
    <div class="${RH_LISTADO_SURFACE} overflow-hidden">
      <div class="border-b border-slate-100 px-6 py-4 flex items-center justify-between cursor-pointer" data-action="toggle-extras-expand">
        <div class="flex items-center gap-2">
          <svg class="size-4 text-slate-400 transition-transform ${state.expandedExtras ? "rotate-90" : ""}" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
          <h3 class="text-sm font-semibold text-text-primary">Empleados extra (individuales)</h3>
        </div>
        <span class="text-xs text-slate-500">${emps.length} empleado${emps.length !== 1 ? "s" : ""}</span>
      </div>
      ${state.expandedExtras ? `
      <table class="w-full text-left">
        <thead class="bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            ${hasSesiones && isRH ? `<th class="px-4 py-2.5 w-10"><input type="checkbox" data-action="toggle-all-extras" data-extra-emps='${JSON.stringify(allExtraIds)}' ${allSelected ? "checked" : ""} class="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" /></th>` : ""}
            <th class="px-4 py-2.5">Empleado</th>
            <th class="px-4 py-2.5">No. Empleado</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>` : ""}
    </div>`;
  }

  function renderDetailView(): string {
    const c = state.detailCurso!;
    const horas = c.duracion_horas ? `${c.duracion_horas}h` : "—";

    function field(label: string, value: string | null | undefined): string {
      return `
      <div>
        <dt class="text-xs font-medium text-slate-500 uppercase tracking-wide">${escapeHtml(label)}</dt>
        <dd class="mt-1 text-sm text-text-primary">${escapeHtml(value || "—")}</dd>
      </div>`;
    }

    return `
    <div class="${RH_LISTADO_PAGE_OUTER} cc-page cc-detail">
      ${renderLevelUpBackBar()}
      <div class="flex flex-col gap-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <button data-action="back-to-list" class="${BTN_SECONDARY} w-full shrink-0 gap-1.5 sm:w-auto">
          <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"/></svg>
          Volver al catálogo
        </button>
        <h2 class="min-w-0 text-xl font-bold tracking-tight text-text-primary sm:text-2xl truncate">${escapeHtml(c.nombre)}</h2>
      </div>

      <div class="${RH_LISTADO_SURFACE} overflow-hidden">
        <div class="flex flex-wrap items-center gap-3 border-b border-slate-100 px-6 py-4">
          ${cursoCatBadge(c.categoria_nombre)}
          ${c.obligatorio ? `<span class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">Obligatorio</span>` : ""}
          <span class="ml-auto text-xs text-slate-500">ID: ${c.id}</span>
        </div>

        <div class="p-6">
          <dl class="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
            ${field("Nombre", c.nombre)}
            ${field("Categoría", CATEGORIA_LABELS[c.categoria_nombre ?? ""] ?? c.categoria_nombre)}
            ${field("Clasificación", CLASIFICACION_LABELS[c.clasificacion_nombre ?? ""] ?? c.clasificacion_nombre)}
            ${field("Proveedor", c.proveedor_nombre)}
            ${field("Duración", horas)}
            ${field("Cupo máximo", c.cupo_max ? String(c.cupo_max) : null)}
            ${field("Modalidad", c.modalidad)}
            ${field("Sesiones / año", c.sesiones_anio ? String(c.sesiones_anio) : null)}
            ${field("Centro de costos", c.centro_costos ? String(c.centro_costos) : null)}
            ${field("Obligatorio", c.obligatorio ? "Sí" : "No")}
            ${field("Activo", c.activo ? "Sí" : "No")}
          </dl>
        </div>

        ${c.descripcion || c.requisitos ? `
        <div class="border-t border-slate-100 p-6 space-y-5">
          ${c.descripcion ? `
          <div>
            <h3 class="text-sm font-semibold text-text-primary mb-1">Descripción</h3>
            <p class="text-sm text-slate-600 whitespace-pre-line">${escapeHtml(c.descripcion)}</p>
          </div>` : ""}
          ${c.requisitos ? `
          <div>
            <h3 class="text-sm font-semibold text-text-primary mb-1">Requisitos</h3>
            <p class="text-sm text-slate-600 whitespace-pre-line">${escapeHtml(c.requisitos)}</p>
          </div>` : ""}
        </div>` : ""}

        <div class="border-t border-slate-100 px-6 py-4 flex items-center justify-between">
          <span class="text-xs text-slate-400">Creado: ${new Date(c.created_at).toLocaleDateString("es-MX")} · Actualizado: ${new Date(c.updated_at).toLocaleDateString("es-MX")}</span>
          ${isRH ? `
          <div class="flex items-center gap-3">
            <button data-action="edit-curso" data-id="${c.id}" class="${BTN_SECONDARY} text-xs">Editar</button>
            <button data-action="delete-curso" data-id="${c.id}" class="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition">Eliminar</button>
          </div>` : ""}
        </div>
      </div>

      ${renderDetailSesiones()}
      ${renderDetailGrupos()}
      ${renderDetailPuestos()}
      ${renderDetailEmpleadosExtra()}
      ${renderSelectionBar()}
      ${state.showAssignSesionPicker ? renderAssignSesionPicker() : ""}
      ${state.showAsignacionMasivaModal ? renderAsignacionMasivaModal() : ""}
      </div>
    </div>`;
  }

  function renderDetailGrupos(): string {
    const grupos = state.detailGrupos;
    const hasSesiones = state.detailSesiones.length > 0;
    const tipoLabel = (t: string) => t === "area" ? "Área" : t === "subarea" ? "Subárea" : "Puesto";
    const tipoCls = (t: string) => t === "area"
      ? "border-blue-200 bg-blue-50 text-blue-800"
      : t === "subarea"
      ? "border-violet-200 bg-violet-50 text-violet-800"
      : "border-amber-200 bg-amber-50 text-amber-800";

    const totalEmps = grupos.reduce((s, g) => s + g.empleados_count, 0);

    const grupoBlocks = grupos.map(g => {
      const grupoEmpIds = g.empleados.map(e => e.empleado_id);
      const allSelected = grupoEmpIds.length > 0 && grupoEmpIds.every(id => state.selectedEmpleados.has(id));
      const isExpanded = state.expandedGrupos.has(g.id);

      const empRows = g.empleados.length > 0
        ? g.empleados.map(e => {
          const checked = state.selectedEmpleados.has(e.empleado_id);
          return `
          <li class="flex items-center gap-2 py-1.5 border-b border-slate-50 last:border-0">
            ${hasSesiones && isRH ? `<input type="checkbox" data-action="toggle-emp" data-emp-id="${e.empleado_id}" ${checked ? "checked" : ""} class="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />` : ""}
            <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">${escapeHtml((e.nombre ?? "?").slice(0, 2).toUpperCase())}</span>
            <span class="text-sm text-text-primary truncate">${escapeHtml(e.nombre ?? `#${e.empleado_id}`)}</span>
            ${e.no_empleado ? `<span class="text-xs text-slate-400 tabular-nums">No. ${escapeHtml(e.no_empleado)}</span>` : ""}
          </li>`;
        }).join("")
        : `<li class="text-xs text-slate-400 italic py-1">Sin empleados en este grupo</li>`;

      return `
      <div class="border-b border-slate-100 last:border-0">
        <div class="flex items-center justify-between px-5 py-3 bg-slate-50/50 cursor-pointer" data-action="toggle-grupo-expand" data-grupo-id="${g.id}">
          <div class="flex items-center gap-2">
            ${hasSesiones && isRH && grupoEmpIds.length > 0 ? `<input type="checkbox" data-action="toggle-puesto" data-puesto-emps='${JSON.stringify(grupoEmpIds)}' ${allSelected ? "checked" : ""} class="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />` : ""}
            <svg class="size-4 text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
            <span class="inline-flex items-center rounded-full border ${tipoCls(g.tipo)} px-2 py-0.5 text-[10px] font-semibold">${tipoLabel(g.tipo)}</span>
            <span class="text-sm font-semibold text-text-primary">${escapeHtml(g.nombre)}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-xs text-slate-500 tabular-nums">${g.empleados_count} empleado${g.empleados_count !== 1 ? "s" : ""}</span>
            ${isRH ? `<button data-action="quitar-grupo" data-grupo-id="${g.id}" class="text-xs text-red-600 hover:underline">Quitar</button>` : ""}
          </div>
        </div>
        ${isExpanded ? `<ul class="px-5 py-2">${empRows}</ul>` : ""}
      </div>`;
    }).join("");

    return `
    <div class="${RH_LISTADO_SURFACE} overflow-hidden">
      <div class="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-text-primary">Grupos asignados</h3>
          <p class="text-xs text-slate-500 mt-0.5">${grupos.length === 0 ? "Sin grupos asignados" : `${grupos.length} grupo${grupos.length !== 1 ? "s" : ""} · ${totalEmps} empleado${totalEmps !== 1 ? "s" : ""} en total`}</p>
        </div>
        ${isRH ? `<button data-action="open-asignacion-masiva" class="${BTN_SECONDARY} text-xs">+ Asignar grupo</button>` : ""}
      </div>
      ${grupoBlocks}
    </div>`;
  }

  function renderAsignacionMasivaModal(): string {
    const selectCls = `w-full rounded-lg border border-border bg-white px-3 py-2 text-sm ${FIELD_FOCUS}`;
    const cat = state.asignacionCatalogos;

    return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-backdrop="asignacion-masiva">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-text-primary">Asignar grupo al curso</h3>
          <button data-action="close-asignacion-masiva" class="rounded-lg p-1 text-text-muted hover:bg-surface hover:text-text-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        ${state.asignacionCatalogosLoading ? `<p class="text-xs text-slate-400 text-center py-6">Cargando catálogos...</p>` :
          !cat ? `<p class="text-xs text-red-500 text-center py-6">Error al cargar catálogos.</p>` : `
        <div class="space-y-3">
          <p class="text-xs text-slate-500">Selecciona un área, subárea o puesto. Todos los empleados de ese grupo quedarán asignados al curso dinámicamente.</p>
          <div>
            <label class="text-xs font-medium text-slate-600 mb-1 block">Área</label>
            <select data-action="asignacion-area" class="${selectCls}">
              <option value="">— Seleccionar —</option>
              ${cat.areas.map(a => `<option value="${a.id}" ${state.asignacionAreaId === a.id ? "selected" : ""}>${escapeHtml(a.descripcion)}</option>`).join("")}
            </select>
            ${state.asignacionAreaId ? `<button data-action="agregar-grupo" data-tipo="area" data-ref-id="${state.asignacionAreaId}" class="mt-1 text-xs text-blue-600 hover:underline">+ Agregar esta área como grupo</button>` : ""}
          </div>
          <div>
            <label class="text-xs font-medium text-slate-600 mb-1 block">Subárea</label>
            <select data-action="asignacion-subarea" class="${selectCls}">
              <option value="">— Seleccionar —</option>
              ${cat.subareas.map(s => `<option value="${s.id}" ${state.asignacionSubareaId === s.id ? "selected" : ""}>${escapeHtml(s.descripcion)}</option>`).join("")}
            </select>
            ${state.asignacionSubareaId ? `<button data-action="agregar-grupo" data-tipo="subarea" data-ref-id="${state.asignacionSubareaId}" class="mt-1 text-xs text-blue-600 hover:underline">+ Agregar esta subárea como grupo</button>` : ""}
          </div>
          <div>
            <label class="text-xs font-medium text-slate-600 mb-1 block">Puesto</label>
            <select data-action="asignacion-puesto" class="${selectCls}">
              <option value="">— Seleccionar —</option>
              ${cat.puestos.map(p => `<option value="${p.id}" ${state.asignacionPuestoId === p.id ? "selected" : ""}>${escapeHtml(p.descripcion)}</option>`).join("")}
            </select>
            ${state.asignacionPuestoId ? `<button data-action="agregar-grupo" data-tipo="puesto" data-ref-id="${state.asignacionPuestoId}" class="mt-1 text-xs text-blue-600 hover:underline">+ Agregar este puesto como grupo</button>` : ""}
          </div>
          ${state.asignacionResult ? `
            <div class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Grupo asignado correctamente.
            </div>` : ""}
        </div>`}
      </div>
    </div>`;
  }

  function renderSelectionBar(): string {
    const count = state.selectedEmpleados.size;
    if (count === 0 || state.detailSesiones.length === 0 || !isRH) return "";
    return `
    <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 shadow-lg">
      <span class="text-sm font-medium text-blue-900">${count} empleado${count !== 1 ? "s" : ""} seleccionado${count !== 1 ? "s" : ""}</span>
      <button data-action="open-assign-sesion-picker" class="${BTN_PRIMARY} text-sm">Asignar a sesión</button>
      <button data-action="clear-selection" class="text-xs text-slate-600 hover:text-slate-900">Cancelar</button>
    </div>`;
  }

  function renderAssignSesionPicker(): string {
    const sesiones = state.detailSesiones.filter(s => s.estado === "programada" || s.estado === "en_curso");
    return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-backdrop="assign-sesion">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <h3 class="text-lg font-semibold text-text-primary mb-1">Asignar a sesión</h3>
        <p class="text-xs text-slate-500 mb-4">${state.selectedEmpleados.size} empleado${state.selectedEmpleados.size !== 1 ? "s" : ""} seleccionado${state.selectedEmpleados.size !== 1 ? "s" : ""}</p>
        ${sesiones.length === 0 ? `<p class="text-sm text-slate-400 italic">No hay sesiones activas disponibles.</p>` : `
        <div class="space-y-2 max-h-60 overflow-y-auto">
          ${sesiones.map(s => {
            const fecha = new Date(s.fecha_inicio + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" });
            const hora = s.hora_inicio ? ` ${s.hora_inicio.slice(0, 5)}` : "";
            const cupo = s.inscritos_count ? ` (${s.inscritos_count})` : "";
            return `
            <button data-action="assign-to-sesion" data-sesion-id="${s.id}" class="w-full flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-4 py-3 text-left hover:border-blue-300 hover:bg-blue-50/50 transition">
              <div>
                <span class="text-sm font-medium text-text-primary">${escapeHtml(fecha)}${escapeHtml(hora)}</span>
                ${s.ubicacion ? `<span class="text-xs text-slate-500 ml-2">${escapeHtml(s.ubicacion)}</span>` : ""}
              </div>
              <span class="text-xs text-slate-400 tabular-nums">${escapeHtml(cupo)}</span>
            </button>`;
          }).join("")}
        </div>`}
        <div class="flex justify-end mt-4">
          <button data-action="close-assign-sesion-picker" class="${BTN_SECONDARY} text-xs">Cancelar</button>
        </div>
      </div>
    </div>`;
  }

  function renderDetailSesiones(): string {
    const sesiones = state.detailSesiones;
    const cursoId = state.detailCurso?.id;

    if (sesiones.length === 0 && !isRH) {
      return `
      <div class="${RH_LISTADO_SURFACE} p-6">
        <h3 class="text-sm font-semibold text-text-primary mb-2">Sesiones programadas</h3>
        <p class="text-xs text-slate-400 italic">Sin sesiones programadas para este curso.</p>
      </div>`;
    }

    const estadoCls = (e: string) =>
      e === "completada" ? "border-emerald-200 bg-emerald-50 text-emerald-800" :
      e === "cancelada" ? "border-red-200 bg-red-50 text-red-800" :
      e === "en_curso" ? "border-blue-200 bg-blue-50 text-blue-800" :
      "border-slate-200 bg-slate-50 text-slate-700";

    const rows = sesiones.map(s => {
      const fecha = new Date(s.fecha_inicio + "T00:00:00").toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
      const horario = s.hora_inicio ? `${s.hora_inicio.slice(0, 5)}${s.hora_fin ? " – " + s.hora_fin.slice(0, 5) : ""}` : "—";
      const cupo = `${s.inscritos_count}`;
      return `
      <tr class="border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer transition-colors" data-action="go-sesion-detail" data-curso-id="${cursoId}" data-sesion-id="${s.id}">
        <td class="px-4 py-2.5 text-sm font-medium text-text-primary">${escapeHtml(fecha)}</td>
        <td class="px-4 py-2.5 text-sm text-slate-600">${escapeHtml(horario)}</td>
        <td class="px-4 py-2.5 text-sm text-slate-600">${s.tipo ? escapeHtml(s.tipo.charAt(0).toUpperCase() + s.tipo.slice(1)) : "—"}</td>
        <td class="px-4 py-2.5 text-sm text-slate-600">${escapeHtml(s.ubicacion ?? "—")}</td>
        <td class="px-4 py-2.5 text-sm text-slate-600">${escapeHtml(s.instructor_nombre ?? "—")}</td>
        <td class="px-4 py-2.5">
          <span class="text-sm tabular-nums text-blue-600 font-medium">${cupo}</span>
        </td>
        <td class="px-4 py-2.5">
          <span class="inline-flex items-center rounded-full border ${estadoCls(s.estado)} px-2 py-0.5 text-[10px] font-semibold">${escapeHtml(ESTADO_SESION_LABELS[s.estado] ?? s.estado)}</span>
        </td>
        ${isRH ? `<td class="px-4 py-2.5"><button data-action="delete-sesion" data-curso-id="${cursoId}" data-sesion-id="${s.id}" class="text-xs text-red-600 hover:underline">Eliminar</button></td>` : ""}
      </tr>`;
    }).join("");

    return `
    <div class="${RH_LISTADO_SURFACE} overflow-hidden">
      <div class="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-text-primary">Sesiones programadas</h3>
          <p class="text-xs text-slate-500 mt-0.5">${sesiones.length} sesión${sesiones.length !== 1 ? "es" : ""}</p>
        </div>
        ${isRH ? `<button data-action="open-create-sesion" class="${BTN_PRIMARY} text-xs">+ Crear sesión</button>` : ""}
      </div>
      ${sesiones.length === 0 ? `<p class="px-6 py-4 text-xs text-slate-400 italic">Sin sesiones programadas. Crea una para comenzar.</p>` : `
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead class="bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-4 py-2.5">Fecha</th>
              <th class="px-4 py-2.5">Horario</th>
              <th class="px-4 py-2.5">Tipo</th>
              <th class="px-4 py-2.5">Ubicación</th>
              <th class="px-4 py-2.5">Instructor</th>
              <th class="px-4 py-2.5">Inscritos</th>
              <th class="px-4 py-2.5">Estado</th>
              ${isRH ? `<th class="px-4 py-2.5"></th>` : ""}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`}
    </div>
    ${state.showCreateSesionModal ? renderCreateSesionModal() : ""}
    ${state.viewingSesion ? renderSesionEmpleadosModal() : ""}`;
  }

  function renderSesionEmpleadosModal(): string {
    const sesion = state.viewingSesion!;
    const fecha = new Date(sesion.fecha_inicio + "T00:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
    const horario = sesion.hora_inicio ? ` — ${sesion.hora_inicio.slice(0, 5)}${sesion.hora_fin ? " a " + sesion.hora_fin.slice(0, 5) : ""}` : "";

    const empleadoRows = state.sesionEmpleados.length === 0
      ? `<p class="text-sm text-slate-400 italic py-3">Sin empleados inscritos en esta sesión.</p>`
      : `<div class="divide-y divide-slate-100 max-h-56 overflow-y-auto border border-slate-200 rounded-lg">
          ${state.sesionEmpleados.map(emp => `
            <div class="flex items-center justify-between gap-2 px-3 py-2">
              <div class="min-w-0">
                <span class="text-sm text-text-primary truncate block">${escapeHtml(emp.nombre_empleado ?? "—")}</span>
                <span class="text-xs text-slate-500">${escapeHtml(emp.no_empleado ?? "")}</span>
              </div>
              ${isRH ? `<button data-action="quitar-sesion-empleado" data-inscripcion-id="${emp.id}" class="text-xs text-red-600 hover:underline shrink-0">Quitar</button>` : ""}
            </div>`).join("")}
        </div>`;

    return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-backdrop="sesion-empleados">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div class="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 class="text-lg font-semibold text-text-primary">Empleados inscritos</h3>
            <p class="text-xs text-slate-500 mt-0.5">${escapeHtml(fecha)}${escapeHtml(horario)}${sesion.ubicacion ? " — " + escapeHtml(sesion.ubicacion) : ""}</p>
          </div>
          <button data-action="close-sesion-empleados-modal" class="rounded-lg p-1 text-text-muted hover:bg-surface hover:text-text-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5"><path d="M6 18 18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        ${empleadoRows}
        ${isRH ? `
        <div class="border-t border-slate-200 pt-4 mt-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Agregar empleado</p>
          <div class="flex gap-2">
            <input id="sesion-emp-search" type="text" autocomplete="off" placeholder="Buscar por nombre o número..."
              class="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm ${FIELD_FOCUS}" />
          </div>
          <div id="sesion-emp-results" class="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-1 hidden"></div>
        </div>` : ""}
      </div>
    </div>`;
  }

  function renderCreateSesionModal(): string {
    return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-backdrop="create-sesion">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 class="text-lg font-semibold text-text-primary mb-4">Crear sesión</h3>
        <form data-form="create-sesion" class="flex flex-col gap-3">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Fecha inicio *</label>
            <input type="date" name="fecha_inicio" required class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm ${FIELD_FOCUS}" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Fecha fin</label>
            <input type="date" name="fecha_fin" class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm ${FIELD_FOCUS}" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Hora inicio</label>
              <input type="time" name="hora_inicio" class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm ${FIELD_FOCUS}" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Hora fin</label>
              <input type="time" name="hora_fin" class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm ${FIELD_FOCUS}" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
              <select name="tipo" class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm ${FIELD_FOCUS}">
                <option value="">—</option>
                <option value="interno">Interno</option>
                <option value="externo">Externo</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Ubicación</label>
              <input type="text" name="ubicacion" class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm ${FIELD_FOCUS}" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Instructor</label>
            <input type="text" name="instructor" class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm ${FIELD_FOCUS}" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Costo</label>
            <input type="number" name="costo" min="0" step="0.01" class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm ${FIELD_FOCUS}" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Notas</label>
            <textarea name="notas" rows="2" class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm ${FIELD_FOCUS}"></textarea>
          </div>
          <div class="flex items-center justify-end gap-3 mt-2">
            <button type="button" data-action="close-sesion-modal" class="${BTN_SECONDARY}">Cancelar</button>
            <button type="submit" class="${BTN_PRIMARY}">Crear</button>
          </div>
        </form>
      </div>
    </div>`;
  }

  function renderViewToggle(): string {
    const btnCls = (active: boolean) => active
      ? "cc-view-btn cc-view-btn--active rounded-[10px] bg-[#1e40af] px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
      : "cc-view-btn rounded-[10px] px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-white hover:text-[#1e40af]";
    return `
    <div class="inline-flex items-center gap-0.5 rounded-[12px] border border-slate-200 bg-slate-50/90 p-1" role="group" aria-label="Modo de vista">
      <button type="button" data-action="view-tarjetas" aria-pressed="${state.viewMode === "tarjetas"}" class="${btnCls(state.viewMode === "tarjetas")}">Tarjetas</button>
      <button type="button" data-action="view-tabla" aria-pressed="${state.viewMode === "tabla"}" class="${btnCls(state.viewMode === "tabla")}">Tabla</button>
    </div>`;
  }

  function renderCursosTable(): string {
    const items = state.cursos.items;
    if (items.length === 0) return "";

    return `
    <div class="overflow-x-auto">
      <table class="cc-catalogo-table min-w-[960px] w-full text-left text-sm">
        <thead class="border-b border-slate-200 bg-[#f8fafc] text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-4 py-3.5">Nombre</th>
            <th class="px-4 py-3.5">Categoría</th>
            <th class="px-4 py-3.5">Tipo</th>
            <th class="px-4 py-3.5">Clasificación</th>
            <th class="px-4 py-3.5">Instructor</th>
            <th class="px-4 py-3.5">Horas</th>
            <th class="px-4 py-3.5">Modalidad</th>
            <th class="px-4 py-3.5">Obligatorio</th>
            ${isRH ? `<th class="px-4 py-3.5 text-right">Acciones</th>` : ""}
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${items.map(c => `
          <tr class="cc-catalogo-row transition hover:bg-slate-50/70">
            <td class="px-4 py-3.5 align-middle">
              <button data-action="view-curso" data-id="${c.id}" class="max-w-[280px] truncate text-left text-sm font-semibold text-text-primary transition hover:text-leoni-blue hover:underline" title="${escapeHtml(c.nombre)}">${escapeHtml(c.nombre)}</button>
            </td>
            <td class="px-4 py-3.5 align-middle">${c.categoria_nombre ? cursoCatBadge(c.categoria_nombre) : `<span class="text-slate-400">—</span>`}</td>
            <td class="px-4 py-3.5 align-middle text-slate-600">${c.tipo_nombre ? escapeHtml(TIPO_LABELS[c.tipo_nombre] ?? c.tipo_nombre) : "—"}</td>
            <td class="px-4 py-3.5 align-middle text-slate-600">${c.clasificacion_nombre ? escapeHtml(CLASIFICACION_LABELS[c.clasificacion_nombre] ?? c.clasificacion_nombre) : "—"}</td>
            <td class="px-4 py-3.5 align-middle max-w-[180px] truncate text-slate-600" title="${escapeHtml(c.instructor_nombre ?? "")}">${c.instructor_nombre ? escapeHtml(c.instructor_nombre) : "—"}</td>
            <td class="px-4 py-3.5 align-middle tabular-nums text-slate-600">${c.duracion_horas ?? "—"}</td>
            <td class="px-4 py-3.5 align-middle text-slate-600">${c.modalidad ? escapeHtml(c.modalidad) : "—"}</td>
            <td class="px-4 py-3.5 align-middle">${c.obligatorio
              ? `<span class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700">Sí</span>`
              : `<span class="text-slate-400">No</span>`}</td>
            ${isRH ? `<td class="px-4 py-3.5 align-middle text-right whitespace-nowrap">
              <button data-action="edit-curso" data-id="${c.id}" class="${RH_LISTADO_BTN_GHOST} !px-2 !py-1 text-xs">Editar</button>
              <button data-action="delete-curso" data-id="${c.id}" class="ml-1 text-xs font-semibold text-red-600 transition hover:text-red-800">Eliminar</button>
            </td>` : ""}
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
  }

  function renderListToolbar(): string {
    return `
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
      <div>
        <h2 class="text-sm font-semibold text-text-primary">Resultados</h2>
        <p class="text-xs text-text-muted">${state.cursos.total} curso${state.cursos.total !== 1 ? "s" : ""}</p>
      </div>
      ${renderViewToggle()}
    </div>`;
  }

  function renderListContent(): string {
    const items = state.cursos.items;

    if (state.loading && items.length === 0) {
      return `
      <section class="${RH_LISTADO_SURFACE} cc-table-wrap flex min-h-[240px] flex-col overflow-hidden p-0" aria-busy="true" aria-label="Cargando cursos">
        <div class="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-14">
          <div class="size-8 animate-spin rounded-full border-2 border-slate-200 border-t-leoni-blue" aria-hidden="true"></div>
          <p class="text-sm text-text-secondary">Cargando catálogo…</p>
        </div>
      </section>`;
    }

    if (items.length === 0) {
      return renderEmptyState();
    }

    if (state.viewMode === "tarjetas") {
      return `
      <section class="${RH_LISTADO_SURFACE} cc-cards-wrap flex flex-col overflow-hidden p-0" aria-label="Cursos en tarjetas">
        ${renderListToolbar()}
        <div class="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3 2xl:grid-cols-4">
          ${items.map(c => renderCursoCard(c)).join("")}
        </div>
        ${renderPagination()}
      </section>`;
    }

    return `
    <section class="${RH_LISTADO_SURFACE} cc-table-wrap flex flex-col overflow-hidden p-0" aria-label="Listado de cursos">
      ${renderListToolbar()}
      ${renderCursosTable()}
      ${renderPagination()}
    </section>`;
  }

  function renderPage(): string {
    if (state.loading && state.cursos.items.length === 0 && !hasActiveFilters()) {
      return renderCursosLoading();
    }

    const items = state.cursos.items;
    const showKpis = !state.loading || items.length > 0;

    return `
    <div class="${RH_LISTADO_PAGE_OUTER} cc-page">
      ${renderLevelUpBackBar()}
      ${renderCursosPageHeader()}
      ${showKpis ? renderCursosKpis() : `<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">${kpiSkeletonCard()}${kpiSkeletonCard()}${kpiSkeletonCard()}${kpiSkeletonCard()}</div>`}
      <div class="cc-content-stack flex flex-col gap-4 sm:gap-5">
        ${renderFilterSection()}
        ${renderListContent()}
      </div>
    </div>`;
  }

  function render(): void {
    captureCursoModalDraft();
    mountAppShell(container, {
      pageTitle: "Catálogo de cursos",
      activeNav: "cursos",
      mainClass: "py-5 sm:py-6",
      mainHtml: (state.detailCurso ? renderDetailView() : renderPage()) + (state.showCreateModal || state.editingCurso ? renderCreateEditModal() : ""),
    });
  }

  function navigateToDetail(curso: Curso): void {
    state.detailCurso = curso;
    state.detailPuestos = [];
    state.detailEmpleadosExtra = [];
    state.detailGrupos = [];
    state.detailSesiones = [];
    state.selectedEmpleados = new Set();
    history.replaceState(null, "", `#/cursos/${curso.id}`);
    render();
    Promise.all([getCursoPuestos(curso.id), getCursoEmpleadosExtra(curso.id), getCursoSesiones(curso.id), getCursoGrupos(curso.id)])
      .then(([puestos, empExtra, sesionesResp, grupos]) => {
        state.detailPuestos = puestos;
        state.detailEmpleadosExtra = empExtra;
        state.detailSesiones = sesionesResp.items;
        state.detailGrupos = grupos;
        render();
      })
      .catch(() => {});
  }

  let searchTimeout: ReturnType<typeof setTimeout> | null = null;
  let sesionEmpSearchTimeout: ReturnType<typeof setTimeout> | null = null;

  function bindSesionEmpleadoSearch(): void {
    const input = container.querySelector("#sesion-emp-search") as HTMLInputElement | null;
    if (!input) return;
    input.addEventListener("input", () => {
      if (sesionEmpSearchTimeout) clearTimeout(sesionEmpSearchTimeout);
      sesionEmpSearchTimeout = setTimeout(async () => {
        const q = input.value.trim();
        const resultsDiv = container.querySelector("#sesion-emp-results") as HTMLElement | null;
        if (!resultsDiv || !state.viewingSesion || !state.detailCurso) return;
        if (q.length < 2) { resultsDiv.classList.add("hidden"); resultsDiv.innerHTML = ""; return; }
        try {
          const elegibles: EmpleadoElegible[] = await getSesionEmpleadosElegibles(state.detailCurso.id, state.viewingSesion.id, q);
          if (elegibles.length === 0) {
            resultsDiv.innerHTML = `<p class="text-xs text-slate-500 px-2 py-2">Sin empleados elegibles</p>`;
          } else {
            resultsDiv.innerHTML = elegibles.map(e => `
              <button type="button" data-action="inscribir-sesion-empleado" data-empleado-id="${e.id}" class="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm rounded hover:bg-white transition">
                <span class="truncate flex-1">${escapeHtml(e.nombre ?? "—")}</span>
                <span class="text-xs text-slate-400">${escapeHtml(e.no_empleado ?? "")}</span>
              </button>`).join("");
          }
          resultsDiv.classList.remove("hidden");

          resultsDiv.querySelectorAll<HTMLButtonElement>("[data-action='inscribir-sesion-empleado']").forEach(btn => {
            btn.addEventListener("click", async () => {
              const empId = Number(btn.dataset.empleadoId);
              if (!empId || !state.viewingSesion || !state.detailCurso) return;
              btn.disabled = true;
              try {
                await inscribirEmpleadoSesion(state.detailCurso.id, state.viewingSesion.id, empId);
                state.sesionEmpleados = await getSesionEmpleados(state.detailCurso.id, state.viewingSesion.id);
                const resp = await getCursoSesiones(state.detailCurso.id);
                state.detailSesiones = resp.items;
                state.viewingSesion = state.detailSesiones.find(s => s.id === state.viewingSesion!.id) ?? state.viewingSesion;
                render();
                bindSesionEmpleadoSearch();
              } catch (err: any) {
                alert(err?.detail ?? "Error al inscribir empleado.");
                btn.disabled = false;
              }
            });
          });
        } catch {
          resultsDiv.innerHTML = `<p class="text-xs text-red-500 px-2 py-2">Error al buscar</p>`;
          resultsDiv.classList.remove("hidden");
        }
      }, 320);
    });
  }

  async function handleClick(e: Event): Promise<void> {
    const t = e.target as HTMLElement;

    if (t.closest("[data-action='back-to-list']")) {
      state.detailCurso = null;
      state.selectedEmpleados = new Set();
      state.showAssignSesionPicker = false;
      history.replaceState(null, "", "#/cursos");
      render();
      return;
    }

    const viewBtn = t.closest<HTMLElement>("[data-action='view-curso']");
    if (viewBtn) {
      const id = Number(viewBtn.dataset.id);
      const curso = state.cursos.items.find(c => c.id === id);
      if (curso) {
        navigateToDetail(curso);
      }
      return;
    }

    if (t.closest("[data-action='cursos-clear-filters']")) {
      state.filters = { tipo: "", clasificacion: "", obligatorio: "", categoria: "", busqueda: "" };
      state.page = 1;
      state.loading = true;
      render();
      await loadCursos();
      state.loading = false;
      render();
      return;
    }

    if (t.closest("[data-action='view-tarjetas']")) {
      state.viewMode = "tarjetas";
      render();
      return;
    }
    if (t.closest("[data-action='view-tabla']")) {
      state.viewMode = "tabla";
      render();
      return;
    }

    const selectInstructor = t.closest<HTMLElement>("[data-action='select-instructor']");
    if (selectInstructor) {
      const nombre = selectInstructor.dataset.nombre ?? "";
      const hidden = container.querySelector<HTMLInputElement>("input[name='instructor']");
      const search = container.querySelector<HTMLInputElement>("[data-action='instructor-search']");
      const dropdown = container.querySelector<HTMLElement>("[data-ref='instructor-dropdown']");
      if (hidden) hidden.value = nombre;
      if (search) search.value = nombre;
      if (dropdown) dropdown.classList.add("hidden");
      return;
    }

    if (t.closest("[data-action='open-create-curso']")) {
      await loadEmpleados();
      await openCursoModal(null);
      return;
    }

    if (t.closest("[data-action='toggle-nuevo-proveedor']")) {
      captureCursoModalDraft();
      state.showNuevoProveedorPanel = !state.showNuevoProveedorPanel;
      if (!state.showNuevoProveedorPanel) {
        state.nuevoProveedorNombre = "";
        state.nuevoProveedorError = "";
      }
      render();
      if (state.showNuevoProveedorPanel) {
        container.querySelector<HTMLInputElement>("#nuevo-proveedor-nombre")?.focus();
      }
      return;
    }

    if (t.closest("[data-action='cancel-nuevo-proveedor']")) {
      captureCursoModalDraft();
      state.showNuevoProveedorPanel = false;
      state.nuevoProveedorNombre = "";
      state.nuevoProveedorError = "";
      render();
      return;
    }

    if (t.closest("[data-action='save-nuevo-proveedor']")) {
      captureCursoModalDraft();
      const input = container.querySelector<HTMLInputElement>("[data-action='nuevo-proveedor-nombre']");
      state.nuevoProveedorNombre = input?.value ?? state.nuevoProveedorNombre;
      await saveNuevoProveedorFromCursoModal();
      return;
    }

    const closeBtn = t.closest<HTMLElement>("[data-action='close-curso-modal']");
    if (closeBtn) {
      if (!(closeBtn.id === "curso-modal-backdrop" && t.closest("[data-modal-inner]"))) {
        closeCursoModal();
        render();
      }
      return;
    }

    const editBtn = t.closest<HTMLElement>("[data-action='edit-curso']");
    if (editBtn) {
      const id = Number(editBtn.dataset.id);
      const curso = state.cursos.items.find(c => c.id === id)
        ?? (state.detailCurso?.id === id ? state.detailCurso : null);
      if (curso) {
        await loadEmpleados();
        await openCursoModal(curso);
      }
      return;
    }

    const deleteBtn = t.closest<HTMLElement>("[data-action='delete-curso']");
    if (deleteBtn) {
      const id = Number(deleteBtn.dataset.id);
      if (id && confirm("¿Eliminar este curso del catálogo?")) {
        try {
          await deleteCurso(id);
          state.detailCurso = null;
          await loadCursos();
          render();
        } catch (err: any) {
          alert(err?.detail ?? "No se pudo eliminar el curso.");
        }
      }
      return;
    }

    // ── Session handlers ──
    const goSesionRow = t.closest<HTMLElement>("[data-action='go-sesion-detail']");
    if (goSesionRow && !t.closest("[data-action='delete-sesion']")) {
      const cId = goSesionRow.dataset.cursoId;
      const sId = goSesionRow.dataset.sesionId;
      if (cId && sId) window.location.hash = `#/sesiones/${cId}/${sId}`;
      return;
    }

    if (t.closest("[data-action='open-create-sesion']")) {
      state.showCreateSesionModal = true;
      render();
      return;
    }

    if (t.closest("[data-action='close-sesion-modal']") || (t as HTMLElement).dataset.backdrop === "create-sesion") {
      state.showCreateSesionModal = false;
      render();
      return;
    }

    const viewSesionEmpBtn = t.closest<HTMLElement>("[data-action='view-sesion-empleados']");
    if (viewSesionEmpBtn) {
      const sesionId = Number(viewSesionEmpBtn.dataset.sesionId);
      const sesion = state.detailSesiones.find(s => s.id === sesionId);
      if (!sesion || !state.detailCurso) return;
      state.viewingSesion = sesion;
      try {
        state.sesionEmpleados = await getSesionEmpleados(state.detailCurso.id, sesionId);
      } catch { state.sesionEmpleados = []; }
      render();
      bindSesionEmpleadoSearch();
      return;
    }

    if (t.closest("[data-action='close-sesion-empleados-modal']") || (t as HTMLElement).dataset.backdrop === "sesion-empleados") {
      state.viewingSesion = null;
      state.sesionEmpleados = [];
      render();
      return;
    }

    const quitarEmpBtn = t.closest<HTMLElement>("[data-action='quitar-sesion-empleado']");
    if (quitarEmpBtn) {
      const inscId = Number(quitarEmpBtn.dataset.inscripcionId);
      if (!inscId || !state.viewingSesion || !state.detailCurso) return;
      try {
        await quitarEmpleadoSesion(state.detailCurso.id, state.viewingSesion.id, inscId);
        state.sesionEmpleados = await getSesionEmpleados(state.detailCurso.id, state.viewingSesion.id);
        const resp = await getCursoSesiones(state.detailCurso.id);
        state.detailSesiones = resp.items;
        state.viewingSesion = state.detailSesiones.find(s => s.id === state.viewingSesion!.id) ?? state.viewingSesion;
        render();
        bindSesionEmpleadoSearch();
      } catch (err: any) {
        alert(err?.detail ?? "Error al quitar empleado.");
      }
      return;
    }

    const deleteSesionBtn = t.closest<HTMLElement>("[data-action='delete-sesion']");
    if (deleteSesionBtn) {
      const cursoId = Number(deleteSesionBtn.dataset.cursoId);
      const sesionId = Number(deleteSesionBtn.dataset.sesionId);
      if (cursoId && sesionId && confirm("¿Eliminar esta sesión?")) {
        try {
          await deleteCursoSesion(cursoId, sesionId);
          const resp = await getCursoSesiones(cursoId);
          state.detailSesiones = resp.items;
          render();
        } catch (err: any) {
          alert(err?.detail ?? "No se pudo eliminar la sesión.");
        }
      }
      return;
    }

    // ── Selection & assign to session handlers ──
    if (t.closest("[data-action='open-asignacion-masiva']")) {
      state.showAsignacionMasivaModal = true;
      state.asignacionResult = null;
      state.asignacionAreaId = null;
      state.asignacionSubareaId = null;
      state.asignacionPuestoId = null;
      state.asignacionCatalogosLoading = true;
      render();
      try {
        state.asignacionCatalogos = await getCursoCatalogosAsignacion(state.detailCurso!.id);
      } catch { state.asignacionCatalogos = null; }
      state.asignacionCatalogosLoading = false;
      render();
      return;
    }

    if (t.closest("[data-action='close-asignacion-masiva']") || (t as HTMLElement).dataset.backdrop === "asignacion-masiva") {
      state.showAsignacionMasivaModal = false;
      render();
      return;
    }

    const toggleExpandBtn = t.closest("[data-action='toggle-grupo-expand']") as HTMLElement | null;
    if (toggleExpandBtn && !t.closest("[data-action='toggle-puesto']") && !t.closest("[data-action='quitar-grupo']")) {
      const grupoId = Number(toggleExpandBtn.dataset.grupoId);
      if (state.expandedGrupos.has(grupoId)) {
        state.expandedGrupos.delete(grupoId);
      } else {
        state.expandedGrupos.add(grupoId);
      }
      render();
      return;
    }

    const togglePuestoExpandBtn = t.closest("[data-action='toggle-puesto-expand']") as HTMLElement | null;
    if (togglePuestoExpandBtn && !t.closest("[data-action='toggle-puesto']") && !t.closest("a")) {
      const puestoId = Number(togglePuestoExpandBtn.dataset.puestoId);
      if (state.expandedPuestos.has(puestoId)) {
        state.expandedPuestos.delete(puestoId);
      } else {
        state.expandedPuestos.add(puestoId);
      }
      render();
      return;
    }

    if (t.closest("[data-action='toggle-extras-expand']") && !t.closest("[data-action='toggle-all-extras']")) {
      state.expandedExtras = !state.expandedExtras;
      render();
      return;
    }

    const agregarGrupoBtn = t.closest("[data-action='agregar-grupo']") as HTMLElement | null;
    if (agregarGrupoBtn) {
      const tipo = agregarGrupoBtn.dataset.tipo!;
      const refId = Number(agregarGrupoBtn.dataset.refId);
      if (!tipo || !refId) return;
      state.asignacionLoading = true;
      state.asignacionResult = null;
      render();
      try {
        await agregarGrupoCurso(state.detailCurso!.id, tipo, refId);
        state.asignacionResult = { asignados: 1, ya_asignados: 0 };
        state.detailGrupos = await getCursoGrupos(state.detailCurso!.id);
      } catch { /* silently handle */ }
      state.asignacionLoading = false;
      render();
      return;
    }

    const quitarGrupoBtn = t.closest("[data-action='quitar-grupo']") as HTMLElement | null;
    if (quitarGrupoBtn) {
      const grupoId = Number(quitarGrupoBtn.dataset.grupoId);
      if (!grupoId) return;
      try {
        await quitarGrupoCurso(state.detailCurso!.id, grupoId);
        state.detailGrupos = state.detailGrupos.filter(g => g.id !== grupoId);
        render();
      } catch { /* silently handle */ }
      return;
    }

    if (t.closest("[data-action='open-assign-sesion-picker']")) {
      state.showAssignSesionPicker = true;
      render();
      return;
    }

    if (t.closest("[data-action='close-assign-sesion-picker']") || (t as HTMLElement).dataset.backdrop === "assign-sesion") {
      state.showAssignSesionPicker = false;
      render();
      return;
    }

    if (t.closest("[data-action='clear-selection']")) {
      state.selectedEmpleados = new Set();
      render();
      return;
    }

    const assignBtn = t.closest<HTMLElement>("[data-action='assign-to-sesion']");
    if (assignBtn) {
      const sesionId = Number(assignBtn.dataset.sesionId);
      const cursoId = state.detailCurso?.id;
      if (!sesionId || !cursoId) return;
      assignBtn.classList.add("opacity-50", "pointer-events-none");
      let successCount = 0;
      let errorCount = 0;
      for (const empId of state.selectedEmpleados) {
        try {
          await inscribirEmpleadoSesion(cursoId, sesionId, empId);
          successCount++;
        } catch { errorCount++; }
      }
      state.selectedEmpleados = new Set();
      state.showAssignSesionPicker = false;
      const resp = await getCursoSesiones(cursoId);
      state.detailSesiones = resp.items;
      render();
      if (errorCount > 0) {
        alert(`${successCount} inscrito${successCount !== 1 ? "s" : ""}, ${errorCount} error${errorCount !== 1 ? "es" : ""} (posiblemente ya inscritos).`);
      }
      return;
    }

    if (t.closest("[data-action='cursos-prev']")) {
      if (state.page > 1) {
        state.page--;
        state.loading = true;
        render();
        await loadCursos();
        state.loading = false;
        render();
      }
      return;
    }

    const gotoPageBtn = t.closest<HTMLElement>("[data-action='cursos-goto-page']");
    if (gotoPageBtn) {
      const targetPage = Number(gotoPageBtn.dataset.page);
      const pageSize = state.cursos.page_size || 20;
      const totalPages = Math.max(1, Math.ceil(state.cursos.total / pageSize));
      if (targetPage >= 1 && targetPage <= totalPages && targetPage !== state.page) {
        state.page = targetPage;
        state.loading = true;
        render();
        await loadCursos();
        state.loading = false;
        render();
      }
      return;
    }

    if (t.closest("[data-action='cursos-next']")) {
      const pageSize = state.cursos.page_size || 20;
      const totalPages = Math.max(1, Math.ceil(state.cursos.total / pageSize));
      if (state.page < totalPages) {
        state.page++;
        state.loading = true;
        render();
        await loadCursos();
        state.loading = false;
        render();
      }
      return;
    }
  }

  async function handleChange(e: Event): Promise<void> {
    const t = e.target as HTMLElement;

    // ── Checkbox: toggle individual employee ──
    if (t.matches("[data-action='toggle-emp']")) {
      const empId = Number((t as HTMLInputElement).dataset.empId);
      if ((t as HTMLInputElement).checked) {
        state.selectedEmpleados.add(empId);
      } else {
        state.selectedEmpleados.delete(empId);
      }
      render();
      return;
    }

    // ── Checkbox: toggle all employees in a puesto ──
    if (t.matches("[data-action='toggle-puesto']")) {
      const ids: number[] = JSON.parse((t as HTMLInputElement).dataset.puestoEmps ?? "[]");
      const checked = (t as HTMLInputElement).checked;
      for (const id of ids) {
        if (checked) state.selectedEmpleados.add(id);
        else state.selectedEmpleados.delete(id);
      }
      render();
      return;
    }

    // ── Checkbox: toggle all extras ──
    if (t.matches("[data-action='toggle-all-extras']")) {
      const ids: number[] = JSON.parse((t as HTMLInputElement).dataset.extraEmps ?? "[]");
      const checked = (t as HTMLInputElement).checked;
      for (const id of ids) {
        if (checked) state.selectedEmpleados.add(id);
        else state.selectedEmpleados.delete(id);
      }
      render();
      return;
    }

    const sel = t as HTMLSelectElement;

    if (sel.matches("[data-action='asignacion-area']")) {
      state.asignacionAreaId = sel.value ? Number(sel.value) : null;
      state.asignacionSubareaId = null;
      state.asignacionPuestoId = null;
      state.asignacionResult = null;
      state.asignacionCatalogosLoading = true;
      render();
      try {
        state.asignacionCatalogos = await getCursoCatalogosAsignacion(state.detailCurso!.id, state.asignacionAreaId ?? undefined);
      } catch { state.asignacionCatalogos = null; }
      state.asignacionCatalogosLoading = false;
      render();
      return;
    }

    if (sel.matches("[data-action='asignacion-subarea']")) {
      state.asignacionSubareaId = sel.value ? Number(sel.value) : null;
      state.asignacionResult = null;
      render();
      return;
    }

    if (sel.matches("[data-action='asignacion-puesto']")) {
      state.asignacionPuestoId = sel.value ? Number(sel.value) : null;
      state.asignacionResult = null;
      render();
      return;
    }

    if (sel.matches("[data-action='cursos-filter-tipo']")) {
      state.filters.tipo = sel.value;
      state.page = 1;
      await loadCursos();
      render();
    } else if (sel.matches("[data-action='cursos-filter-clasificacion']")) {
      state.filters.clasificacion = sel.value;
      state.page = 1;
      await loadCursos();
      render();
    } else if (sel.matches("[data-action='cursos-filter-obligatorio']")) {
      state.filters.obligatorio = sel.value;
      state.page = 1;
      await loadCursos();
      render();
    } else if (sel.matches("[data-action='cursos-filter-categoria']")) {
      state.filters.categoria = sel.value;
      state.page = 1;
      await loadCursos();
      render();
    }
  }

  function handleInput(e: Event): void {
    const t = e.target as HTMLInputElement;
    if (t.matches("[data-action='nuevo-proveedor-nombre']")) {
      state.nuevoProveedorNombre = t.value;
      return;
    }
    if (t.matches("[data-action='cursos-search']")) {
      state.filters.busqueda = t.value;
      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        state.page = 1;
        await loadCursos();
        render();
        const input = container.querySelector<HTMLInputElement>("[data-action='cursos-search']");
        if (input) {
          input.focus();
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }, 300);
    }

    if (t.matches("[data-action='instructor-search']")) {
      const query = t.value.toLowerCase().trim();
      const dropdown = container.querySelector<HTMLElement>("[data-ref='instructor-dropdown']");
      if (!dropdown) return;
      if (!query) {
        dropdown.classList.add("hidden");
        return;
      }
      const matches = state.empleados.filter(e => e.nombre.toLowerCase().includes(query)).slice(0, 20);
      if (matches.length === 0) {
        dropdown.innerHTML = `<div class="px-3 py-2 text-sm text-slate-400">Sin resultados</div>`;
      } else {
        dropdown.innerHTML = matches.map(e =>
          `<button type="button" data-action="select-instructor" data-nombre="${escapeHtml(e.nombre)}" class="block w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition truncate">${escapeHtml(e.nombre)}</button>`
        ).join("");
      }
      dropdown.classList.remove("hidden");
    }
  }

  async function handleSubmit(e: Event): Promise<void> {
    const form = (e.target as HTMLElement).closest("form");
    if (!form) return;

    // ── Create Sesion form ──
    if (form.matches("[data-form='create-sesion']")) {
      e.preventDefault();
      const cursoId = state.detailCurso?.id;
      if (!cursoId) return;
      const submitBtn = form.querySelector<HTMLButtonElement>("button[type='submit']");
      if (submitBtn?.disabled) return;
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Guardando..."; }
      const fd = new FormData(form);
      const payload: CursoSesionCreatePayload = {
        fecha_inicio: fd.get("fecha_inicio") as string,
        fecha_fin: (fd.get("fecha_fin") as string) || undefined,
        hora_inicio: (fd.get("hora_inicio") as string) || undefined,
        hora_fin: (fd.get("hora_fin") as string) || undefined,
        ubicacion: (fd.get("ubicacion") as string) || undefined,
        costo: fd.get("costo") ? Number(fd.get("costo")) : undefined,
        notas: (fd.get("notas") as string) || undefined,
      };
      if (!payload.fecha_inicio) { if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Crear"; } return; }
      try {
        await createCursoSesion(cursoId, payload);
        state.showCreateSesionModal = false;
        const resp = await getCursoSesiones(cursoId);
        state.detailSesiones = resp.items;
        render();
      } catch (err: any) {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Crear"; }
        alert(err?.detail ?? "Error al crear la sesión");
      }
      return;
    }

    // ── Create/Edit Curso form ──
    if (!form.matches("[data-action='submit-curso']")) return;
    e.preventDefault();

    if (state.proveedoresLoading) {
      alert("Espera a que carguen los proveedores.");
      return;
    }

    const fd = new FormData(form);
    const payload: CursoCreatePayload = {
      nombre: fd.get("nombre") as string,
      duracion_horas: fd.get("duracion_horas") ? Number(fd.get("duracion_horas")) : undefined,
      obligatorio: form.querySelector<HTMLInputElement>("[name='obligatorio']")?.checked ?? false,
      descripcion: (fd.get("descripcion") as string) || undefined,
      centro_costos: fd.get("centro_costos") ? Number(fd.get("centro_costos")) : undefined,
    };
    const categoriaIdRaw = fd.get("categoria_id");
    const tipoIdRaw = fd.get("tipo_id");
    const clasificacionIdRaw = fd.get("clasificacion_id");
    const proveedorIdRaw = fd.get("proveedor_id");
    if (categoriaIdRaw) payload.categoria_id = Number(categoriaIdRaw);
    if (tipoIdRaw) payload.tipo_id = Number(tipoIdRaw);
    if (clasificacionIdRaw) payload.clasificacion_id = Number(clasificacionIdRaw);
    if (proveedorIdRaw) payload.proveedor_id = Number(proveedorIdRaw);
    if (state.editingCurso) {
      payload.requisitos = (fd.get("requisitos") as string) || undefined;
    }

    if (!payload.nombre) return;

    try {
      if (state.editingCurso) {
        await updateCurso(state.editingCurso.id, payload);
      } else {
        await createCurso(payload);
      }
      closeCursoModal();
      await loadCursos();
      render();
    } catch (err: any) {
      alert(err?.detail ?? "Error al guardar el curso");
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape" && state.viewingSesion) {
      state.viewingSesion = null;
      state.sesionEmpleados = [];
      render();
      return;
    }
    if (e.key === "Escape" && state.showCreateSesionModal) {
      state.showCreateSesionModal = false;
      render();
      return;
    }
    if (e.key === "Escape" && (state.showCreateModal || state.editingCurso)) {
      closeCursoModal();
      render();
    }
  }

  render();
  const listenerOpts = { signal };
  container.addEventListener("click", handleClick, listenerOpts);
  container.addEventListener("change", handleChange, listenerOpts);
  container.addEventListener("input", handleInput, listenerOpts);
  container.addEventListener("submit", handleSubmit, listenerOpts);
  document.addEventListener("keydown", handleKeydown, listenerOpts);

  (async () => {
    await loadCursos();
    if (signal.aborted) return;
    state.loading = false;
    render();

    const hashMatch = location.hash.match(/^#\/cursos\/(\d+)$/);
    if (hashMatch) {
      const cursoId = Number(hashMatch[1]);
      try {
        const curso = await getCursoById(cursoId);
        if (signal.aborted) return;
        navigateToDetail(curso);
      } catch {}
    }
  })();
}

// ── OPLs: tipos y datos fake ─────────────────────────────────────────────────

type OPLTone = "ok" | "warn" | "info";

interface OPLItem {
  id: string;
  titulo: string;
  proc: string;
  maq: string;
  ver: string;
  estado: string;
  tone: OPLTone;
  afect: number;
  aprob: string;
  fecha: string;
}

interface OPLVersion {
  ver: string;
  fecha: string;
  autor: string;
  tone: OPLTone;
  desc: string;
  actual?: boolean;
}

const FAKE_OPLS: OPLItem[] = [
  { id: "OPL-2041", titulo: "Cambio de herramental prensa CRIMP-A12", proc: "Crimpado", maq: "CRIMP-A12", ver: "v4", estado: "Reentren.", tone: "warn", afect: 24, aprob: "R. Cuevas", fecha: "02/05/26" },
  { id: "OPL-2055", titulo: "Crimpado manual · tolerancia de altura", proc: "Crimpado", maq: "—", ver: "v2", estado: "Vigente", tone: "ok", afect: 48, aprob: "M. Esquivel", fecha: "14/04/26" },
  { id: "OPL-2099", titulo: "Bloqueo LOTO en celda CR-12", proc: "Seguridad", maq: "CR-12", ver: "v3", estado: "Vigente", tone: "ok", afect: 214, aprob: "H. Cárdenas", fecha: "22/03/26" },
  { id: "OPL-2110", titulo: "Inspección visual post-crimp IPC-A-620", proc: "Calidad", maq: "—", ver: "v5", estado: "Reentren.", tone: "warn", afect: 62, aprob: "S. Peña", fecha: "08/05/26" },
  { id: "OPL-2118", titulo: "Cambio de carrete en ENS-04", proc: "Ensamble", maq: "ENS-04", ver: "v2", estado: "Vigente", tone: "ok", afect: 36, aprob: "I. Bermúdez", fecha: "11/04/26" },
  { id: "OPL-2121", titulo: "Hi-Pot · uso de pinza aislada", proc: "Prueba E.", maq: "HIPOT-02", ver: "v1", estado: "Borrador", tone: "info", afect: 22, aprob: "En revisión", fecha: "10/05/26" },
  { id: "OPL-2130", titulo: "Bloqueo de máquina por incidente", proc: "Seguridad", maq: "—", ver: "v6", estado: "Vigente", tone: "ok", afect: 214, aprob: "H. Cárdenas", fecha: "02/02/26" },
  { id: "OPL-2135", titulo: "Reposición de aislante térmico", proc: "Mantenimiento", maq: "CR-12", ver: "v3", estado: "Vigente", tone: "ok", afect: 18, aprob: "H. Cárdenas", fecha: "20/03/26" },
];

const OPL_DETAIL_VERSIONS: OPLVersion[] = [
  { ver: "v4", fecha: "02/05/26", autor: "R. Cuevas", tone: "warn", desc: "Cambio de tolerancia altura crimp 0.05 → 0.03 mm · dispara reentrenamiento de 24 personas", actual: true },
  { ver: "v3", fecha: "14/01/26", autor: "R. Cuevas", tone: "ok", desc: "Actualización de imágenes de referencia y bloqueo LOTO" },
  { ver: "v2", fecha: "09/08/25", autor: "M. Esquivel", tone: "ok", desc: "Corrección menor: número de parte herramental" },
  { ver: "v1", fecha: "02/03/24", autor: "M. Esquivel", tone: "info", desc: "Versión inicial · liberación" },
];

function oplTonePill(estado: string, tone: OPLTone): string {
  const styles: Record<OPLTone, string> = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warn: "border-amber-200 bg-amber-50 text-amber-700",
    info: "border-blue-200 bg-blue-50 text-blue-600",
  };
  return `<span class="inline-flex items-center rounded-full border ${styles[tone]} px-2 py-0.5 text-[10px] font-semibold">${escapeHtml(estado)}</span>`;
}

function renderOPLsHeader(): string {
  return `
  <div class="flex items-start justify-between">
    <div>
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">OPLs · 127 activas en planta</p>
      <h1 class="mt-1 text-lg font-semibold text-text-primary">Manejo de OPLs</h1>
      <p class="mt-1 text-sm text-text-muted">Registro digital de One Point Lessons con control de versiones, flujo de aprobaci&oacute;n y disparo autom&aacute;tico de reentrenamiento cuando una OPL cambia.</p>
    </div>
    <div class="flex items-center gap-2 shrink-0">
      <button class="${BTN_SECONDARY} !text-xs !px-3 !py-1.5" disabled><svg class="size-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>Todas las &aacute;reas</button>
      <button class="${BTN_SECONDARY} !text-xs !px-3 !py-1.5" disabled><svg class="size-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Exportar trazabilidad</button>
      <button class="${BTN_PRIMARY} !text-xs !px-3 !py-1.5" disabled><svg class="size-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>Nueva OPL</button>
    </div>
  </div>`;
}

function renderOPLsAlert(): string {
  return `
  <div class="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
    <svg class="size-5 shrink-0 text-amber-600 mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
    <div class="flex-1 min-w-0">
      <p class="text-xs font-semibold text-amber-800">2 OPLs actualizadas requieren reentrenamiento.</p>
      <p class="mt-0.5 text-[11px] text-amber-700">OPL-2041 (24 personas) y OPL-2110 (62 personas) generaron capacitaciones autom&aacute;ticas pendientes de programaci&oacute;n.</p>
    </div>
    <button class="${BTN_SECONDARY} !text-[11px] !px-2.5 !py-1 shrink-0 !border-amber-300 !text-amber-800 hover:!bg-amber-100" disabled>Programar reentrenamiento</button>
  </div>`;
}

function renderOPLsTable(): string {
  const statusPills = `
    <div class="flex items-center gap-2">
      <span class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Vigentes 112</span>
      <span class="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Reentren. 9</span>
      <span class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">Borrador 6</span>
    </div>`;

  const rows = FAKE_OPLS.map((opl, idx) => {
    const selectedBg = idx === 0 ? "bg-blue-50/60" : "hover:bg-slate-50/60";
    return `
    <tr class="border-t border-slate-100 ${selectedBg} transition-colors">
      <td class="px-3 py-2.5">
        <div class="min-w-0">
          <span class="font-mono text-[10px] text-slate-400">${escapeHtml(opl.id)}</span>
          <p class="mt-0.5 text-xs font-semibold text-slate-900 leading-tight truncate max-w-[220px]">${escapeHtml(opl.titulo)}</p>
        </div>
      </td>
      <td class="px-3 py-2.5">
        <div class="text-xs text-slate-700">${escapeHtml(opl.proc)}</div>
        <div class="text-[10px] text-slate-400">${escapeHtml(opl.maq)}</div>
      </td>
      <td class="px-3 py-2.5 text-center"><span class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-600">${escapeHtml(opl.ver)}</span></td>
      <td class="px-3 py-2.5 text-center text-xs font-semibold tabular-nums text-slate-700">${opl.afect}</td>
      <td class="px-3 py-2.5">
        <div class="text-xs text-slate-700">${escapeHtml(opl.aprob)}</div>
        <div class="text-[10px] text-slate-400">${escapeHtml(opl.fecha)}</div>
      </td>
      <td class="px-3 py-2.5 text-center">${oplTonePill(opl.estado, opl.tone)}</td>
    </tr>`;
  }).join("");

  return `
  <div class="rounded-xl border border-border bg-white overflow-hidden flex flex-col">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
      <div>
        <p class="text-sm font-semibold text-slate-900">OPLs activas</p>
        <p class="text-[11px] text-slate-500">8 de 127 · ordenadas por &uacute;ltima actualizaci&oacute;n</p>
      </div>
      ${statusPills}
    </div>
    <div class="overflow-x-auto flex-1">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="border-b border-slate-200 bg-slate-50">
            <th class="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">OPL</th>
            <th class="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Proceso/m&aacute;quina</th>
            <th class="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">Ver.</th>
            <th class="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">Afecta</th>
            <th class="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Aprobaci&oacute;n</th>
            <th class="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">Estado</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderOPLDetail(): string {
  const opl = FAKE_OPLS[0];

  const versionTimeline = OPL_DETAIL_VERSIONS.map((v, idx) => {
    const dotColor = v.tone === "warn" ? "bg-amber-400 ring-amber-100" : v.tone === "info" ? "bg-blue-400 ring-blue-100" : "bg-emerald-400 ring-emerald-100";
    const isLast = idx === OPL_DETAIL_VERSIONS.length - 1;
    return `
    <div class="relative flex gap-3 ${!isLast ? "pb-4" : ""}">
      ${!isLast ? `<div class="absolute left-[7px] top-4 bottom-0 w-px bg-slate-200"></div>` : ""}
      <div class="relative shrink-0">
        <span class="flex size-[15px] items-center justify-center rounded-full ${dotColor} ring-4"></span>
      </div>
      <div class="flex-1 min-w-0 -mt-0.5">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-mono text-[11px] font-bold text-slate-800">${escapeHtml(v.ver)}</span>
          <span class="text-[10px] text-slate-500">${escapeHtml(v.fecha)}</span>
          <span class="text-[10px] text-slate-400">· ${escapeHtml(v.autor)}</span>
          ${v.actual ? `<span class="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">Actual</span>` : ""}
        </div>
        <p class="mt-1 text-[11px] leading-relaxed text-slate-600">${escapeHtml(v.desc)}</p>
      </div>
    </div>`;
  }).join("");

  const avatarColors = ["bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-pink-500", "bg-teal-500"];
  const avatars = avatarColors.slice(0, 9).map((color, i) => {
    const offset = i * 20;
    return `<span class="absolute top-0 flex size-7 items-center justify-center rounded-full border-2 border-white ${color} text-[9px] font-bold text-white" style="left: ${offset}px">?</span>`;
  }).join("");

  return `
  <div class="rounded-xl border border-border bg-white overflow-hidden flex flex-col">
    <div class="border-b border-slate-100 px-4 py-4">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600">${escapeHtml(opl.id)}</span>
        ${oplTonePill("Reentrenamiento", "warn")}
      </div>
      <h2 class="mt-2 text-sm font-semibold text-slate-900 leading-tight">${escapeHtml(opl.titulo)}</h2>
      <p class="mt-1 text-[11px] text-slate-500">Proceso de crimpado · Aprobada ${escapeHtml(opl.fecha)} por ${escapeHtml(opl.aprob)}</p>
    </div>

    <div class="border-b border-slate-100 px-4 py-4">
      <div class="relative w-full overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50" style="padding-top: 56.25%">
        <div class="absolute inset-0 flex flex-col items-center justify-center" style="background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(148,163,184,0.08) 10px, rgba(148,163,184,0.08) 20px)">
          <svg class="size-8 text-slate-300" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
          <p class="mt-2 text-[11px] font-semibold text-slate-400">VISTA PREVIA</p>
          <p class="text-[10px] text-slate-400">${escapeHtml(opl.id)} ${escapeHtml(opl.ver)}.pdf</p>
        </div>
      </div>
    </div>

    <div class="border-b border-slate-100 px-4 py-4">
      <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-3">Historial de versiones</p>
      ${versionTimeline}
    </div>

    <div class="px-4 py-4">
      <div class="flex items-center justify-between mb-3">
        <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Personal impactado</p>
        <span class="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">24 pendientes</span>
      </div>
      <div class="relative h-7" style="width: ${9 * 20 + 8}px">
        ${avatars}
      </div>
      <span class="mt-2 inline-block rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">+15</span>
    </div>
  </div>`;
}

function renderOPLsPage(): string {
  return `
  <div class="flex flex-col gap-5">
    ${renderOPLsHeader()}
    ${renderOPLsAlert()}
    <div class="grid grid-cols-1 gap-5 lg:grid-cols-5">
      <div class="lg:col-span-3">
        ${renderOPLsTable()}
      </div>
      <div class="lg:col-span-2">
        ${renderOPLDetail()}
      </div>
    </div>
  </div>`;
}

export function mountOPLs(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Manejo de OPLs",
    activeNav: "opls",
    mainHtml: renderOPLsPage(),
  });
}

// ── Evidencias: tipos y datos fake ───────────────────────────────────────────

type EvidTipo = "documento" | "video" | "imagen" | "formulario";
type EvidTone = "ok" | "warn" | "info" | "danger";
type EvidPrio = "alta" | "media" | "baja";

interface EvidQueueItem {
  id: string;
  tipo: EvidTipo;
  curso: string;
  colab: string;
  subida: string;
  evaluador: string;
  prio: EvidPrio;
  estado: string;
  tone: EvidTone;
  selected?: boolean;
}

const EVID_QUEUE: EvidQueueItem[] = [
  { id: "EV-7732", tipo: "documento", curso: "OPL-2041 · Cambio herramental", colab: "Diego Hurtado Vidal", subida: "hace 2h", evaluador: "R. Cuevas", prio: "alta", estado: "En revisión", tone: "warn", selected: true },
  { id: "EV-7731", tipo: "video", curso: "Crimpado manual · Nivel 2", colab: "Brenda Valdez Aguilar", subida: "hace 5h", evaluador: "J. Salazar", prio: "media", estado: "En revisión", tone: "warn" },
  { id: "EV-7730", tipo: "documento", curso: "IPC-A-620 · Inspección visual", colab: "Adrián Carmona Soto", subida: "hace 6h", evaluador: "S. Peña", prio: "media", estado: "Esperando firma", tone: "info" },
  { id: "EV-7729", tipo: "imagen", curso: "Hi-Pot · Operación segura", colab: "Ana Karina Reséndiz", subida: "hace 1d", evaluador: "P. Loera", prio: "baja", estado: "En revisión", tone: "warn" },
  { id: "EV-7728", tipo: "formulario", curso: "5S en piso", colab: "María Ortega Reyes", subida: "hace 1d", evaluador: "R. Cuevas", prio: "baja", estado: "En revisión", tone: "warn" },
  { id: "EV-7727", tipo: "video", curso: "LOTO · práctica", colab: "Lucía Mendoza Vargas", subida: "hace 2d", evaluador: "H. Cárdenas", prio: "alta", estado: "Devuelta", tone: "danger" },
];

function evidTipoIcon(tipo: EvidTipo): string {
  switch (tipo) {
    case "documento":
      return `<svg class="size-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>`;
    case "video":
      return `<svg class="size-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
    case "imagen":
      return `<svg class="size-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`;
    case "formulario":
      return `<svg class="size-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>`;
  }
}

function evidTipoPill(tipo: EvidTipo): string {
  const labels: Record<EvidTipo, string> = { documento: "Documento", video: "Video", imagen: "Imagen", formulario: "Formulario" };
  return `<span class="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">${evidTipoIcon(tipo)}${labels[tipo]}</span>`;
}

function evidPrioPill(prio: EvidPrio): string {
  const styles: Record<EvidPrio, string> = {
    alta: "border-red-200 bg-red-50 text-red-700",
    media: "border-amber-200 bg-amber-50 text-amber-700",
    baja: "border-blue-200 bg-blue-50 text-blue-600",
  };
  return `<span class="inline-flex items-center rounded-full border ${styles[prio]} px-1.5 py-0.5 text-[10px] font-semibold capitalize">${escapeHtml(prio)}</span>`;
}

function evidTonePill(label: string, tone: EvidTone): string {
  const styles: Record<EvidTone, string> = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warn: "border-amber-200 bg-amber-50 text-amber-700",
    info: "border-blue-200 bg-blue-50 text-blue-600",
    danger: "border-red-200 bg-red-50 text-red-700",
  };
  return `<span class="inline-flex items-center rounded-full border ${styles[tone]} px-2 py-0.5 text-[10px] font-semibold">${escapeHtml(label)}</span>`;
}

function renderEvidQueueItem(item: EvidQueueItem): string {
  const initials = item.colab.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const selectedCls = item.selected ? "border-l-[3px] border-l-blue-500 bg-blue-50" : "border-l-[3px] border-l-transparent hover:bg-slate-50";
  return `
  <div class="flex flex-col gap-1.5 px-3 py-3 border-b border-slate-100 ${selectedCls} transition-colors cursor-pointer">
    <div class="flex items-center gap-2 flex-wrap">
      <span class="font-mono text-[10px] font-medium text-slate-500">${escapeHtml(item.id)}</span>
      ${evidTipoPill(item.tipo)}
      ${evidPrioPill(item.prio)}
    </div>
    <p class="text-xs font-semibold text-slate-900 leading-tight">${escapeHtml(item.curso)}</p>
    <div class="flex items-center gap-2">
      <span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-leoni-blue text-[8px] font-bold text-white">${escapeHtml(initials)}</span>
      <span class="text-[11px] text-slate-600">${escapeHtml(item.colab)}</span>
      <span class="text-[10px] text-slate-400">&middot; ${escapeHtml(item.subida)} &middot; ${escapeHtml(item.evaluador)}</span>
    </div>
  </div>`;
}

function renderEvidQueue(): string {
  return `
  <div class="rounded-xl border border-border bg-white overflow-hidden flex flex-col h-full">
    <div class="flex items-center gap-1 border-b border-slate-100 px-3 py-2.5">
      <button class="rounded-md bg-leoni-blue px-2.5 py-1 text-[11px] font-semibold text-white">Pendientes <span class="ml-0.5 font-mono">18</span></button>
      <button class="rounded-md px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 transition">M&iacute;as <span class="ml-0.5 font-mono">7</span></button>
      <button class="rounded-md px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 transition">Devueltas <span class="ml-0.5 font-mono">3</span></button>
      <button class="rounded-md px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 transition">Hist&oacute;rico <span class="ml-0.5 font-mono">1248</span></button>
    </div>
    <div class="flex-1 overflow-y-auto">
      ${EVID_QUEUE.map(item => renderEvidQueueItem(item)).join("")}
    </div>
  </div>`;
}

function renderEvidDetailHeader(): string {
  return `
  <div class="flex items-start justify-between gap-3">
    <div>
      <div class="flex items-center gap-2 flex-wrap">
        <span class="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600">EV-7732</span>
        ${evidTonePill("En revisión", "warn")}
        ${evidTonePill("Prioridad alta", "danger")}
      </div>
      <h2 class="mt-2 text-sm font-semibold text-slate-900">Evidencia &middot; OPL-2041 Cambio de herramental</h2>
      <p class="mt-1 text-[11px] text-slate-500">Diego Hurtado Vidal &middot; E-1701 &middot; Cableado L&iacute;nea 1 &middot; Turno T2</p>
    </div>
    <div class="flex items-center gap-2 shrink-0">
      <button class="${BTN_SECONDARY} !text-[11px] !px-2.5 !py-1.5 opacity-60 cursor-not-allowed" disabled>Devolver</button>
      <button class="${BTN_SECONDARY} !text-[11px] !px-2.5 !py-1.5 opacity-60 cursor-not-allowed" disabled>Solicitar m&aacute;s info</button>
      <button class="${BTN_PRIMARY} !text-[11px] !px-2.5 !py-1.5 opacity-60 cursor-not-allowed" disabled>Validar y firmar</button>
    </div>
  </div>`;
}

function renderEvidPreview(): string {
  return `
  <div class="flex flex-col gap-3">
    <div class="relative w-full overflow-hidden rounded-lg bg-slate-800" style="aspect-ratio: 4/3">
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <svg class="size-10 text-slate-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
        <p class="mt-2 text-xs font-semibold text-slate-300">checklist_OPL2041_diego.pdf</p>
        <p class="mt-1 text-[10px] text-slate-400">2 p&aacute;ginas &middot; 318 KB &middot; subido 12/05/26 11:42</p>
      </div>
    </div>
    <div class="flex items-center gap-2 flex-wrap">
      <span class="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-700">
        <svg class="size-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
        checklist_OPL2041_diego.pdf
      </span>
      <span class="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-700">
        <svg class="size-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        foto_crimp_001.jpg
      </span>
      <button class="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-1 text-[10px] font-medium text-slate-500 hover:border-slate-400 transition">
        <svg class="size-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
        Agregar p&aacute;gina
      </button>
    </div>
  </div>`;
}

function renderEvidChecklist(): string {
  const items = [
    { label: "Documento legible y completo", done: true },
    { label: "Firma física del colaborador presente", done: true },
    { label: "Coincide con la versión vigente de la OPL", done: true },
    { label: "Foto de evidencia incluida y nítida", done: true },
    { label: "Sello del líder de línea", done: false },
  ];
  return `
  <div class="mt-4">
    <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Checklist de validaci&oacute;n</p>
    <div class="flex flex-col gap-1.5">
      ${items.map(item => {
        const checkIcon = item.done
          ? `<span class="flex size-4 shrink-0 items-center justify-center rounded bg-emerald-100 text-emerald-700"><svg class="size-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg></span>`
          : `<span class="flex size-4 shrink-0 items-center justify-center rounded border border-slate-300 bg-white"></span>`;
        const textCls = item.done ? "text-slate-700" : "text-slate-500";
        const badge = !item.done ? ` <span class="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 ml-1.5">Pendiente</span>` : "";
        return `<div class="flex items-center gap-2">${checkIcon}<span class="text-[11px] ${textCls}">${item.label}</span>${badge}</div>`;
      }).join("")}
    </div>
  </div>`;
}

function renderEvidContexto(): string {
  const fields = [
    { label: "Curso", value: "OPL-2041 Cambio de herramental" },
    { label: "Versión OPL", value: "v4 · 02/05/26" },
    { label: "Capacitación", value: "CAP-3402" },
    { label: "Asignada", value: "08/05/26" },
    { label: "Vence", value: "22/05/26" },
    { label: "Modalidad", value: "En piso · Línea 1" },
  ];
  return `
  <div>
    <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Contexto</p>
    <div class="flex flex-col divide-y divide-dashed divide-slate-200 rounded-lg border border-slate-200">
      ${fields.map(f => `
        <div class="flex items-center justify-between px-3 py-2">
          <span class="text-[11px] text-slate-500">${f.label}</span>
          <span class="text-[11px] font-semibold text-slate-800">${escapeHtml(f.value)}</span>
        </div>
      `).join("")}
    </div>
  </div>`;
}

function renderEvidFirmas(): string {
  const firmas = [
    { name: "Rafael Cuevas", role: "Líder de Línea", status: "Tu turno", tone: "warn" as EvidTone },
    { name: "Mariana Cervantes", role: "Coord. RRHH", status: "En espera", tone: "info" as EvidTone },
    { name: "Sandra Peña", role: "Calidad", status: "En espera", tone: "info" as EvidTone },
  ];
  return `
  <div class="mt-4">
    <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Firmas requeridas</p>
    <div class="flex flex-col gap-2">
      ${firmas.map(f => {
        const initials = f.name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
        return `
        <div class="flex items-center gap-2.5 rounded-lg border border-slate-100 px-3 py-2">
          <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-leoni-blue text-[9px] font-bold text-white">${escapeHtml(initials)}</span>
          <div class="flex-1 min-w-0">
            <p class="text-[11px] font-semibold text-slate-800">${f.name}</p>
            <p class="text-[10px] text-slate-500">${f.role}</p>
          </div>
          ${evidTonePill(f.status, f.tone)}
        </div>`;
      }).join("")}
    </div>
  </div>`;
}

function renderEvidActividad(): string {
  const timeline = [
    { action: "Subida por D. Hurtado", time: "12/05/26 11:42" },
    { action: "Notificación a R. Cuevas", time: "12/05/26 11:42" },
    { action: "Asignada a R. Cuevas", time: "12/05/26 11:43" },
    { action: "Abierta por R. Cuevas", time: "12/05/26 13:18" },
  ];
  return `
  <div class="mt-4">
    <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Actividad</p>
    <div class="flex flex-col gap-2">
      ${timeline.map((t, idx) => {
        const isLast = idx === timeline.length - 1;
        return `
        <div class="relative flex gap-2.5 ${!isLast ? "pb-1" : ""}">
          ${!isLast ? `<div class="absolute left-[5px] top-3 bottom-0 w-px bg-slate-200"></div>` : ""}
          <span class="relative flex size-[11px] shrink-0 items-center justify-center rounded-full bg-slate-300 mt-0.5"></span>
          <div class="flex-1 flex items-center justify-between min-w-0">
            <span class="text-[11px] text-slate-700">${escapeHtml(t.action)}</span>
            <span class="text-[10px] font-mono text-slate-400 shrink-0">${escapeHtml(t.time)}</span>
          </div>
        </div>`;
      }).join("")}
    </div>
  </div>`;
}

function renderEvidDetail(): string {
  return `
  <div class="rounded-xl border border-border bg-white overflow-hidden flex flex-col h-full">
    <div class="border-b border-slate-100 px-5 py-4">
      ${renderEvidDetailHeader()}
    </div>
    <div class="flex-1 overflow-y-auto p-5">
      <div class="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <div>
          ${renderEvidPreview()}
          ${renderEvidChecklist()}
        </div>
        <div>
          ${renderEvidContexto()}
          ${renderEvidFirmas()}
          ${renderEvidActividad()}
        </div>
      </div>
    </div>
  </div>`;
}

function renderEvidenciasPage(): string {
  return `
  <div class="flex flex-col gap-5 h-full">
    <div class="flex items-start justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Motor de evidencias &middot; 18 pendientes</p>
        <h1 class="mt-1 text-lg font-semibold text-text-primary">Bandeja de validaci&oacute;n</h1>
        <p class="mt-1 text-sm text-text-muted max-w-2xl">Toda evidencia que respalda la acreditaci&oacute;n de un curso, capacidad u OPL. Validaci&oacute;n, firma y fecha-hora-usuario quedan registradas en el expediente digital.</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button class="${BTN_SECONDARY} !text-xs !px-3 !py-1.5" disabled>Mis evidencias</button>
        <button class="${BTN_SECONDARY} !text-xs !px-3 !py-1.5" disabled><svg class="size-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Exportar expediente</button>
      </div>
    </div>
    <div class="grid grid-cols-1 gap-5 lg:grid-cols-[420px_1fr] flex-1 min-h-0">
      ${renderEvidQueue()}
      ${renderEvidDetail()}
    </div>
  </div>`;
}

export function mountEvidencias(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Motor de Evidencias",
    activeNav: "evidencias",
    mainHtml: renderEvidenciasPage(),
  });
}

// ── Sugerencias: tipos y datos fake ──────────────────────────────────────────

type SugFuente = "Brecha interna" | "Mercado laboral";
type SugImpacto = "Alto" | "Medio" | "Bajo";

interface SugerenciaItem {
  id: string;
  titulo: string;
  fuente: SugFuente;
  impacto: SugImpacto;
  prio: number; // stars filled out of 4
  razon: string;
  capCubre: string[];
  areas: string[];
  personas: number;
  dur: string;
  costo: string;
  proveedor: string;
  brechaPct: number;
  mercadoPct: number;
  benchmark: string;
  featured?: boolean;
  badge?: string;
}

const FAKE_SUGERENCIAS: SugerenciaItem[] = [
  {
    id: "SUG-118",
    titulo: "Diagnóstico de continuidad · nivel avanzado",
    fuente: "Brecha interna",
    impacto: "Alto",
    prio: 3,
    razon: "14 colaboradores en Línea 5 están dos niveles por debajo del requerido en CT-01 Continuidad eléctrica.",
    capCubre: ["CT-01", "CT-02", "QA-02"],
    areas: ["Cableado · L3", "Ensamble · L5"],
    personas: 14,
    dur: "12h",
    costo: "$ 38,000",
    proveedor: "Interno · Patricia Loera",
    brechaPct: 38,
    mercadoPct: 72,
    benchmark: "En el sector automotriz mexicano, 72% de plantas tier-1 incluyen un curso avanzado de continuidad eléctrica para operadores con +18m de antigüedad.",
    featured: true,
    badge: "Recomendada",
  },
  {
    id: "SUG-117",
    titulo: "IPC/WHMA-A-620 Rev.D · actualización 2026",
    fuente: "Mercado laboral",
    impacto: "Medio",
    prio: 2,
    razon: "IPC actualizó Rev.D en enero 2026; las plantas certificadas requieren reentrenamiento dentro de 12 meses.",
    capCubre: ["QA-01", "QA-02"],
    areas: ["Calidad", "Inspección"],
    personas: 14,
    dur: "32h",
    costo: "$ 124,000",
    proveedor: "Externo · IPC México",
    brechaPct: 0,
    mercadoPct: 89,
    benchmark: "89% de plantas tier-1 ya están en proceso de re-certificación a Rev.D según índice ANIA 2026.",
  },
  {
    id: "SUG-116",
    titulo: "Resolución de problemas · método 8D",
    fuente: "Brecha interna",
    impacto: "Medio",
    prio: 2,
    razon: "Líderes de línea con nivel 2/4 en habilidad BL-03 resolución de problemas. Identificado en evaluación 360 marzo 2026.",
    capCubre: ["BL-03"],
    areas: ["Operaciones", "Líderes"],
    personas: 24,
    dur: "8h",
    costo: "$ 28,000",
    proveedor: "Externo · Crehana",
    brechaPct: 41,
    mercadoPct: 64,
    benchmark: "64% de plantas IATF 16949 capacitan a sus líderes en 8D dentro del primer año.",
  },
  {
    id: "SUG-115",
    titulo: "Polivalencia: Ruteo en tablero",
    fuente: "Brecha interna",
    impacto: "Medio",
    prio: 1,
    razon: "Para absorber el aumento de demanda Q3, se requiere 18 polivalencias adicionales en EN-02 Ruteo.",
    capCubre: ["EN-02"],
    areas: ["Ensamble · L2", "Ensamble · L5"],
    personas: 18,
    dur: "6h",
    costo: "$ 22,000",
    proveedor: "Interno · Jorge Salazar",
    brechaPct: 28,
    mercadoPct: 0,
    benchmark: "No aplica · sugerencia 100% por necesidad operativa interna.",
  },
];

function sugFuentePill(fuente: SugFuente): string {
  const styles: Record<SugFuente, { border: string; bg: string; text: string; dot: string }> = {
    "Brecha interna": { border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-600", dot: "bg-blue-500" },
    "Mercado laboral": { border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-600", dot: "bg-blue-400" },
  };
  const s = styles[fuente];
  return `<span class="inline-flex items-center gap-1.5 rounded-full border ${s.border} ${s.bg} px-2 py-0.5 text-[10px] font-semibold ${s.text}"><span class="size-1.5 shrink-0 rounded-full ${s.dot}" aria-hidden="true"></span>${escapeHtml(fuente)}</span>`;
}

function sugImpactoPill(impacto: SugImpacto): string {
  const styles: Record<SugImpacto, string> = {
    "Alto": "border-red-200 bg-red-50 text-red-700",
    "Medio": "border-amber-200 bg-amber-50 text-amber-700",
    "Bajo": "border-blue-200 bg-blue-50 text-blue-600",
  };
  return `<span class="inline-flex items-center rounded-full border ${styles[impacto]} px-2 py-0.5 text-[10px] font-semibold">${escapeHtml(impacto)}</span>`;
}

function sugStarRating(filled: number, total: number = 4): string {
  const stars: string[] = [];
  for (let i = 0; i < total; i++) {
    if (i < filled) {
      stars.push(`<span class="text-blue-500 text-sm">&#9733;</span>`);
    } else {
      stars.push(`<span class="text-slate-300 text-sm">&#9733;</span>`);
    }
  }
  return `<span class="inline-flex items-center gap-0.5">${stars.join("")}</span>`;
}

function sugProgressBar(pct: number, color: string): string {
  return `
  <div class="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
    <div class="h-full rounded-full ${color}" style="width: ${pct}%"></div>
  </div>`;
}

function renderSugKpis(): string {
  const kpis = [
    { label: "Sugerencias activas", value: "11", sub: "7 por brecha · 4 por mercado" },
    { label: "Impacto alto", value: "3", sub: "Bloquean cumplimiento operativo" },
    { label: "Inversión sugerida", value: "$ 312k", sub: "Acumulado anual estimado" },
    { label: "Personas alcanzables", value: "142", sub: "Si se aprueban todas" },
  ];
  return `
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    ${kpis.map(k => `
      <div class="rounded-xl border border-border bg-white p-4">
        <p class="text-xs font-medium text-text-muted">${escapeHtml(k.label)}</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-text-primary">${k.value}</p>
        <p class="mt-0.5 text-[11px] text-slate-500">${escapeHtml(k.sub)}</p>
      </div>
    `).join("")}
  </div>`;
}

function renderSugCard(sug: SugerenciaItem): string {
  const featuredBorder = sug.featured ? "border-l-[3px] border-l-blue-500" : "";

  // Column 1: Main content
  const pills = `
    <div class="flex items-center gap-2 flex-wrap">
      <span class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-600">${escapeHtml(sug.id)}</span>
      ${sugFuentePill(sug.fuente)}
      ${sugImpactoPill(sug.impacto)}
      ${sug.badge ? `<span class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">${escapeHtml(sug.badge)}</span>` : ""}
    </div>`;

  const capPills = sug.capCubre.map(c => `<span class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-600">${escapeHtml(c)}</span>`).join("");
  const areaPills = sug.areas.map(a => `<span class="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">${escapeHtml(a)}</span>`).join("");

  const col1 = `
    <div class="flex flex-col gap-2.5 min-w-0">
      ${pills}
      <p class="text-[15px] font-medium text-slate-900 leading-tight">${escapeHtml(sug.titulo)}</p>
      <p class="text-xs text-slate-500 leading-relaxed">${escapeHtml(sug.razon)}</p>
      <div class="flex items-center gap-1.5 flex-wrap">
        ${capPills}
        <span class="text-slate-300">|</span>
        ${areaPills}
      </div>
      <div class="flex items-center gap-4 flex-wrap text-[11px] text-slate-600 mt-1">
        <span><b class="font-semibold text-slate-800">${sug.personas}</b> personas</span>
        <span><b class="font-semibold text-slate-800">${escapeHtml(sug.dur)}</b> duración</span>
        <span><b class="font-semibold text-slate-800">${escapeHtml(sug.costo)}</b> inversión est.</span>
        <span>${escapeHtml(sug.proveedor)}</span>
      </div>
    </div>`;

  // Column 2: Justification panel
  const col2 = `
    <div class="rounded-lg bg-slate-50 p-4 flex flex-col gap-3">
      <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Justificación</p>
      <div class="flex flex-col gap-2">
        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="text-[11px] text-slate-600">Brecha interna</span>
            <span class="text-[11px] font-semibold tabular-nums text-slate-800">${sug.brechaPct}%</span>
          </div>
          ${sugProgressBar(sug.brechaPct, "bg-blue-500")}
        </div>
        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="text-[11px] text-slate-600">Adopción del sector</span>
            <span class="text-[11px] font-semibold tabular-nums text-slate-800">${sug.mercadoPct}%</span>
          </div>
          ${sugProgressBar(sug.mercadoPct, "bg-blue-400")}
        </div>
      </div>
      <div class="mt-1">
        <p class="text-[9px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Benchmark</p>
        <p class="text-[11px] text-slate-600 leading-relaxed">${escapeHtml(sug.benchmark)}</p>
      </div>
    </div>`;

  // Column 3: Actions
  const col3 = `
    <div class="flex flex-col gap-3 items-center justify-start">
      <div class="text-center">
        <p class="text-[10px] font-semibold text-slate-500 mb-1">Prioridad</p>
        ${sugStarRating(sug.prio)}
      </div>
      <div class="w-full border-t border-slate-200"></div>
      <button class="${BTN_PRIMARY} !text-[11px] !px-3 !py-1.5 w-full opacity-60 cursor-not-allowed" disabled>Aprobar y programar</button>
      <button class="${BTN_SECONDARY} !text-[11px] !px-3 !py-1.5 w-full opacity-60 cursor-not-allowed" disabled>Posponer</button>
      <button class="rounded-md px-3 py-1.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100 transition w-full opacity-60 cursor-not-allowed" disabled>Descartar</button>
    </div>`;

  return `
  <div class="grid grid-cols-1 gap-4 rounded-xl border border-border bg-white p-5 lg:grid-cols-[1.4fr_1fr_220px] ${featuredBorder}">
    ${col1}
    ${col2}
    ${col3}
  </div>`;
}

function renderSugerenciasPage(): string {
  return `
  <div class="flex flex-col gap-5">
    <div class="flex items-start justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Motor de sugerencias &middot; 11 propuestas activas</p>
        <h1 class="mt-1 text-lg font-semibold text-text-primary">Cursos sugeridos por brecha y mercado</h1>
        <p class="mt-1 text-sm text-text-muted max-w-3xl">Recomendaciones generadas a partir de brechas internas detectadas y comparaci&oacute;n contra est&aacute;ndares del sector automotriz / manufactura.</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button class="${BTN_SECONDARY} !text-xs !px-3 !py-1.5 opacity-60 cursor-not-allowed" disabled><svg class="size-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>Todas las fuentes</button>
        <button class="${BTN_SECONDARY} !text-xs !px-3 !py-1.5 opacity-60 cursor-not-allowed" disabled><svg class="size-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Justificaci&oacute;n PDF</button>
        <button class="${BTN_PRIMARY} !text-xs !px-3 !py-1.5 opacity-60 cursor-not-allowed" disabled>Aprobar selecci&oacute;n</button>
      </div>
    </div>

    ${renderSugKpis()}

    <div class="flex flex-col gap-4">
      ${FAKE_SUGERENCIAS.map(sug => renderSugCard(sug)).join("")}
    </div>
  </div>`;
}

export function mountSugerencias(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Sugerencias",
    activeNav: "sugerencias",
    mainHtml: renderSugerenciasPage(),
  });
}

// ── Encuestas: tipos y datos fake ───────────────────────────────────────────

interface EncuestaCurso {
  id: string;
  nombre: string;
  instructor: string;
  proveedor: string;
  n: number;
  contenido: number;
  instructorScore: number;
  utilidad: number;
  trend: number[];
  score: number;
  warn: boolean;
}

interface EncuestaComentario {
  score: number;
  nombre: string;
  curso: string;
  texto: string;
  sentimiento: "positivo" | "neutro" | "mejora";
}

const FAKE_ENC_CURSOS: EncuestaCurso[] = [
  { id: "CR-101", nombre: "Crimpado manual · Inducción", instructor: "Jorge Salazar", proveedor: "Interno", n: 42, contenido: 4.6, instructorScore: 4.8, utilidad: 4.5, trend: [4.2, 4.4, 4.5, 4.6, 4.6], score: 4.6, warn: false },
  { id: "QA-006", nombre: "IPC-A-620 · Inspección visual", instructor: "Sandra Peña", proveedor: "IPC México", n: 38, contenido: 4.8, instructorScore: 4.7, utilidad: 4.9, trend: [4.5, 4.6, 4.7, 4.7, 4.8], score: 4.8, warn: false },
  { id: "SE-001", nombre: "Seguridad eléctrica LOTO", instructor: "Hugo Cárdenas", proveedor: "Interno", n: 56, contenido: 4.4, instructorScore: 4.3, utilidad: 4.5, trend: [4.1, 4.2, 4.3, 4.3, 4.4], score: 4.4, warn: false },
  { id: "OP-110", nombre: "5S en piso de producción", instructor: "Mariana Cervantes", proveedor: "Interno", n: 48, contenido: 4.9, instructorScore: 4.8, utilidad: 4.7, trend: [4.6, 4.7, 4.8, 4.8, 4.9], score: 4.8, warn: false },
  { id: "CT-021", nombre: "Continuidad eléctrica · básico", instructor: "Patricia Loera", proveedor: "Interno", n: 32, contenido: 4.5, instructorScore: 4.6, utilidad: 4.4, trend: [4.3, 4.4, 4.4, 4.5, 4.5], score: 4.5, warn: false },
  { id: "BL-040", nombre: "Comunicación operativa", instructor: "Ext. · Crehana", proveedor: "Crehana", n: 24, contenido: 3.2, instructorScore: 3.0, utilidad: 3.4, trend: [3.8, 3.6, 3.4, 3.2, 3.2], score: 3.2, warn: true },
  { id: "MT-031", nombre: "Cambio de herramental", instructor: "Rafael Cuevas", proveedor: "Interno", n: 28, contenido: 4.4, instructorScore: 4.5, utilidad: 4.3, trend: [4.2, 4.3, 4.3, 4.4, 4.4], score: 4.4, warn: false },
  { id: "CR-203", nombre: "Crimpado especial · alta corriente", instructor: "Jorge Salazar", proveedor: "Interno", n: 16, contenido: 4.1, instructorScore: 4.3, utilidad: 4.0, trend: [4.0, 4.0, 4.1, 4.1, 4.1], score: 4.2, warn: false },
  { id: "SE-015", nombre: "Manejo de químicos industriales", instructor: "Hugo Cárdenas", proveedor: "Interno", n: 44, contenido: 4.6, instructorScore: 4.4, utilidad: 4.5, trend: [4.3, 4.4, 4.5, 4.5, 4.6], score: 4.5, warn: false },
  { id: "BL-055", nombre: "Liderazgo de equipos operativos", instructor: "Ext. · Crehana", proveedor: "Crehana", n: 18, contenido: 3.1, instructorScore: 2.8, utilidad: 3.3, trend: [3.6, 3.4, 3.2, 3.0, 3.1], score: 3.1, warn: true },
  { id: "QA-310", nombre: "Metrología aplicada a arneses", instructor: "Sandra Peña", proveedor: "Interno", n: 22, contenido: 4.4, instructorScore: 4.5, utilidad: 4.3, trend: [4.2, 4.3, 4.3, 4.4, 4.4], score: 4.4, warn: false },
  { id: "SE-022", nombre: "Primeros auxilios · NOM-030", instructor: "Ext. · Cruz Roja", proveedor: "Cruz Roja", n: 52, contenido: 4.7, instructorScore: 4.8, utilidad: 4.6, trend: [4.5, 4.6, 4.7, 4.7, 4.7], score: 4.7, warn: false },
];

const FAKE_ENC_COMENTARIOS: EncuestaComentario[] = [
  { score: 5, nombre: "María Ortega Reyes", curso: "Crimpado manual", texto: "Excelente curso, aprendí técnicas que aplico diario en la línea. El instructor domina el tema.", sentimiento: "positivo" },
  { score: 5, nombre: "Lucía Mendoza Vargas", curso: "5S en producción", texto: "Muy práctico y dinámico. Las fotos de antes/después en nuestra propia línea hicieron la diferencia.", sentimiento: "positivo" },
  { score: 4, nombre: "Rafael Cuevas Trejo", curso: "IPC-A-620", texto: "Buen contenido técnico, aunque el ritmo fue rápido para quienes no tienen experiencia previa en inspección.", sentimiento: "neutro" },
  { score: 2, nombre: "Adrián Carmona Soto", curso: "Comunicación operativa", texto: "El instructor no conocía nuestro contexto de planta. Los ejemplos eran de oficina, no de piso de producción.", sentimiento: "mejora" },
  { score: 5, nombre: "Patricia Loera Beltrán", curso: "Continuidad eléctrica", texto: "Muy útil la práctica con el equipo real. Ahora puedo diagnosticar fallas sin esperar al técnico.", sentimiento: "positivo" },
  { score: 3, nombre: "Diego Hurtado Vidal", curso: "Liderazgo equipos", texto: "El tema es relevante pero la plataforma en línea tuvo muchos problemas de conexión. Difícil concentrarse.", sentimiento: "mejora" },
];

function encSparkline(values: number[], color: string): string {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 48;
  const h = 20;
  const padding = 2;
  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (w - padding * 2);
    const y = h - padding - ((v - min) / range) * (h - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return `<svg width="${w}" height="${h}" class="shrink-0" aria-hidden="true"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function encScorePill(score: number): string {
  let cls: string;
  if (score >= 4.5) cls = "border-emerald-200 bg-emerald-50 text-emerald-800";
  else if (score >= 4.0) cls = "border-blue-200 bg-blue-50 text-blue-800";
  else if (score >= 3.5) cls = "border-amber-200 bg-amber-50 text-amber-800";
  else cls = "border-red-200 bg-red-50 text-red-800";
  return `<span class="inline-flex items-center gap-1 rounded-full border ${cls} px-2 py-0.5 text-[10px] font-semibold tabular-nums"><svg class="size-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.065 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z"/></svg>${score.toFixed(1)}</span>`;
}

function encHorizBar(value: number, max: number, color: string): string {
  const pct = Math.round((value / max) * 100);
  return `
  <div class="flex items-center gap-1.5">
    <div class="h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
      <div class="h-full rounded-full ${color}" style="width: ${pct}%"></div>
    </div>
    <span class="text-[10px] font-semibold tabular-nums text-slate-600">${value.toFixed(1)}</span>
  </div>`;
}

function renderEncKpis(): string {
  const kpis: Array<{ label: string; value: string; sub: string; sup?: string; isText?: boolean }> = [
    { label: "Encuestas recibidas", value: "612", sub: "Tasa de respuesta 84%" },
    { label: "Score medio", value: "4.4", sup: "/5", sub: "+0.2 vs. trimestre anterior" },
    { label: "NPS interno", value: "+58", sub: "Excelente · ≥ 50" },
    { label: "Cursos en alerta", value: "2", sub: "Score < 3.5 o NPS < 20" },
    { label: "Proveedor mejor calif.", value: "IPC México", sub: "4.7 promedio · 3 cursos", isText: true },
  ];
  return `
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-5">
    ${kpis.map(k => `
      <div class="rounded-xl border border-border bg-white p-4">
        <p class="text-xs font-medium text-text-muted">${escapeHtml(k.label)}</p>
        <p class="mt-1 ${k.isText ? "text-base" : "text-2xl"} font-bold tabular-nums text-text-primary">${k.value}${k.sup ? `<span class="text-sm font-medium text-slate-400">${k.sup}</span>` : ""}</p>
        <p class="mt-0.5 text-[11px] text-slate-500">${escapeHtml(k.sub)}</p>
      </div>
    `).join("")}
  </div>`;
}

function renderEncTabla(): string {
  const rows = FAKE_ENC_CURSOS.map(c => {
    const alertBadge = c.warn ? `<span class="ml-1.5 inline-flex items-center rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-700">Alerta</span>` : "";
    const trendColor = c.warn ? "var(--color-red-500, #ef4444)" : "var(--color-slate-400, #94a3b8)";
    return `
    <tr class="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
      <td class="px-3 py-2.5">
        <div class="flex items-center gap-1.5">
          <span class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-500">${escapeHtml(c.id)}</span>
          <span class="text-xs font-medium text-slate-900 truncate max-w-[180px]">${escapeHtml(c.nombre)}</span>
          ${alertBadge}
        </div>
      </td>
      <td class="px-3 py-2.5 text-xs text-slate-600">${escapeHtml(c.instructor)}</td>
      <td class="px-3 py-2.5 text-center font-mono text-xs font-semibold tabular-nums text-slate-700">${c.n}</td>
      <td class="px-3 py-2.5">${encHorizBar(c.contenido, 5, c.contenido >= 4.0 ? "bg-blue-500" : "bg-red-400")}</td>
      <td class="px-3 py-2.5">${encHorizBar(c.instructorScore, 5, c.instructorScore >= 4.0 ? "bg-blue-500" : "bg-red-400")}</td>
      <td class="px-3 py-2.5">${encHorizBar(c.utilidad, 5, c.utilidad >= 4.0 ? "bg-blue-500" : "bg-red-400")}</td>
      <td class="px-3 py-2.5 text-center">${encSparkline(c.trend, trendColor)}</td>
      <td class="px-3 py-2.5 text-center">${encScorePill(c.score)}</td>
    </tr>`;
  }).join("");

  return `
  <div class="rounded-xl border border-border bg-white flex flex-col overflow-hidden">
    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
      <div>
        <p class="text-sm font-semibold text-text-primary">Score por curso</p>
        <p class="text-[11px] text-slate-500">Promedio &uacute;ltimos 90 d&iacute;as &middot; 218 encuestas activas</p>
      </div>
      <div class="flex items-center gap-1 rounded-lg border border-border bg-slate-50 p-1" role="tablist">
        <button type="button" role="tab" aria-selected="true" class="rounded-md bg-leoni-blue px-3 py-1.5 text-xs font-semibold text-white">Curso</button>
        <button type="button" role="tab" aria-selected="false" class="rounded-md px-3 py-1.5 text-xs font-semibold text-slate-600 opacity-60 cursor-not-allowed" disabled>Instructor</button>
        <button type="button" role="tab" aria-selected="false" class="rounded-md px-3 py-1.5 text-xs font-semibold text-slate-600 opacity-60 cursor-not-allowed" disabled>Proveedor</button>
      </div>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full min-w-[800px] border-collapse text-sm">
        <thead>
          <tr class="border-b border-slate-200 bg-slate-50">
            <th class="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Curso</th>
            <th class="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Instructor</th>
            <th class="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">N</th>
            <th class="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Contenido</th>
            <th class="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Instructor</th>
            <th class="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Utilidad</th>
            <th class="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">Tendencia</th>
            <th class="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">Score</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderEncDistribucion(): string {
  const data = [
    { star: 5, count: 412, pct: 67, color: "bg-emerald-500" },
    { star: 4, count: 128, pct: 21, color: "bg-blue-500" },
    { star: 3, count: 44, pct: 7, color: "bg-amber-400" },
    { star: 2, count: 18, pct: 3, color: "bg-blue-400" },
    { star: 1, count: 10, pct: 2, color: "bg-red-500" },
  ];
  const rows = data.map(d => `
    <div class="flex items-center gap-2.5">
      <span class="w-3 text-right text-xs font-semibold tabular-nums text-slate-700">${d.star}</span>
      <svg class="size-3.5 text-amber-400 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.065 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z"/></svg>
      <div class="h-2.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
        <div class="h-full rounded-full ${d.color}" style="width: ${d.pct}%"></div>
      </div>
      <span class="w-8 text-right font-mono text-[11px] font-semibold tabular-nums text-slate-700">${d.count}</span>
      <span class="w-8 text-right text-[11px] text-slate-500 tabular-nums">${d.pct}%</span>
    </div>
  `).join("");

  return `
  <div class="rounded-xl border border-border bg-white p-5 flex flex-col gap-4">
    <div>
      <p class="text-sm font-semibold text-text-primary">Distribuci&oacute;n de respuestas</p>
      <p class="text-[11px] text-slate-500">Escala 1 a 5 &middot; 612 encuestas</p>
    </div>
    <div class="flex flex-col gap-2.5">
      ${rows}
    </div>
  </div>`;
}

function renderEncComentarios(): string {
  const sentColors: Record<string, string> = {
    positivo: "border-l-emerald-400",
    neutro: "border-l-amber-400",
    mejora: "border-l-blue-400",
  };
  const items = FAKE_ENC_COMENTARIOS.map(c => {
    const cursoPill = `<span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">${escapeHtml(c.curso)}</span>`;
    return `
    <div class="border-l-[3px] ${sentColors[c.sentimiento]} rounded-r-lg bg-slate-50 px-3 py-2.5">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-[11px] font-semibold text-amber-500">&starf; ${c.score}</span>
        <span class="text-[11px] font-medium text-slate-700">${escapeHtml(c.nombre)}</span>
        ${cursoPill}
      </div>
      <p class="mt-1.5 text-xs italic text-slate-600 leading-relaxed">&ldquo;${escapeHtml(c.texto)}&rdquo;</p>
    </div>`;
  }).join("");

  return `
  <div class="rounded-xl border border-border bg-white p-5 flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-semibold text-text-primary">Comentarios destacados</p>
        <p class="text-[11px] text-slate-500">Filtrados por sentimiento y curso</p>
      </div>
      <button class="text-xs font-medium text-blue-600 hover:text-blue-800 transition opacity-60 cursor-not-allowed" disabled>Ver todos &rsaquo;</button>
    </div>
    <div class="flex flex-col gap-2.5">
      ${items}
    </div>
  </div>`;
}

function renderEncuestasPage(): string {
  return `
  <div class="flex flex-col gap-5">
    <div class="flex items-start justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Encuestas &middot; &Uacute;ltimos 90 d&iacute;as</p>
        <h1 class="mt-1 text-lg font-semibold text-text-primary">Resultados post curso</h1>
        <p class="mt-1 text-sm text-text-muted max-w-3xl">Score consolidado por curso, instructor y proveedor; insumo para la mejora continua de la oferta formativa de la planta.</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button class="${BTN_SECONDARY} !text-xs !px-3 !py-1.5 opacity-60 cursor-not-allowed" disabled><svg class="size-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>Q2 2026</button>
        <button class="${BTN_SECONDARY} !text-xs !px-3 !py-1.5 opacity-60 cursor-not-allowed" disabled><svg class="size-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Reporte ejecutivo</button>
      </div>
    </div>

    ${renderEncKpis()}

    <div class="grid grid-cols-1 gap-5 lg:grid-cols-[1.55fr_1fr]">
      ${renderEncTabla()}
      <div class="flex flex-col gap-5">
        ${renderEncDistribucion()}
        ${renderEncComentarios()}
      </div>
    </div>
  </div>`;
}

export function mountEncuestas(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Encuestas Post Curso",
    activeNav: "encuestas",
    mainHtml: renderEncuestasPage(),
  });
}

import { mountAppShell } from "../layouts/appShell.ts";
import { renderLevelUpBackBar } from "../navigation/levelUpBackLink.ts";
import { schedulePageScrollReset } from "../navigation/resetPageScroll.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import { BTN_PRIMARY, BTN_SECONDARY, FIELD_FOCUS, SELECT_CHEVRON } from "../ui/uiTokens.ts";
import { getCursos, getCursoById, createCurso, updateCurso, deleteCurso, getCursoPuestos, getCursoEmpleadosExtra, getCursoSesiones, createCursoSesion, deleteCursoSesion, getSesionEmpleados, inscribirEmpleadoSesion, quitarEmpleadoSesion, getSesionEmpleadosElegibles } from "../api/cursos.ts";
import type { CursoPuestoDetail, CursoEmpleadoDetail, EmpleadoElegible } from "../api/cursos.ts";
import type { Curso, CursoListResponse, CursoCreatePayload, CursoSesion, CursoSesionCreatePayload, SesionEmpleadoItem } from "../dashboard/cursos/types.ts";
import { TIPO_LABELS, CLASIFICACION_LABELS, CATEGORIA_LABELS, ESTADO_SESION_LABELS } from "../dashboard/cursos/types.ts";
import { getRolFromAccessToken } from "../auth/jwt.ts";
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
    ${renderLevelUpBackBar()}
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
    pageTitle: "Resumen operativo Level Up",
    activeNav: "level-up",
    mainHtml: renderDashboardPage(),
  });
}

export function mountCursos(container: HTMLElement): void {
  const isRH = getRolFromAccessToken() === "rh";

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
    detailSesiones: CursoSesion[];
    showCreateSesionModal: boolean;
    viewingSesion: CursoSesion | null;
    sesionEmpleados: SesionEmpleadoItem[];
    selectedEmpleados: Set<number>;
    showAssignSesionPicker: boolean;
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
    detailSesiones: [],
    showCreateSesionModal: false,
    viewingSesion: null,
    sesionEmpleados: [],
    selectedEmpleados: new Set(),
    showAssignSesionPicker: false,
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

  function renderCursosKpis(): string {
    const total = state.cursos.total;
    const items = state.cursos.items;
    const obligatorios = items.filter(c => c.obligatorio).length;
    const internos = items.filter(c => c.tipo === "interno").length;
    const externos = items.filter(c => c.tipo === "externo").length;
    return `
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div class="rounded-xl border border-border bg-white p-4 shadow-sm">
        <p class="text-xs font-medium text-text-muted">Total catálogo</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-text-primary">${total}</p>
      </div>
      <div class="rounded-xl border border-border bg-white p-4 shadow-sm">
        <p class="text-xs font-medium text-text-muted">Obligatorios</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-blue-600">${obligatorios}</p>
      </div>
      <div class="rounded-xl border border-border bg-white p-4 shadow-sm">
        <p class="text-xs font-medium text-text-muted">Internos</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-emerald-600">${internos}</p>
      </div>
      <div class="rounded-xl border border-border bg-white p-4 shadow-sm">
        <p class="text-xs font-medium text-text-muted">Externos</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-purple-600">${externos}</p>
      </div>
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
      : `${total} cursos en catálogo`;

    return `
    <section class="rounded-2xl border border-border bg-white p-5 shadow-sm" aria-label="Filtros de cursos">
      <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-sm font-semibold text-text-primary">Buscar y filtrar</h2>
          <p class="mt-0.5 text-xs text-text-muted">Localiza cursos por nombre, tipo, categoría o clasificación.</p>
        </div>
        <p class="text-xs text-text-muted" aria-live="polite">${resultsLine}</p>
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <div class="min-w-0 sm:col-span-2 lg:col-span-1">
          <label class="mb-1 block text-xs font-medium text-slate-600">Buscar</label>
          <div class="relative">
            <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400"><svg class="size-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg></span>
            <input data-action="cursos-search" type="search" autocomplete="off" placeholder="Nombre del curso…" value="${escapeHtml(state.filters.busqueda)}" class="block w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-text-primary shadow-sm placeholder:text-text-muted ${FIELD_FOCUS}" />
          </div>
        </div>
        <div class="min-w-0">
          <label class="mb-1 block text-xs font-medium text-slate-600">Tipo</label>
          <div class="grid grid-cols-1">
            <select data-action="cursos-filter-tipo" class="col-start-1 row-start-1 w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-8 text-sm shadow-sm appearance-none ${FIELD_FOCUS}">
              <option value="">Todos los tipos</option>
              <option value="interno" ${state.filters.tipo === "interno" ? "selected" : ""}>Interno</option>
              <option value="externo" ${state.filters.tipo === "externo" ? "selected" : ""}>Externo</option>
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
        <div class="min-w-0">
          <label class="mb-1 block text-xs font-medium text-slate-600">Clasificación</label>
          <div class="grid grid-cols-1">
            <select data-action="cursos-filter-clasificacion" class="col-start-1 row-start-1 w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-8 text-sm shadow-sm appearance-none ${FIELD_FOCUS}">
              <option value="">Todas</option>
              <option value="adicional" ${state.filters.clasificacion === "adicional" ? "selected" : ""}>Adicional</option>
              <option value="contemplado" ${state.filters.clasificacion === "contemplado" ? "selected" : ""}>Contemplado</option>
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
        <div class="min-w-0">
          <label class="mb-1 block text-xs font-medium text-slate-600">Categoría</label>
          <div class="grid grid-cols-1">
            <select data-action="cursos-filter-categoria" class="col-start-1 row-start-1 w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-8 text-sm shadow-sm appearance-none ${FIELD_FOCUS}">
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
        <div class="min-w-0">
          <label class="mb-1 block text-xs font-medium text-slate-600">Obligatorio</label>
          <div class="grid grid-cols-1">
            <select data-action="cursos-filter-obligatorio" class="col-start-1 row-start-1 w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-8 text-sm shadow-sm appearance-none ${FIELD_FOCUS}">
              <option value="">Todos</option>
              <option value="true" ${state.filters.obligatorio === "true" ? "selected" : ""}>Sí</option>
              <option value="false" ${state.filters.obligatorio === "false" ? "selected" : ""}>No</option>
            </select>
            ${SELECT_CHEVRON}
          </div>
        </div>
      </div>
      ${hasFilters ? `
      <div class="mt-4 flex items-center gap-3 border-t border-slate-100 pt-3">
        <button type="button" data-action="cursos-clear-filters" class="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition">
          <svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          Limpiar filtros
        </button>
      </div>` : ""}
    </section>`;
  }

  function renderCursoCard(c: Curso): string {
    const horas = c.duracion_horas != null ? `${c.duracion_horas}h` : "—";
    return `
    <div class="flex flex-col gap-3 rounded-xl border border-border bg-white p-4 shadow-sm transition hover:shadow-md">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 flex-wrap">
          ${cursoCatBadge(c.categoria)}
          ${c.obligatorio ? `<span class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">Obligatorio</span>` : ""}
        </div>
        ${cursoTipoBadge(c.tipo)}
      </div>
      <div>
        <button data-action="view-curso" data-id="${c.id}" class="text-left text-sm font-semibold leading-tight text-text-primary line-clamp-2 hover:text-blue-600 hover:underline transition">${escapeHtml(c.nombre)}</button>
        <p class="mt-1 text-xs text-text-muted">${escapeHtml(c.proveedor ?? "—")} · ${horas}${c.cupo_max ? ` · cupo ${c.cupo_max}` : ""}</p>
      </div>
      ${c.instructor ? `
      <div class="flex items-center gap-2">
        <span class="flex size-6 items-center justify-center rounded-full bg-leoni-blue text-[10px] font-bold text-white">${c.instructor.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}</span>
        <span class="text-xs text-slate-600">${escapeHtml(c.instructor)}</span>
      </div>` : ""}
      <div class="mt-auto border-t border-slate-100 pt-3 flex items-center justify-between text-[11px]">
        <span class="text-slate-500">${CLASIFICACION_LABELS[c.clasificacion ?? ""] ?? "—"}</span>
        ${isRH ? `
        <div class="flex items-center gap-2">
          <button data-action="edit-curso" data-id="${c.id}" class="text-xs font-medium text-blue-600 hover:text-blue-800">Editar</button>
          <button data-action="delete-curso" data-id="${c.id}" class="text-xs font-medium text-red-600 hover:text-red-800">Eliminar</button>
        </div>` : ""}
      </div>
    </div>`;
  }

  function renderPagination(): string {
    const totalPages = Math.ceil(state.cursos.total / 20);
    if (totalPages <= 1) return "";
    return `
    <div class="flex items-center justify-between mt-4 text-sm text-gray-600">
      <span>Página ${state.page} de ${totalPages} (${state.cursos.total} cursos)</span>
      <div class="flex gap-2">
        <button data-action="cursos-prev" ${state.page <= 1 ? "disabled" : ""} class="rounded border px-3 py-1 disabled:opacity-40 ${BTN_SECONDARY}">Anterior</button>
        <button data-action="cursos-next" ${state.page >= totalPages ? "disabled" : ""} class="rounded border px-3 py-1 disabled:opacity-40 ${BTN_SECONDARY}">Siguiente</button>
      </div>
    </div>`;
  }

  function renderCreateEditModal(): string {
    const c = state.editingCurso;
    const title = c ? "Editar Curso" : "Nuevo Curso";
    return `
    <div id="curso-modal-backdrop" data-action="close-curso-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div data-modal-inner class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">${title}</h2>
        <form data-action="submit-curso" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input type="text" name="nombre" required value="${escapeHtml(c?.nombre ?? "")}" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm ${FIELD_FOCUS}" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select name="tipo" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="">—</option>
                <option value="interno" ${c?.tipo === "interno" ? "selected" : ""}>Interno</option>
                <option value="externo" ${c?.tipo === "externo" ? "selected" : ""}>Externo</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Clasificación</label>
              <select name="clasificacion" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="">—</option>
                <option value="adicional" ${c?.clasificacion === "adicional" ? "selected" : ""}>Adicional</option>
                <option value="contemplado" ${c?.clasificacion === "contemplado" ? "selected" : ""}>Contemplado</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Duración (horas)</label>
              <input type="number" name="duracion_horas" step="0.5" min="0.5" value="${c?.duracion_horas ?? ""}" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm ${FIELD_FOCUS}" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
              <select name="categoria" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="">—</option>
                <option value="tecnico" ${c?.categoria === "tecnico" ? "selected" : ""}>Técnico</option>
                <option value="calidad" ${c?.categoria === "calidad" ? "selected" : ""}>Calidad</option>
                <option value="seguridad" ${c?.categoria === "seguridad" ? "selected" : ""}>Seguridad</option>
                <option value="operativo" ${c?.categoria === "operativo" ? "selected" : ""}>Operativo</option>
                <option value="blanda" ${c?.categoria === "blanda" ? "selected" : ""}>Blanda</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
              <input type="text" name="proveedor" value="${escapeHtml(c?.proveedor ?? "")}" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm ${FIELD_FOCUS}" />
            </div>
            <div class="relative">
              <label class="block text-sm font-medium text-gray-700 mb-1">Instructor</label>
              <input type="hidden" name="instructor" value="${escapeHtml(c?.instructor ?? "")}" />
              <input type="text" data-action="instructor-search" placeholder="Buscar empleado..." value="${escapeHtml(c?.instructor ?? "")}" autocomplete="off" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm ${FIELD_FOCUS}" />
              <div data-ref="instructor-dropdown" class="absolute z-20 mt-1 hidden w-full max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg"></div>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Centro de costos</label>
            <input type="number" name="centro_costos" value="${c?.centro_costos ?? ""}" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm ${FIELD_FOCUS}" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea name="descripcion" rows="3" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm ${FIELD_FOCUS}">${escapeHtml(c?.descripcion ?? "")}</textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Requisitos</label>
            <textarea name="requisitos" rows="3" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm ${FIELD_FOCUS}">${escapeHtml(c?.requisitos ?? "")}</textarea>
          </div>
          <div class="flex items-center gap-2">
            <input type="checkbox" name="obligatorio" id="curso-obligatorio" ${c?.obligatorio ? "checked" : ""} class="rounded border-gray-300" />
            <label for="curso-obligatorio" class="text-sm text-gray-700">Obligatorio</label>
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <button type="button" data-action="close-curso-modal" class="${BTN_SECONDARY}">Cancelar</button>
            <button type="submit" class="${BTN_PRIMARY}">${c ? "Guardar cambios" : "Crear"}</button>
          </div>
        </form>
      </div>
    </div>`;
  }

  function renderDetailPuestos(): string {
    const puestos = state.detailPuestos;
    if (puestos.length === 0) {
      return `
      <div class="rounded-2xl border border-border bg-white shadow-sm p-6">
        <h3 class="text-sm font-semibold text-text-primary mb-2">Puestos asignados</h3>
        <p class="text-xs text-slate-400 italic">Sin puestos asignados a este curso.</p>
      </div>`;
    }
    const totalEmps = puestos.reduce((s, p) => s + p.empleados_count, 0);
    const hasSesiones = state.detailSesiones.length > 0;

    const puestoBlocks = puestos.map(p => {
      const puestoEmpIds = p.empleados.map(e => e.empleado_id);
      const allSelected = puestoEmpIds.length > 0 && puestoEmpIds.every(id => state.selectedEmpleados.has(id));

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
        <div class="flex items-center justify-between px-5 py-3 bg-slate-50/50">
          <div class="flex items-center gap-2">
            ${hasSesiones && isRH && puestoEmpIds.length > 0 ? `<input type="checkbox" data-action="toggle-puesto" data-puesto-emps='${JSON.stringify(puestoEmpIds)}' ${allSelected ? "checked" : ""} class="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />` : ""}
            <a href="#/puestos/${p.puesto_perfil_id}" class="text-sm font-semibold text-leoni-blue hover:underline">${escapeHtml(p.puesto_nombre ?? `Puesto #${p.puesto_perfil_id}`)}</a>
            ${p.puesto_codigo ? `<span class="text-xs text-slate-400">${escapeHtml(p.puesto_codigo)}</span>` : ""}
            ${p.obligatorio ? `<span class="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200/70">Obligatorio</span>` : ""}
          </div>
          <span class="text-xs text-slate-500 tabular-nums">${p.empleados_count} empleado${p.empleados_count !== 1 ? "s" : ""}</span>
        </div>
        <ul class="px-5 py-2">${empRows}</ul>
      </div>`;
    }).join("");

    return `
    <div class="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
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
      <div class="rounded-2xl border border-border bg-white shadow-sm p-6">
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
    <div class="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
      <div class="border-b border-slate-100 px-6 py-4">
        <h3 class="text-sm font-semibold text-text-primary">Empleados extra (individuales)</h3>
        <p class="text-xs text-slate-500 mt-0.5">${emps.length} empleado${emps.length !== 1 ? "s" : ""} asignado${emps.length !== 1 ? "s" : ""} directamente</p>
      </div>
      <table class="w-full text-left">
        <thead class="bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            ${hasSesiones && isRH ? `<th class="px-4 py-2.5 w-10"><input type="checkbox" data-action="toggle-all-extras" data-extra-emps='${JSON.stringify(allExtraIds)}' ${allSelected ? "checked" : ""} class="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" /></th>` : ""}
            <th class="px-4 py-2.5">Empleado</th>
            <th class="px-4 py-2.5">No. Empleado</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
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
    <div class="flex flex-col gap-5">
      ${renderLevelUpBackBar()}
      <div class="flex items-center gap-3">
        <h2 class="text-lg font-bold text-text-primary truncate">${escapeHtml(c.nombre)}</h2>
      </div>

      <div class="rounded-2xl border border-border bg-white shadow-sm">
        <div class="flex flex-wrap items-center gap-3 border-b border-slate-100 px-6 py-4">
          ${cursoCatBadge(c.categoria)}
          ${c.obligatorio ? `<span class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">Obligatorio</span>` : ""}
          ${cursoTipoBadge(c.tipo)}
          <span class="ml-auto text-xs text-slate-500">ID: ${c.id}</span>
        </div>

        <div class="p-6">
          <dl class="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
            ${field("Nombre", c.nombre)}
            ${field("Categoría", CATEGORIA_LABELS[c.categoria ?? ""] ?? c.categoria)}
            ${field("Tipo", TIPO_LABELS[c.tipo ?? ""] ?? c.tipo)}
            ${field("Clasificación", CLASIFICACION_LABELS[c.clasificacion ?? ""] ?? c.clasificacion)}
            ${field("Instructor", c.instructor)}
            ${field("Proveedor", c.proveedor)}
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
      ${renderDetailPuestos()}
      ${renderDetailEmpleadosExtra()}
      ${renderSelectionBar()}
      ${state.showAssignSesionPicker ? renderAssignSesionPicker() : ""}
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
            const cupo = s.cupo_max ? ` (${s.inscritos_count}/${s.cupo_max})` : "";
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
      <div class="rounded-2xl border border-border bg-white shadow-sm p-6">
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
      const cupo = s.cupo_max ? `${s.inscritos_count}/${s.cupo_max}` : `${s.inscritos_count}`;
      return `
      <tr class="border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer transition-colors" data-action="go-sesion-detail" data-curso-id="${cursoId}" data-sesion-id="${s.id}">
        <td class="px-4 py-2.5 text-sm font-medium text-text-primary">${escapeHtml(fecha)}</td>
        <td class="px-4 py-2.5 text-sm text-slate-600">${escapeHtml(horario)}</td>
        <td class="px-4 py-2.5 text-sm text-slate-600">${escapeHtml(s.ubicacion ?? "—")}</td>
        <td class="px-4 py-2.5 text-sm text-slate-600">${escapeHtml(s.instructor ?? "—")}</td>
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
    <div class="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
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
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Ubicación</label>
            <input type="text" name="ubicacion" class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm ${FIELD_FOCUS}" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Instructor</label>
            <input type="text" name="instructor" class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm ${FIELD_FOCUS}" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Cupo máximo</label>
            <input type="number" name="cupo_max" min="1" class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm ${FIELD_FOCUS}" />
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
      ? "rounded-md bg-leoni-blue px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
      : "rounded-md px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer";
    return `
    <div class="inline-flex items-center gap-1 rounded-lg border border-border bg-slate-50 p-1" role="group" aria-label="Modo de vista">
      <button type="button" data-action="view-tarjetas" class="${btnCls(state.viewMode === "tarjetas")}">Tarjetas</button>
      <button type="button" data-action="view-tabla" class="${btnCls(state.viewMode === "tabla")}">Tabla</button>
    </div>`;
  }

  function renderCursosTable(): string {
    const items = state.cursos.items;
    if (items.length === 0) {
      return `<p class="py-10 text-center text-sm text-slate-500">No se encontraron cursos con los filtros actuales.</p>`;
    }
    return `
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-4 py-3">Nombre</th>
            <th class="px-4 py-3">Categoría</th>
            <th class="px-4 py-3">Tipo</th>
            <th class="px-4 py-3">Clasificación</th>
            <th class="px-4 py-3">Instructor</th>
            <th class="px-4 py-3">Horas</th>
            <th class="px-4 py-3">Modalidad</th>
            <th class="px-4 py-3">Obligatorio</th>
            ${isRH ? `<th class="px-4 py-3 text-right">Acciones</th>` : ""}
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${items.map(c => `
          <tr class="hover:bg-slate-50/60 transition">
            <td class="px-4 py-3 font-medium max-w-[280px] truncate"><button data-action="view-curso" data-id="${c.id}" class="text-left text-text-primary hover:text-blue-600 hover:underline transition">${escapeHtml(c.nombre)}</button></td>
            <td class="px-4 py-3">${c.categoria ? cursoCatBadge(c.categoria) : `<span class="text-slate-400">—</span>`}</td>
            <td class="px-4 py-3 text-slate-600">${c.tipo ? escapeHtml(TIPO_LABELS[c.tipo] ?? c.tipo) : "—"}</td>
            <td class="px-4 py-3 text-slate-600">${c.clasificacion ? escapeHtml(CLASIFICACION_LABELS[c.clasificacion] ?? c.clasificacion) : "—"}</td>
            <td class="px-4 py-3 text-slate-600 max-w-[180px] truncate">${c.instructor ? escapeHtml(c.instructor) : "—"}</td>
            <td class="px-4 py-3 tabular-nums text-slate-600">${c.duracion_horas ?? "—"}</td>
            <td class="px-4 py-3 text-slate-600">${c.modalidad ? escapeHtml(c.modalidad) : "—"}</td>
            <td class="px-4 py-3">${c.obligatorio
              ? `<span class="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700">Sí</span>`
              : `<span class="text-slate-400">No</span>`}</td>
            ${isRH ? `<td class="px-4 py-3 text-right">
              <button data-action="edit-curso" data-id="${c.id}" class="text-blue-600 hover:text-blue-800 text-xs font-medium mr-2">Editar</button>
              <button data-action="delete-curso" data-id="${c.id}" class="text-red-500 hover:text-red-700 text-xs font-medium">Eliminar</button>
            </td>` : ""}
          </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
  }

  function renderPage(): string {
    const items = state.cursos.items;

    const content = state.loading
      ? `<p class="py-10 text-center text-sm text-slate-500">Cargando...</p>`
      : state.viewMode === "tabla"
        ? renderCursosTable()
        : items.length === 0
          ? `<p class="col-span-full py-10 text-center text-sm text-slate-500">No se encontraron cursos con los filtros actuales.</p>`
          : `<div class="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">${items.map(c => renderCursoCard(c)).join("")}</div>`;

    return `
    <div class="flex flex-col gap-5">
      ${renderLevelUpBackBar()}
      ${renderFilterSection()}
      ${renderCursosKpis()}
      <div class="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          ${renderViewToggle()}
          ${isRH ? `<button data-action="open-create-curso" class="${BTN_PRIMARY}">
            <svg class="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" /></svg>
            Nuevo curso
          </button>` : ""}
        </div>
        ${content}
        ${!state.loading ? `<div class="px-5 pb-4">${renderPagination()}</div>` : ""}
      </div>
    </div>`;
  }

  function render(): void {
    mountAppShell(container, {
      pageTitle: "Manejo de Cursos",
      activeNav: "cursos",
      mainHtml: (state.detailCurso ? renderDetailView() : renderPage()) + (state.showCreateModal || state.editingCurso ? renderCreateEditModal() : ""),
    });
  }

  function navigateToDetail(curso: Curso): void {
    state.detailCurso = curso;
    state.detailPuestos = [];
    state.detailEmpleadosExtra = [];
    state.detailSesiones = [];
    state.selectedEmpleados = new Set();
    history.replaceState(null, "", `#/cursos/${curso.id}`);
    render();
    schedulePageScrollReset();
    Promise.all([getCursoPuestos(curso.id), getCursoEmpleadosExtra(curso.id), getCursoSesiones(curso.id)])
      .then(([puestos, empExtra, sesionesResp]) => {
        state.detailPuestos = puestos;
        state.detailEmpleadosExtra = empExtra;
        state.detailSesiones = sesionesResp.items;
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
      state.showCreateModal = true;
      state.editingCurso = null;
      render();
      return;
    }

    const closeBtn = t.closest<HTMLElement>("[data-action='close-curso-modal']");
    if (closeBtn) {
      if (!(closeBtn.id === "curso-modal-backdrop" && t.closest("[data-modal-inner]"))) {
        state.showCreateModal = false;
        state.editingCurso = null;
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
        state.editingCurso = curso;
        state.showCreateModal = false;
        render();
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

    if (t.closest("[data-action='cursos-next']")) {
      state.page++;
      state.loading = true;
      render();
      await loadCursos();
      state.loading = false;
      render();
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
      const fd = new FormData(form);
      const payload: CursoSesionCreatePayload = {
        fecha_inicio: fd.get("fecha_inicio") as string,
        fecha_fin: (fd.get("fecha_fin") as string) || undefined,
        hora_inicio: (fd.get("hora_inicio") as string) || undefined,
        hora_fin: (fd.get("hora_fin") as string) || undefined,
        ubicacion: (fd.get("ubicacion") as string) || undefined,
        instructor: (fd.get("instructor") as string) || undefined,
        cupo_max: fd.get("cupo_max") ? Number(fd.get("cupo_max")) : undefined,
        notas: (fd.get("notas") as string) || undefined,
      };
      if (!payload.fecha_inicio) return;
      try {
        await createCursoSesion(cursoId, payload);
        state.showCreateSesionModal = false;
        const resp = await getCursoSesiones(cursoId);
        state.detailSesiones = resp.items;
        render();
      } catch (err: any) {
        alert(err?.detail ?? "Error al crear la sesión");
      }
      return;
    }

    // ── Create/Edit Curso form ──
    if (!form.matches("[data-action='submit-curso']")) return;
    e.preventDefault();

    const fd = new FormData(form);
    const payload: CursoCreatePayload = {
      nombre: fd.get("nombre") as string,
      tipo: (fd.get("tipo") as string as CursoCreatePayload["tipo"]) || undefined,
      clasificacion: (fd.get("clasificacion") as string as CursoCreatePayload["clasificacion"]) || undefined,
      duracion_horas: fd.get("duracion_horas") ? Number(fd.get("duracion_horas")) : undefined,
      categoria: (fd.get("categoria") as string as CursoCreatePayload["categoria"]) || undefined,
      proveedor: (fd.get("proveedor") as string) || undefined,
      instructor: (fd.get("instructor") as string) || undefined,
      obligatorio: form.querySelector<HTMLInputElement>("[name='obligatorio']")?.checked ?? false,
      descripcion: (fd.get("descripcion") as string) || undefined,
      requisitos: (fd.get("requisitos") as string) || undefined,
      centro_costos: fd.get("centro_costos") ? Number(fd.get("centro_costos")) : undefined,
    };

    if (!payload.nombre) return;

    try {
      if (state.editingCurso) {
        await updateCurso(state.editingCurso.id, payload);
      } else {
        await createCurso(payload);
      }
      state.showCreateModal = false;
      state.editingCurso = null;
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
      state.showCreateModal = false;
      state.editingCurso = null;
      render();
    }
  }

  render();
  container.addEventListener("click", handleClick);
  container.addEventListener("change", handleChange);
  container.addEventListener("input", handleInput);
  container.addEventListener("submit", handleSubmit);
  document.addEventListener("keydown", handleKeydown);

  (async () => {
    await loadCursos();
    state.loading = false;
    render();

    const hashMatch = location.hash.match(/^#\/cursos\/(\d+)$/);
    if (hashMatch) {
      const cursoId = Number(hashMatch[1]);
      try {
        const curso = await getCursoById(cursoId);
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
    ${renderLevelUpBackBar()}
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
    ${renderLevelUpBackBar()}
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
    ${renderLevelUpBackBar()}
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
    ${renderLevelUpBackBar()}
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

import { mountAppShell } from "../layouts/appShell.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import { BTN_PRIMARY, BTN_SECONDARY } from "../ui/uiTokens.ts";

function levelUpStub(title: string, subtitle: string): string {
  return `
    <div class="rounded-lg border border-border bg-white px-6 py-10 shadow-sm">
      <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Level Up</p>
      <h1 class="mt-1 text-lg font-semibold text-text-primary">${title}</h1>
      <p class="mt-2 text-sm text-text-muted">${subtitle}</p>
    </div>`;
}

// ── Cursos: tipos y datos fake ───────────────────────────────────────────

type CursoCat = "Técnico" | "Calidad" | "Seguridad" | "Operativo" | "Blanda";

interface CursoItem {
  id: string;
  nombre: string;
  cat: CursoCat;
  instructor: string;
  proveedor: string;
  duracion: string;
  cupo: number;
  score: number;
  sesiones: number;
  asignados: number;
  obligatorio: boolean;
}

const FAKE_CURSOS: CursoItem[] = [
  { id: "CR-101", nombre: "Crimpado manual · Inducción", cat: "Técnico", instructor: "Jorge Salazar", proveedor: "Interno", duracion: "4h", cupo: 12, score: 4.6, sesiones: 12, asignados: 48, obligatorio: true },
  { id: "CR-102", nombre: "Crimpado automatizado · Nivel 2", cat: "Técnico", instructor: "Jorge Salazar", proveedor: "Interno", duracion: "8h", cupo: 8, score: 4.4, sesiones: 8, asignados: 36, obligatorio: true },
  { id: "QA-006", nombre: "IPC-A-620 · Inspección visual", cat: "Calidad", instructor: "Sandra Peña", proveedor: "IPC México", duracion: "24h", cupo: 12, score: 4.7, sesiones: 4, asignados: 62, obligatorio: true },
  { id: "SE-001", nombre: "Seguridad eléctrica LOTO", cat: "Seguridad", instructor: "Hugo Cárdenas", proveedor: "Interno", duracion: "4h", cupo: 20, score: 4.3, sesiones: 16, asignados: 214, obligatorio: true },
  { id: "CT-021", nombre: "Continuidad eléctrica · básico", cat: "Técnico", instructor: "Patricia Loera", proveedor: "Interno", duracion: "6h", cupo: 10, score: 4.5, sesiones: 6, asignados: 84, obligatorio: true },
  { id: "OP-110", nombre: "5S en piso de producción", cat: "Operativo", instructor: "Mariana Cervantes", proveedor: "Interno", duracion: "2h", cupo: 25, score: 4.8, sesiones: 18, asignados: 214, obligatorio: true },
  { id: "QA-201", nombre: "IPC/WHMA-A-620 Rev.D · 2026", cat: "Calidad", instructor: "Externo · IPC", proveedor: "IPC México", duracion: "32h", cupo: 8, score: 4.6, sesiones: 1, asignados: 14, obligatorio: false },
  { id: "BL-040", nombre: "Comunicación operativa", cat: "Blanda", instructor: "Externo · Crehana", proveedor: "Crehana", duracion: "4h", cupo: 40, score: 4.1, sesiones: 2, asignados: 56, obligatorio: false },
  { id: "MT-031", nombre: "Cambio de herramental", cat: "Técnico", instructor: "Rafael Cuevas", proveedor: "Interno", duracion: "6h", cupo: 8, score: 4.4, sesiones: 8, asignados: 32, obligatorio: true },
  { id: "CR-203", nombre: "Crimpado especial · alta corriente", cat: "Técnico", instructor: "Jorge Salazar", proveedor: "Interno", duracion: "12h", cupo: 6, score: 4.2, sesiones: 3, asignados: 18, obligatorio: false },
  { id: "SE-015", nombre: "Manejo de químicos industriales", cat: "Seguridad", instructor: "Hugo Cárdenas", proveedor: "Interno", duracion: "3h", cupo: 30, score: 4.5, sesiones: 6, asignados: 120, obligatorio: true },
  { id: "OP-205", nombre: "Gestión visual de indicadores", cat: "Operativo", instructor: "Mariana Cervantes", proveedor: "Interno", duracion: "3h", cupo: 20, score: 4.3, sesiones: 4, asignados: 42, obligatorio: false },
  { id: "BL-055", nombre: "Liderazgo de equipos operativos", cat: "Blanda", instructor: "Externo · Crehana", proveedor: "Crehana", duracion: "6h", cupo: 20, score: 4.0, sesiones: 2, asignados: 24, obligatorio: false },
  { id: "QA-310", nombre: "Metrología aplicada a arneses", cat: "Calidad", instructor: "Sandra Peña", proveedor: "Interno", duracion: "8h", cupo: 10, score: 4.4, sesiones: 3, asignados: 28, obligatorio: true },
  { id: "SE-022", nombre: "Primeros auxilios · NOM-030", cat: "Seguridad", instructor: "Externo · Cruz Roja", proveedor: "Cruz Roja", duracion: "8h", cupo: 25, score: 4.7, sesiones: 2, asignados: 180, obligatorio: true },
];

const CURSOS_CATS: Array<"Todos" | CursoCat> = ["Todos", "Técnico", "Calidad", "Seguridad", "Operativo", "Blanda"];

function catBadge(cat: CursoCat): string {
  const colors: Record<CursoCat, { border: string; bg: string; text: string; dot: string }> = {
    "Técnico":   { border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-800", dot: "bg-blue-500" },
    "Calidad":   { border: "border-sky-200", bg: "bg-sky-50", text: "text-sky-800", dot: "bg-sky-500" },
    "Seguridad": { border: "border-red-200", bg: "bg-red-50", text: "text-red-800", dot: "bg-red-400" },
    "Operativo": { border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-800", dot: "bg-amber-400" },
    "Blanda":    { border: "border-violet-200", bg: "bg-violet-50", text: "text-violet-800", dot: "bg-violet-500" },
  };
  const c = colors[cat];
  return `<span class="inline-flex items-center gap-1.5 rounded-full border ${c.border} ${c.bg} px-2 py-0.5 text-[11px] font-semibold ${c.text}"><span class="size-1.5 shrink-0 rounded-full ${c.dot}" aria-hidden="true"></span>${escapeHtml(cat)}</span>`;
}

function starRating(score: number): string {
  const full = Math.floor(score);
  const half = score - full >= 0.3;
  const stars: string[] = [];
  for (let i = 0; i < full; i++) {
    stars.push(`<svg class="size-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.065 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z"/></svg>`);
  }
  if (half) {
    stars.push(`<svg class="size-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><defs><linearGradient id="halfGrad"><stop offset="50%" stop-color="currentColor"/><stop offset="50%" stop-color="#e5e7eb"/></linearGradient></defs><path fill="url(#halfGrad)" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.065 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z"/></svg>`);
  }
  const empty = 5 - full - (half ? 1 : 0);
  for (let i = 0; i < empty; i++) {
    stars.push(`<svg class="size-3.5 text-slate-200" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.065 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z"/></svg>`);
  }
  return `<span class="inline-flex items-center gap-0.5">${stars.join("")}<span class="ml-1 text-xs font-semibold tabular-nums text-slate-700">${score.toFixed(1)}</span></span>`;
}

function renderCursosKpis(): string {
  const totalCursos = FAKE_CURSOS.length;
  const totalSesiones = FAKE_CURSOS.reduce((s, c) => s + c.sesiones, 0);
  const avgScore = (FAKE_CURSOS.reduce((s, c) => s + c.score, 0) / totalCursos).toFixed(1);
  const criticos = FAKE_CURSOS.filter(c => c.score < 4.2).length;

  const kpis = [
    { label: "Catálogo activo", value: String(totalCursos), sub: `Internos: ${FAKE_CURSOS.filter(c => c.proveedor === "Interno").length} · Externos: ${FAKE_CURSOS.filter(c => c.proveedor !== "Interno").length}` },
    { label: "Sesiones programadas", value: String(totalSesiones), sub: "Próximos 30 días" },
    { label: "Score promedio", value: avgScore, sup: "/5", sub: "Últimos 90 días · 218 evaluaciones" },
    { label: "Cursos críticos", value: String(criticos), sub: "< 4.2 score o > 30% deserción" },
  ];

  return `
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    ${kpis.map(k => `
      <div class="rounded-xl border border-border bg-white p-4 shadow-sm">
        <p class="text-xs font-medium text-text-muted">${escapeHtml(k.label)}</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-text-primary">${k.value}${k.sup ? `<span class="text-sm font-medium text-slate-400">${k.sup}</span>` : ""}</p>
        <p class="mt-0.5 text-[11px] text-slate-500">${escapeHtml(k.sub)}</p>
      </div>
    `).join("")}
  </div>`;
}

function renderCursosTabs(active: "Todos" | CursoCat): string {
  return `
  <div class="flex items-center gap-1 rounded-lg border border-border bg-slate-50 p-1" role="tablist" aria-label="Categorías de cursos">
    ${CURSOS_CATS.map(cat => {
      const isActive = cat === active;
      const cls = isActive
        ? "rounded-md bg-leoni-blue px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
        : "rounded-md px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer";
      return `<button type="button" role="tab" aria-selected="${isActive}" data-action="cursos-tab" data-cat="${cat}" class="${cls}">${escapeHtml(cat)}</button>`;
    }).join("")}
  </div>`;
}

function renderCursosCards(cursos: CursoItem[]): string {
  if (cursos.length === 0) {
    return `<p class="col-span-full py-10 text-center text-sm text-slate-500">No hay cursos en esta categoría.</p>`;
  }
  return cursos.map(c => `
    <div class="flex flex-col gap-3 rounded-xl border border-border bg-white p-4 shadow-sm transition hover:shadow-md">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          ${catBadge(c.cat)}
          ${c.obligatorio ? `<span class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">Obligatorio</span>` : ""}
        </div>
        <span class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-500">${escapeHtml(c.id)}</span>
      </div>
      <div>
        <p class="text-sm font-semibold leading-tight text-text-primary">${escapeHtml(c.nombre)}</p>
        <p class="mt-1 text-xs text-text-muted">${escapeHtml(c.proveedor)} · ${escapeHtml(c.duracion)} · cupo ${c.cupo}</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="flex size-6 items-center justify-center rounded-full bg-leoni-blue text-[10px] font-bold text-white">${c.instructor.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}</span>
        <span class="text-xs text-slate-600">${escapeHtml(c.instructor)}</span>
      </div>
      <div class="mt-auto border-t border-slate-100 pt-3">
        <div class="flex items-center justify-between text-[11.5px]">
          <span><b class="font-semibold tabular-nums">${c.sesiones}</b> <span class="text-slate-500">sesiones/año</span></span>
          <span><b class="font-semibold tabular-nums">${c.asignados}</b> <span class="text-slate-500">asignados</span></span>
          ${starRating(c.score)}
        </div>
      </div>
    </div>
  `).join("");
}

function renderCursosPage(activeCat: "Todos" | CursoCat): string {
  const filtered = activeCat === "Todos" ? FAKE_CURSOS : FAKE_CURSOS.filter(c => c.cat === activeCat);
  const countLabel = activeCat === "Todos" ? `${FAKE_CURSOS.length} cursos` : `${filtered.length} cursos`;

  return `
  <div class="flex flex-col gap-5">
    ${renderCursosKpis()}

    <div class="rounded-2xl border border-border bg-white shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        ${renderCursosTabs(activeCat)}
        <span class="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-600">${countLabel}</span>
      </div>
      <div class="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" id="cursos-grid">
        ${renderCursosCards(filtered)}
      </div>
    </div>
  </div>`;
}

export function mountLevelUpDashboard(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Level Up",
    activeNav: "level-up",
    mainHtml: levelUpStub("Resumen operativo", "Vista consolidada de capacitación, brechas y cumplimiento."),
  });
}

// ── Capacidades: tipos y datos fake ─────────────────────────────────────────

interface CapEmployee {
  id: string;
  name: string;
  puesto: string;
  area: string;
}

interface Capability {
  code: string;
  label: string;
}

const CAP_EMPLOYEES: CapEmployee[] = [
  { id: "E-1042", name: "María Ortega Reyes", puesto: "Operadora de Crimpado", area: "Cableado · Línea 3" },
  { id: "E-1118", name: "Jorge Salazar Núñez", puesto: "Técnico de Crimpado", area: "Cableado · Línea 1" },
  { id: "E-1207", name: "Lucía Mendoza Vargas", puesto: "Operadora de Ensamble", area: "Ensamble · Línea 5" },
  { id: "E-1314", name: "Rafael Cuevas Trejo", puesto: "Líder de Línea", area: "Cableado · Línea 3" },
  { id: "E-1402", name: "Sandra Peña Galván", puesto: "Inspectora de Calidad", area: "Calidad · Cableado" },
  { id: "E-1520", name: "Adrián Carmona Soto", puesto: "Operador de Ensamble", area: "Ensamble · Línea 2" },
  { id: "E-1633", name: "Patricia Loera Beltrán", puesto: "Operadora de Prueba E.", area: "Prueba Eléctrica" },
  { id: "E-1701", name: "Diego Hurtado Vidal", puesto: "Operador de Crimpado", area: "Cableado · Línea 1" },
  { id: "E-1815", name: "Ana Karina Reséndiz", puesto: "Operadora de Ensamble", area: "Ensamble · Línea 5" },
  { id: "E-1909", name: "Hugo Cárdenas Olvera", puesto: "Técnico Mantenimiento", area: "Mantenimiento" },
  { id: "E-2014", name: "Brenda Valdez Aguilar", puesto: "Operadora de Crimpado", area: "Cableado · Línea 1" },
  { id: "E-2122", name: "Tomás Ibarra Maldonado", puesto: "Operador de Prueba E.", area: "Prueba Eléctrica" },
];

const CAP_CAPABILITIES: Capability[] = [
  { code: "CR-01", label: "Crimpado manual" },
  { code: "CR-02", label: "Crimpado automatizado" },
  { code: "EN-01", label: "Ensamble de arnés" },
  { code: "EN-02", label: "Ruteo en tablero" },
  { code: "CT-01", label: "Continuidad eléctrica" },
  { code: "CT-02", label: "Hi-Pot" },
  { code: "QA-01", label: "Inspección visual IPC-A-620" },
  { code: "QA-02", label: "Lectura de plano eléctrico" },
  { code: "SE-01", label: "Seguridad eléctrica LOTO" },
  { code: "MT-01", label: "Cambio de herramental" },
];

const CAP_REQ: number[] = [3, 2, 3, 2, 3, 2, 4, 3, 4, 2];

const CAP_MATRIX: number[][] = [
  [4, 2, 3, 1, 3, 2, 4, 3, 4, 2],
  [5, 4, 4, 3, 4, 3, 5, 4, 5, 4],
  [2, 1, 4, 3, 3, 2, 3, 3, 4, 1],
  [5, 5, 5, 5, 5, 4, 5, 5, 5, 5],
  [3, 2, 3, 2, 4, 4, 5, 5, 4, 2],
  [1, 0, 3, 2, 2, 1, 2, 2, 3, 1],
  [3, 2, 2, 1, 5, 4, 4, 4, 4, 2],
  [2, 1, 1, 0, 2, 1, 2, 2, 3, 0],
  [3, 2, 4, 3, 3, 2, 3, 3, 4, 2],
  [4, 3, 3, 2, 3, 2, 3, 3, 5, 5],
  [2, 1, 2, 1, 2, 1, 3, 2, 3, 1],
  [3, 2, 2, 1, 5, 4, 4, 4, 4, 3],
];

function capCellColor(level: number, required: number): string {
  if (level === 0) return "bg-slate-50 text-slate-400";
  if (level < required) {
    const gap = required - level;
    if (gap >= 2) return "bg-red-200 text-red-900";
    return "bg-red-100 text-red-800";
  }
  if (level === required) return "bg-amber-100 text-amber-900";
  // level > required
  const excess = level - required;
  if (excess >= 2) return "bg-emerald-300 text-emerald-900";
  return "bg-emerald-100 text-emerald-900";
}

function capCellBorder(level: number, required: number): string {
  if (level < required) return "ring-1 ring-inset ring-red-300";
  return "";
}

function computeCapKpis(): { capacidades: number; evaluados: number; promedio: string; brechas: number } {
  const capacidades = CAP_CAPABILITIES.length;
  const evaluados = CAP_EMPLOYEES.length;
  let totalLevel = 0;
  let totalCells = 0;
  let brechas = 0;
  for (let ei = 0; ei < CAP_MATRIX.length; ei++) {
    for (let ci = 0; ci < CAP_MATRIX[ei].length; ci++) {
      totalLevel += CAP_MATRIX[ei][ci];
      totalCells++;
      if (CAP_MATRIX[ei][ci] < CAP_REQ[ci]) brechas++;
    }
  }
  const promedio = (totalLevel / totalCells).toFixed(1);
  return { capacidades, evaluados, promedio, brechas };
}

function renderCapKpis(): string {
  const kpis = computeCapKpis();
  const items = [
    { label: "Capacidades", value: String(kpis.capacidades), sub: "En el perfil evaluado" },
    { label: "Personas evaluadas", value: String(kpis.evaluados), sub: "Cableado y Ensamble" },
    { label: "Nivel promedio", value: kpis.promedio, sup: "/5", sub: "Todos los colaboradores" },
    { label: "Brechas activas", value: String(kpis.brechas), sub: "Celdas debajo del requerido" },
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

function renderCapLegend(): string {
  return `
  <div class="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-slate-50 px-4 py-2.5 text-[11px]">
    <span class="font-semibold text-slate-600">Nivel de dominio</span>
    <span class="flex items-center gap-1.5"><span class="inline-block h-3.5 w-5 rounded bg-red-200 ring-1 ring-inset ring-red-300" aria-hidden="true"></span>Brecha &ge;2</span>
    <span class="flex items-center gap-1.5"><span class="inline-block h-3.5 w-5 rounded bg-red-100 ring-1 ring-inset ring-red-300" aria-hidden="true"></span>Brecha 1</span>
    <span class="flex items-center gap-1.5"><span class="inline-block h-3.5 w-5 rounded bg-amber-100" aria-hidden="true"></span>Cumple</span>
    <span class="flex items-center gap-1.5"><span class="inline-block h-3.5 w-5 rounded bg-emerald-100" aria-hidden="true"></span>Excede +1</span>
    <span class="flex items-center gap-1.5"><span class="inline-block h-3.5 w-5 rounded bg-emerald-300" aria-hidden="true"></span>Excede +2</span>
    <span class="flex items-center gap-1.5"><span class="inline-block h-3.5 w-5 rounded bg-slate-50 ring-1 ring-inset ring-slate-200" aria-hidden="true"></span>Sin evaluar</span>
    <span class="ml-auto text-slate-500">Actualizado: 11/05/26 · Evaluador: R. Cuevas</span>
  </div>`;
}

function renderCapHeatmap(): string {
  // Column headers
  const colHeaders = CAP_CAPABILITIES.map(c =>
    `<th class="px-1 py-2 text-center align-bottom">
      <div class="flex flex-col items-center gap-0.5">
        <span class="text-[9px] font-mono text-slate-400">${escapeHtml(c.code)}</span>
        <span class="text-[10px] font-semibold leading-tight text-slate-700 [writing-mode:vertical-rl] rotate-180 h-16">${escapeHtml(c.label)}</span>
      </div>
    </th>`
  ).join("");

  // Required row
  const reqCells = CAP_REQ.map(r =>
    `<td class="px-1 py-1.5 text-center"><span class="inline-flex size-7 items-center justify-center rounded bg-slate-100 font-mono text-[11px] font-bold text-slate-600">${r}</span></td>`
  ).join("");

  // Employee rows
  const empRows = CAP_EMPLOYEES.map((emp, ei) => {
    const row = CAP_MATRIX[ei];
    const total = row.reduce((s, v, i) => s + Math.min(v, CAP_REQ[i]) / CAP_REQ[i], 0);
    const score = Math.round((total / row.length) * 100);
    const scoreTone = score >= 90 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : score >= 75 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-800";
    const initials = emp.name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

    const cells = row.map((v, i) => {
      const color = capCellColor(v, CAP_REQ[i]);
      const border = capCellBorder(v, CAP_REQ[i]);
      return `<td class="px-1 py-1 text-center"><span class="inline-flex size-7 items-center justify-center rounded text-[11px] font-semibold tabular-nums ${color} ${border}">${v}</span></td>`;
    }).join("");

    return `
    <tr class="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
      <td class="sticky left-0 z-10 bg-white px-2 py-1.5">
        <div class="flex items-center gap-2 min-w-[180px]">
          <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-leoni-blue text-[10px] font-bold text-white">${escapeHtml(initials)}</span>
          <div class="min-w-0">
            <div class="truncate text-xs font-semibold text-slate-900">${escapeHtml(emp.name)}</div>
            <div class="truncate text-[10px] text-slate-500">${escapeHtml(emp.puesto)} · ${escapeHtml(emp.area)}</div>
          </div>
        </div>
      </td>
      ${cells}
      <td class="px-2 py-1.5 text-center"><span class="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums ${scoreTone}">${score}%</span></td>
    </tr>`;
  }).join("");

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
          <tr class="bg-slate-50 border-b border-slate-200">
            <td class="sticky left-0 z-10 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-600">Perfil requerido</td>
            ${reqCells}
            <td class="px-2 py-1.5 text-center text-[10px] text-slate-400">&mdash;</td>
          </tr>
        </thead>
        <tbody>
          ${empRows}
        </tbody>
      </table>
    </div>
    <div class="border-t border-slate-100 bg-slate-50 px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1 text-[11px] text-slate-600">
      <span><b class="font-mono text-sm text-slate-900">${computeCapKpis().brechas}</b> brechas detectadas</span>
      <span><b class="font-mono text-sm text-slate-900">11</b> colaboradores con brecha activa</span>
      <span><b class="font-mono text-sm text-slate-900">3</b> capacidades cr&iacute;ticas con cumplimiento &lt; 70%</span>
      <span class="ml-auto"><b class="font-semibold">CR-02 · Crimpado automatizado</b> es la capacidad con mayor brecha</span>
    </div>
  </div>`;
}

function renderCapacidadesPage(): string {
  return `
  <div class="flex flex-col gap-5">
    <div>
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Capacidades · Cableado y Ensamble</p>
      <h1 class="mt-1 text-lg font-semibold text-text-primary">Matriz de capacidades</h1>
      <p class="mt-1 text-sm text-text-muted">Comparaci&oacute;n entre el nivel requerido por puesto y el nivel actual de cada colaborador. Las celdas con borde indican brecha vs. el perfil requerido.</p>
    </div>
    ${renderCapKpis()}
    ${renderCapLegend()}
    ${renderCapHeatmap()}
  </div>`;
}

export function mountCapacidades(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Matriz de Capacidades",
    activeNav: "capacidades",
    mainHtml: renderCapacidadesPage(),
  });
}

// ── Habilidades: tipos y datos fake ─────────────────────────────────────────

type SkillTipo = "Técnica" | "Blanda" | "Operativa" | "Crítica";
type SkillTab = "colaborador" | "habilidad" | "area" | "criticas";
const SKILL_LEVELS = ["—", "Novato", "Básico", "Competente", "Experto"] as const;

interface SkillItem {
  code: string;
  label: string;
  tipo: SkillTipo;
}

const SKILLS: SkillItem[] = [
  { code: "TC-01", label: "Lectura de plano técnico", tipo: "Técnica" },
  { code: "TC-02", label: "Uso de torquímetro", tipo: "Técnica" },
  { code: "TC-03", label: "Operación de prensa CRIMP", tipo: "Técnica" },
  { code: "TC-04", label: "Diagnóstico de continuidad", tipo: "Técnica" },
  { code: "BL-01", label: "Trabajo en equipo", tipo: "Blanda" },
  { code: "BL-02", label: "Comunicación operativa", tipo: "Blanda" },
  { code: "BL-03", label: "Resolución de problemas", tipo: "Blanda" },
  { code: "OP-01", label: "Cumplimiento 5S", tipo: "Operativa" },
  { code: "OP-02", label: "Reporte de no-conformidad", tipo: "Operativa" },
  { code: "CK-01", label: "Bloqueo LOTO", tipo: "Crítica" },
  { code: "CK-02", label: "Manejo de alta tensión", tipo: "Crítica" },
];

// Nivel requerido por habilidad (escala 1-4)
const SKILL_REQ: number[] = [3, 3, 3, 3, 2, 3, 3, 3, 3, 3, 3];

interface SkillEmployee {
  id: string;
  name: string;
  puesto: string;
  area: string;
}

const SKILL_EMPLOYEES: SkillEmployee[] = [
  { id: "E-1042", name: "María Ortega Reyes", puesto: "Operadora de Crimpado", area: "Cableado" },
  { id: "E-1118", name: "Jorge Salazar Núñez", puesto: "Técnico de Crimpado", area: "Cableado" },
  { id: "E-1207", name: "Lucía Mendoza Vargas", puesto: "Operadora de Ensamble", area: "Ensamble" },
  { id: "E-1314", name: "Rafael Cuevas Trejo", puesto: "Líder de Línea", area: "Cableado" },
  { id: "E-1402", name: "Sandra Peña Galván", puesto: "Inspectora de Calidad", area: "Calidad" },
  { id: "E-1520", name: "Adrián Carmona Soto", puesto: "Operador de Ensamble", area: "Ensamble" },
  { id: "E-1633", name: "Patricia Loera Beltrán", puesto: "Operadora de Prueba E.", area: "Prueba Eléctrica" },
  { id: "E-1701", name: "Diego Hurtado Vidal", puesto: "Operador de Crimpado", area: "Cableado" },
  { id: "E-1815", name: "Ana Karina Reséndiz", puesto: "Operadora de Ensamble", area: "Ensamble" },
  { id: "E-1909", name: "Hugo Cárdenas Olvera", puesto: "Técnico Mantenimiento", area: "Mantenimiento" },
  { id: "E-2014", name: "Brenda Valdez Aguilar", puesto: "Operadora de Crimpado", area: "Cableado" },
  { id: "E-2122", name: "Tomás Ibarra Maldonado", puesto: "Operador de Prueba E.", area: "Prueba Eléctrica" },
];

// Escala 1-4: 1=novato, 2=básico, 3=competente, 4=experto
const SKILL_MATRIX: number[][] = [
  [3, 3, 4, 2, 3, 3, 2, 3, 3, 4, 2], // María
  [4, 4, 4, 4, 3, 4, 3, 4, 4, 4, 4], // Jorge
  [2, 2, 2, 3, 3, 3, 2, 2, 3, 3, 1], // Lucía
  [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4], // Rafael
  [3, 3, 3, 4, 4, 3, 4, 4, 4, 3, 2], // Sandra
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1], // Adrián
  [3, 2, 3, 4, 3, 3, 3, 3, 3, 4, 3], // Patricia
  [1, 1, 1, 1, 2, 2, 1, 2, 2, 2, 1], // Diego
  [3, 3, 3, 3, 3, 3, 2, 3, 3, 3, 1], // Ana
  [4, 3, 3, 4, 3, 4, 3, 3, 3, 4, 4], // Hugo
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1], // Brenda
  [3, 2, 3, 4, 3, 3, 3, 3, 3, 4, 3], // Tomás
];

function skillBarCell(level: number, required: number): string {
  const isGap = level < required;
  const segments = [1, 2, 3, 4].map(i => {
    const filled = level >= i;
    const color = filled ? (isGap ? "bg-blue-500" : "bg-slate-700") : "bg-slate-200";
    return `<span class="inline-block w-[6px] h-[14px] rounded-sm ${color}"></span>`;
  }).join("");
  return `<div class="flex items-center gap-[2px]">${segments}</div>`;
}

function skillLevelBar(level: number): string {
  const color = level <= 1 ? "bg-red-400" : level === 2 ? "bg-amber-400" : level === 3 ? "bg-blue-500" : "bg-emerald-500";
  const segments = [1, 2, 3, 4].map(i => {
    const filled = level >= i;
    return `<span class="h-1.5 flex-1 rounded-full ${filled ? color : "bg-slate-200"}"></span>`;
  }).join("");
  return `<div class="flex gap-0.5 w-12">${segments}</div>`;
}

function skillTipoBadge(tipo: SkillTipo): string {
  const styles: Record<SkillTipo, { border: string; bg: string; text: string; dot: string }> = {
    "Técnica":   { border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-800", dot: "bg-blue-500" },
    "Blanda":    { border: "border-violet-200", bg: "bg-violet-50", text: "text-violet-800", dot: "bg-violet-500" },
    "Operativa": { border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-800", dot: "bg-amber-400" },
    "Crítica":   { border: "border-red-200", bg: "bg-red-50", text: "text-red-800", dot: "bg-red-500" },
  };
  const s = styles[tipo];
  return `<span class="inline-flex items-center gap-1 rounded-full border ${s.border} ${s.bg} px-1.5 py-0.5 text-[9px] font-semibold ${s.text}"><span class="size-1.5 shrink-0 rounded-full ${s.dot}" aria-hidden="true"></span>${escapeHtml(tipo)}</span>`;
}

function computeSkillKpis(): { totalSkills: number; evaluados: number; promedio: string; gaps: number; criticas: number } {
  const totalSkills = SKILLS.length;
  const evaluados = SKILL_EMPLOYEES.length;
  let totalLevel = 0;
  let totalCells = 0;
  let gaps = 0;
  for (let ei = 0; ei < SKILL_MATRIX.length; ei++) {
    for (let ci = 0; ci < SKILL_MATRIX[ei].length; ci++) {
      totalLevel += SKILL_MATRIX[ei][ci];
      totalCells++;
      if (SKILL_MATRIX[ei][ci] < SKILL_REQ[ci]) gaps++;
    }
  }
  const promedio = (totalLevel / totalCells).toFixed(1);
  const criticas = SKILLS.filter(s => s.tipo === "Crítica").length;
  return { totalSkills, evaluados, promedio, gaps, criticas };
}

function renderSkillTipoCards(): string {
  const tipos: Array<{ tipo: SkillTipo; count: number; label: string }> = [
    { tipo: "Técnica", count: SKILLS.filter(s => s.tipo === "Técnica").length, label: "Plano, torquímetro, prensa CRIMP, continuidad" },
    { tipo: "Blanda", count: SKILLS.filter(s => s.tipo === "Blanda").length, label: "Equipo, comunicación, resolución de problemas" },
    { tipo: "Operativa", count: SKILLS.filter(s => s.tipo === "Operativa").length, label: "5S y reporte de no-conformidad" },
    { tipo: "Crítica", count: SKILLS.filter(s => s.tipo === "Crítica").length, label: "Habilidades clave para operar en el puesto" },
  ];
  return `
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    ${tipos.map(c => `
      <div class="rounded-lg border border-border bg-white p-4">
        <div class="flex items-center justify-between">
          ${skillTipoBadge(c.tipo)}
          <span class="text-lg font-bold tabular-nums text-slate-900">${c.count}</span>
        </div>
        <p class="mt-2 text-[11px] text-slate-500">${escapeHtml(c.label)}</p>
      </div>
    `).join("")}
  </div>`;
}

function renderSkillLegend(): string {
  return `
  <div class="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-slate-50 px-4 py-2.5 text-[11px]">
    <span class="font-semibold text-slate-600">Niveles</span>
    <span class="flex items-center gap-1.5"><span class="inline-flex items-center gap-[2px]"><span class="inline-block w-[6px] h-[10px] rounded-sm bg-slate-700"></span><span class="inline-block w-[6px] h-[10px] rounded-sm bg-slate-200"></span><span class="inline-block w-[6px] h-[10px] rounded-sm bg-slate-200"></span><span class="inline-block w-[6px] h-[10px] rounded-sm bg-slate-200"></span></span>1 Novato</span>
    <span class="flex items-center gap-1.5"><span class="inline-flex items-center gap-[2px]"><span class="inline-block w-[6px] h-[10px] rounded-sm bg-slate-700"></span><span class="inline-block w-[6px] h-[10px] rounded-sm bg-slate-700"></span><span class="inline-block w-[6px] h-[10px] rounded-sm bg-slate-200"></span><span class="inline-block w-[6px] h-[10px] rounded-sm bg-slate-200"></span></span>2 B&aacute;sico</span>
    <span class="flex items-center gap-1.5"><span class="inline-flex items-center gap-[2px]"><span class="inline-block w-[6px] h-[10px] rounded-sm bg-slate-700"></span><span class="inline-block w-[6px] h-[10px] rounded-sm bg-slate-700"></span><span class="inline-block w-[6px] h-[10px] rounded-sm bg-slate-700"></span><span class="inline-block w-[6px] h-[10px] rounded-sm bg-slate-200"></span></span>3 Competente</span>
    <span class="flex items-center gap-1.5"><span class="inline-flex items-center gap-[2px]"><span class="inline-block w-[6px] h-[10px] rounded-sm bg-slate-700"></span><span class="inline-block w-[6px] h-[10px] rounded-sm bg-slate-700"></span><span class="inline-block w-[6px] h-[10px] rounded-sm bg-slate-700"></span><span class="inline-block w-[6px] h-[10px] rounded-sm bg-slate-700"></span></span>4 Experto</span>
    <span class="flex items-center gap-1.5"><span class="inline-flex items-center gap-[2px]"><span class="inline-block w-[6px] h-[10px] rounded-sm bg-blue-500"></span><span class="inline-block w-[6px] h-[10px] rounded-sm bg-slate-200"></span><span class="inline-block w-[6px] h-[10px] rounded-sm bg-slate-200"></span><span class="inline-block w-[6px] h-[10px] rounded-sm bg-slate-200"></span></span>Gap (bajo requerido)</span>
    <span class="ml-auto text-slate-500">Actualizado: 12/05/26 · Evaluador: R. Cuevas</span>
  </div>`;
}

function renderSkillTabs(active: SkillTab): string {
  const kpis = computeSkillKpis();
  const tabs: Array<{ id: SkillTab; label: string; badge?: string }> = [
    { id: "colaborador", label: "Por colaborador" },
    { id: "habilidad", label: "Por habilidad" },
    { id: "area", label: "Por área" },
    { id: "criticas", label: "Habilidades críticas", badge: String(kpis.criticas) },
  ];
  return `
  <div class="flex gap-1 rounded-lg border border-border bg-slate-50 p-1" role="tablist">
    ${tabs.map(t => {
      const isActive = t.id === active;
      return `<button data-action="skill-tab" data-tab="${t.id}" role="tab" aria-selected="${isActive}" class="rounded-md px-3 py-1.5 text-xs font-semibold transition ${isActive ? "bg-white text-text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"}">${t.label}${t.badge ? ` <span class="ml-1 font-mono text-blue-600">${t.badge}</span>` : ""}</button>`;
    }).join("")}
  </div>`;
}

function renderSkillMatrixByColaborador(): string {
  const colHeaders = SKILLS.map(s =>
    `<th class="px-1 py-2 text-center align-bottom">
      <div class="flex flex-col items-center gap-0.5">
        <span class="text-[9px] font-semibold text-slate-500">${escapeHtml(s.tipo.charAt(0))}</span>
        <span class="text-[10px] font-semibold leading-tight text-slate-700 [writing-mode:vertical-rl] rotate-180 h-16">${escapeHtml(s.label)}</span>
        <span class="text-[9px] font-mono text-slate-400">${escapeHtml(s.code)}</span>
      </div>
    </th>`
  ).join("");

  const reqCells = SKILL_REQ.map(r =>
    `<td class="px-1 py-1.5 text-center"><span class="inline-flex size-6 items-center justify-center rounded bg-slate-100 font-mono text-[10px] font-bold text-slate-600">${r}</span></td>`
  ).join("");

  const empRows = SKILL_EMPLOYEES.map((emp, ei) => {
    const row = SKILL_MATRIX[ei];
    const avg = row.reduce((s, v) => s + v, 0) / row.length;
    const avgRound = Math.round(avg * 10) / 10;
    const avgTone = avgRound >= 3.5 ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : avgRound >= 2.5 ? "border-blue-200 bg-blue-50 text-blue-800"
      : avgRound >= 1.5 ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-red-200 bg-red-50 text-red-800";
    const initials = emp.name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

    const cells = row.map((v, i) => {
      return `<td class="px-1 py-1 text-center"><div class="flex justify-center">${skillBarCell(v, SKILL_REQ[i])}</div></td>`;
    }).join("");

    return `
    <tr class="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
      <td class="sticky left-0 z-10 bg-white px-2 py-1.5">
        <div class="flex items-center gap-2 min-w-[180px]">
          <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-leoni-blue text-[10px] font-bold text-white">${escapeHtml(initials)}</span>
          <div class="min-w-0">
            <div class="truncate text-xs font-semibold text-slate-900">${escapeHtml(emp.name)}</div>
            <div class="truncate text-[10px] text-slate-500">${escapeHtml(emp.puesto)}</div>
          </div>
        </div>
      </td>
      ${cells}
      <td class="px-2 py-1.5 text-center"><span class="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums ${avgTone}">${avgRound.toFixed(1)}</span></td>
    </tr>`;
  }).join("");

  const worstSkillIdx = SKILLS.reduce((worst, _, i) => {
    const avgI = SKILL_MATRIX.reduce((s, r) => s + r[i], 0) / SKILL_MATRIX.length;
    const avgW = SKILL_MATRIX.reduce((s, r) => s + r[worst], 0) / SKILL_MATRIX.length;
    return avgI < avgW ? i : worst;
  }, 0);

  let gapCount = 0;
  for (let ei = 0; ei < SKILL_MATRIX.length; ei++) {
    for (let ci = 0; ci < SKILL_MATRIX[ei].length; ci++) {
      if (SKILL_MATRIX[ei][ci] < SKILL_REQ[ci]) gapCount++;
    }
  }
  const empsWithGaps = SKILL_EMPLOYEES.filter((_, i) => SKILL_MATRIX[i].some((v, ci) => v < SKILL_REQ[ci])).length;

  return `
  <div class="rounded-lg border border-border bg-white overflow-hidden flex flex-col">
    <div class="overflow-x-auto flex-1">
      <table class="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr class="border-b border-slate-200">
            <th class="sticky left-0 z-10 bg-white px-2 py-2 text-left text-xs font-semibold text-slate-500 min-w-[200px]">Colaborador</th>
            ${colHeaders}
            <th class="px-2 py-2 text-center text-[9px] font-semibold text-slate-500 uppercase tracking-wide">Prom.</th>
          </tr>
          <tr class="bg-slate-50 border-b border-slate-200">
            <td class="sticky left-0 z-10 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-600">Nivel requerido</td>
            ${reqCells}
            <td class="px-2 py-1.5 text-center text-[10px] text-slate-400">&mdash;</td>
          </tr>
        </thead>
        <tbody>
          ${empRows}
        </tbody>
      </table>
    </div>
    <div class="border-t border-slate-100 bg-slate-50 px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1 text-[11px] text-slate-600">
      <span><b class="font-mono text-sm text-slate-900">${gapCount}</b> brechas detectadas</span>
      <span><b class="font-mono text-sm text-slate-900">${empsWithGaps}</b> colaboradores con gaps</span>
      <span class="ml-auto"><b class="font-semibold">${escapeHtml(SKILLS[worstSkillIdx].code)} · ${escapeHtml(SKILLS[worstSkillIdx].label)}</b> habilidad con mayor brecha</span>
    </div>
  </div>`;
}

function renderSkillCardsByTipo(): string {
  const tipos: SkillTipo[] = ["Técnica", "Blanda", "Operativa", "Crítica"];
  return `
  <div class="grid gap-4 lg:grid-cols-2">
    ${tipos.map(tipo => {
      const skills = SKILLS.filter(s => s.tipo === tipo);
      const skillCards = skills.map(skill => {
        const si = SKILLS.indexOf(skill);
        const levels = SKILL_MATRIX.map(row => row[si]);
        const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
        const avgRound = Math.round(avg * 10) / 10;
        const belowReq = levels.filter(v => v < SKILL_REQ[si]).length;
        return `
        <div class="flex items-center gap-3 rounded border border-slate-100 bg-white px-3 py-2.5">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-[9px] font-mono text-slate-400">${escapeHtml(skill.code)}</span>
              <span class="text-xs font-semibold text-slate-900 truncate">${escapeHtml(skill.label)}</span>
            </div>
            <div class="mt-1.5 flex items-center gap-2">
              ${skillLevelBar(Math.round(avg))}
              <span class="text-[10px] font-semibold tabular-nums text-slate-700">${avgRound.toFixed(1)}<span class="text-slate-400">/4</span></span>
              ${belowReq > 0 ? `<span class="text-[10px] text-red-600 font-medium">${belowReq} gaps</span>` : `<span class="text-[10px] text-emerald-600 font-medium">OK</span>`}
            </div>
          </div>
          <div class="text-right shrink-0">
            <div class="text-lg font-bold tabular-nums text-slate-900">${levels.length}</div>
            <div class="text-[9px] text-slate-500">evaluados</div>
          </div>
        </div>`;
      }).join("");

      const tipoSkills = skills.map(s => SKILLS.indexOf(s));
      const tipoAvg = tipoSkills.length > 0 ? tipoSkills.reduce((sum, si) => {
        return sum + SKILL_MATRIX.reduce((s, r) => s + r[si], 0) / SKILL_MATRIX.length;
      }, 0) / tipoSkills.length : 0;

      return `
      <div class="rounded-lg border border-border bg-white overflow-hidden">
        <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div class="flex items-center gap-2">
            ${skillTipoBadge(tipo)}
            <span class="text-sm font-semibold text-slate-900">${escapeHtml(tipo)}s</span>
            <span class="text-xs text-slate-500">(${skills.length})</span>
          </div>
          <span class="text-xs font-semibold tabular-nums text-slate-600">Prom. ${tipoAvg.toFixed(1)}/4</span>
        </div>
        <div class="flex flex-col gap-2 p-3">
          ${skillCards}
        </div>
      </div>`;
    }).join("")}
  </div>`;
}

function renderSkillByArea(): string {
  const areas = [...new Set(SKILL_EMPLOYEES.map(e => e.area))];
  return `
  <div class="grid gap-4 lg:grid-cols-2">
    ${areas.map(area => {
      const emps = SKILL_EMPLOYEES.filter(e => e.area === area);
      const empIndices = emps.map(e => SKILL_EMPLOYEES.indexOf(e));
      const areaAvg = empIndices.reduce((sum, ei) => {
        return sum + SKILL_MATRIX[ei].reduce((a, b) => a + b, 0) / SKILL_MATRIX[ei].length;
      }, 0) / empIndices.length;
      const areaGaps = empIndices.reduce((sum, ei) => sum + SKILL_MATRIX[ei].filter((v, ci) => v < SKILL_REQ[ci]).length, 0);
      const avgTone = areaAvg >= 3.5 ? "text-emerald-700" : areaAvg >= 2.5 ? "text-blue-700" : "text-amber-700";

      const rows = emps.map(emp => {
        const ei = SKILL_EMPLOYEES.indexOf(emp);
        const row = SKILL_MATRIX[ei];
        const avg = row.reduce((a, b) => a + b, 0) / row.length;
        const gaps = row.filter((v, ci) => v < SKILL_REQ[ci]).length;
        return `
        <div class="flex items-center gap-3 px-3 py-2 border-t border-slate-50 first:border-0">
          <span class="text-xs font-semibold text-slate-900 flex-1 truncate">${escapeHtml(emp.name)}</span>
          <div class="flex items-center gap-2">
            ${skillLevelBar(Math.round(avg))}
            <span class="text-[10px] font-semibold tabular-nums w-8 text-right text-slate-700">${avg.toFixed(1)}</span>
            ${gaps > 0 ? `<span class="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[9px] font-bold text-red-700">${gaps}</span>` : `<span class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">✓</span>`}
          </div>
        </div>`;
      }).join("");

      return `
      <div class="rounded-lg border border-border bg-white overflow-hidden">
        <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <span class="text-sm font-semibold text-slate-900">${escapeHtml(area)}</span>
            <span class="ml-2 text-xs text-slate-500">${emps.length} personas</span>
          </div>
          <div class="text-right">
            <span class="text-sm font-bold tabular-nums ${avgTone}">${areaAvg.toFixed(1)}</span>
            <span class="text-[10px] text-slate-400">/4</span>
            ${areaGaps > 0 ? `<span class="ml-2 text-[10px] text-red-600 font-medium">${areaGaps} gaps</span>` : ""}
          </div>
        </div>
        <div class="flex flex-col">
          ${rows}
        </div>
      </div>`;
    }).join("")}
  </div>`;
}

function renderSkillCriticas(): string {
  const criticas = SKILLS.filter(s => s.tipo === "Crítica");
  return `
  <div class="flex flex-col gap-4">
    <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
      <p class="text-xs font-semibold text-red-800">Habilidades cr&iacute;ticas requieren nivel m&iacute;nimo Competente (3). El personal sin este nivel no puede operar en las &aacute;reas correspondientes.</p>
    </div>
    ${criticas.map(skill => {
      const si = SKILLS.indexOf(skill);
      const rows = SKILL_EMPLOYEES.map((emp, ei) => {
        const level = SKILL_MATRIX[ei][si];
        const isGap = level < SKILL_REQ[si];
        return `
        <div class="flex items-center gap-3 px-4 py-2.5 border-t border-slate-100 first:border-0 ${isGap ? "bg-red-50/50" : ""}">
          <span class="flex size-6 shrink-0 items-center justify-center rounded-full ${isGap ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"} text-[10px] font-bold">${isGap ? "!" : "✓"}</span>
          <div class="flex-1 min-w-0">
            <span class="text-xs font-semibold text-slate-900 truncate">${escapeHtml(emp.name)}</span>
            <span class="ml-2 text-[10px] text-slate-500">${escapeHtml(emp.puesto)}</span>
          </div>
          <div class="flex items-center gap-2">
            ${skillLevelBar(level)}
            <span class="text-[10px] text-slate-500 w-16">${escapeHtml(SKILL_LEVELS[level])}</span>
          </div>
        </div>`;
      }).join("");

      const gapCount = SKILL_MATRIX.filter(r => r[si] < SKILL_REQ[si]).length;
      return `
      <div class="rounded-lg border border-border bg-white overflow-hidden">
        <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div class="flex items-center gap-2">
            ${skillTipoBadge("Crítica")}
            <span class="text-sm font-semibold text-slate-900">${escapeHtml(skill.label)}</span>
            <span class="text-[9px] font-mono text-slate-400">${escapeHtml(skill.code)}</span>
          </div>
          <span class="text-xs font-semibold ${gapCount > 0 ? "text-red-700" : "text-emerald-700"}">${gapCount > 0 ? `${gapCount} no aptos` : "Todos aptos"}</span>
        </div>
        <div class="flex flex-col">
          ${rows}
        </div>
      </div>`;
    }).join("")}
  </div>`;
}

function renderHabilidadesPage(activeTab: SkillTab): string {
  let content: string;
  switch (activeTab) {
    case "colaborador": content = renderSkillMatrixByColaborador(); break;
    case "habilidad": content = renderSkillCardsByTipo(); break;
    case "area": content = renderSkillByArea(); break;
    case "criticas": content = renderSkillCriticas(); break;
  }
  return `
  <div class="flex flex-col gap-5">
    <div class="flex items-start justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Habilidades · Cableado y Ensamble</p>
        <h1 class="mt-1 text-lg font-semibold text-text-primary">Matriz de habilidades</h1>
        <p class="mt-1 text-sm text-text-muted">Habilidades t&eacute;cnicas, blandas, operativas y cr&iacute;ticas evaluadas por colaborador. Soporte para decisiones de promoci&oacute;n y movimientos internos.</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button class="${BTN_SECONDARY} !text-xs !px-3 !py-1.5" disabled><svg class="size-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>Todas las &aacute;reas</button>
        <button class="${BTN_SECONDARY} !text-xs !px-3 !py-1.5" disabled>Tipo<span class="ml-1 font-mono text-slate-400">Todas</span></button>
        <button class="${BTN_SECONDARY} !text-xs !px-3 !py-1.5" disabled><svg class="size-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>Exportar</button>
        <button class="${BTN_PRIMARY} !text-xs !px-3 !py-1.5" disabled><svg class="size-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>Evaluaci&oacute;n nueva</button>
      </div>
    </div>
    ${renderSkillTipoCards()}
    ${renderSkillTabs(activeTab)}
    ${renderSkillLegend()}
    ${content}
  </div>`;
}

export function mountHabilidades(container: HTMLElement): void {
  let activeTab: SkillTab = "colaborador";

  function handleClick(e: Event): void {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-action='skill-tab']");
    if (btn) {
      const tab = btn.dataset.tab as SkillTab;
      if (tab && tab !== activeTab) {
        activeTab = tab;
        render();
      }
    }
  }

  function render(): void {
    container.removeEventListener("click", handleClick);
    mountAppShell(container, {
      pageTitle: "Matriz de Habilidades",
      activeNav: "habilidades",
      mainHtml: renderHabilidadesPage(activeTab),
    });
    container.addEventListener("click", handleClick);
  }

  render();
}

export function mountCursos(container: HTMLElement): void {
  let activeCat: "Todos" | CursoCat = "Todos";

  function handleClick(e: Event): void {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-action='cursos-tab']");
    if (btn) {
      const cat = btn.dataset.cat as "Todos" | CursoCat;
      if (cat && cat !== activeCat) {
        activeCat = cat;
        render();
      }
    }
  }

  function render(): void {
    container.removeEventListener("click", handleClick);
    mountAppShell(container, {
      pageTitle: "Manejo de Cursos",
      activeNav: "cursos",
      mainHtml: renderCursosPage(activeCat),
    });
    container.addEventListener("click", handleClick);
  }

  render();
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

export function mountEncuestas(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Encuestas Post Curso",
    activeNav: "encuestas",
    mainHtml: levelUpStub("Resultados post curso", "Score consolidado por curso, instructor y proveedor."),
  });
}

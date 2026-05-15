import { mountAppShell } from "../layouts/appShell.ts";
import { escapeHtml } from "../ui/uiUtils.ts";

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

export function mountHabilidades(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Matriz de Habilidades",
    activeNav: "habilidades",
    mainHtml: levelUpStub("Matriz de habilidades", "Habilidades técnicas, blandas y operativas por colaborador."),
  });
}

export function mountCursos(container: HTMLElement): void {
  let activeCat: "Todos" | CursoCat = "Todos";

  function render(): void {
    mountAppShell(container, {
      pageTitle: "Manejo de Cursos",
      activeNav: "cursos",
      mainHtml: renderCursosPage(activeCat),
    });

    // Event delegation for tab clicks
    const main = container.querySelector("[id='cursos-grid']")?.closest(".rounded-2xl") as HTMLElement | null;
    if (main) {
      main.addEventListener("click", (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-action='cursos-tab']");
        if (btn) {
          const cat = btn.dataset.cat as "Todos" | CursoCat;
          if (cat && cat !== activeCat) {
            activeCat = cat;
            render();
          }
        }
      });
    }
  }

  render();
}

export function mountOPLs(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Manejo de OPLs",
    activeNav: "opls",
    mainHtml: levelUpStub("Manejo de OPLs", "One Point Lessons con control de versiones y reentrenamiento."),
  });
}

export function mountEvidencias(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Motor de Evidencias",
    activeNav: "evidencias",
    mainHtml: levelUpStub("Bandeja de validación", "Evidencias que respaldan la acreditación de cursos y OPLs."),
  });
}

export function mountSugerencias(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Motor de Sugerencias",
    activeNav: "sugerencias",
    mainHtml: levelUpStub("Cursos sugeridos", "Recomendaciones por brecha interna y estándares del sector."),
  });
}

export function mountEncuestas(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Encuestas Post Curso",
    activeNav: "encuestas",
    mainHtml: levelUpStub("Resultados post curso", "Score consolidado por curso, instructor y proveedor."),
  });
}

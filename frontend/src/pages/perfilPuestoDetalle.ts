import { mountAppShell } from "../layouts/appShell.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import { BTN_PRIMARY, BTN_SECONDARY } from "../ui/uiTokens.ts";

// ── Fake data for demo (Screen 6) ──────────────────────────────────────

const PERFIL = {
  codigo: "PP-101",
  nombre: "Operador/a de Crimpado",
  area: "Cableado",
  lineas: "Líneas 1, 3, 4",
  personas: 48,
  antiguedad: "0m",
  version: "v3.2",
  ultimaRevision: "09/05/26",
  owner: "María Esquivel",
  descripcion:
    "Responsable de la operación de prensas de crimpado manual y automatizado para la fabricación de arneses eléctricos automotrices, cumpliendo los estándares IPC-A-620 y los procedimientos internos de seguridad y calidad de LEONI. Reporta al líder de línea.",
};

const CAPACIDADES = [
  { code: "CR-01", label: "Crimpado manual", req: 3 },
  { code: "CR-02", label: "Crimpado automatizado", req: 2 },
  { code: "EN-01", label: "Ensamble de arnés", req: 3 },
  { code: "EN-02", label: "Ruteo en tablero", req: 2 },
  { code: "CT-01", label: "Continuidad eléctrica", req: 3 },
  { code: "CT-02", label: "Hi-Pot", req: 2 },
  { code: "QA-01", label: "Inspección visual IPC-A-620", req: 4 },
  { code: "QA-02", label: "Lectura de plano eléctrico", req: 3 },
  { code: "SE-01", label: "Seguridad eléctrica LOTO", req: 4 },
  { code: "MT-01", label: "Cambio de herramental", req: 2 },
];

const HABILIDADES = [
  { code: "TC-01", label: "Lectura de plano técnico", tipo: "Técnica" },
  { code: "TC-02", label: "Uso de torquímetro", tipo: "Técnica" },
  { code: "TC-03", label: "Operación de prensa CRIMP", tipo: "Técnica" },
  { code: "TC-04", label: "Diagnóstico de continuidad", tipo: "Técnica" },
  { code: "BL-01", label: "Trabajo en equipo", tipo: "Blanda" },
  { code: "BL-02", label: "Comunicación operativa", tipo: "Blanda" },
  { code: "BL-03", label: "Resolución de problemas", tipo: "Blanda" },
  { code: "OP-01", label: "Cumplimiento 5S", tipo: "Operativa" },
  { code: "OP-02", label: "Reporte de no-conformidad", tipo: "Operativa" },
];

const COMPETENCIAS = [
  { label: "Calidad de producto", nivel: 5 },
  { label: "Seguridad operativa", nivel: 5 },
  { label: "Manejo de herramental", nivel: 4 },
  { label: "Cumplimiento de estándar IPC", nivel: 4 },
  { label: "Trabajo colaborativo", nivel: 3 },
  { label: "Mejora continua", nivel: 3 },
];

const CURSOS: { codigo: string; nombre: string; modalidad: string; vigencia: string; tipo: "Obligatorio" | "Opcional" }[] = [
  { codigo: "CR-101", nombre: "Crimpado manual · Inducción", modalidad: "Presencial", vigencia: "24m", tipo: "Obligatorio" },
  { codigo: "CR-102", nombre: "Crimpado automatizado · Nivel 2", modalidad: "Presencial", vigencia: "24m", tipo: "Obligatorio" },
  { codigo: "SE-001", nombre: "Seguridad eléctrica LOTO", modalidad: "Mixta", vigencia: "12m", tipo: "Obligatorio" },
  { codigo: "QA-006", nombre: "IPC-A-620 · Inspección visual", modalidad: "Presencial", vigencia: "24m", tipo: "Obligatorio" },
  { codigo: "CT-021", nombre: "Continuidad eléctrica · básico", modalidad: "En línea", vigencia: "36m", tipo: "Obligatorio" },
  { codigo: "OP-110", nombre: "5S en piso de producción", modalidad: "En línea", vigencia: "12m", tipo: "Obligatorio" },
  { codigo: "MT-031", nombre: "Cambio de herramental", modalidad: "Presencial", vigencia: "24m", tipo: "Obligatorio" },
  { codigo: "CR-203", nombre: "Crimpado especial · alta corriente", modalidad: "Presencial", vigencia: "24m", tipo: "Opcional" },
  { codigo: "BL-040", nombre: "Comunicación operativa", modalidad: "En línea", vigencia: "—", tipo: "Opcional" },
  { codigo: "QA-201", nombre: "IPC/WHMA-A-620 Rev.D 2026", modalidad: "Presencial", vigencia: "36m", tipo: "Opcional" },
];

const OPLS: { codigo: string; nombre: string; version: string; estado: "Vigente" | "Reentren. pendiente" }[] = [
  { codigo: "OPL-2041", nombre: "Cambio de herramental prensa CRIMP-A12", version: "v4 · 02/05/26", estado: "Reentren. pendiente" },
  { codigo: "OPL-2055", nombre: "Crimpado manual · tolerancia altura", version: "v2 · 14/04/26", estado: "Vigente" },
  { codigo: "OPL-2099", nombre: "Bloqueo LOTO en celda CR-12", version: "v3 · 22/03/26", estado: "Vigente" },
  { codigo: "OPL-2110", nombre: "Inspección visual post-crimp IPC", version: "v5 · 08/05/26", estado: "Reentren. pendiente" },
];

const EVIDENCIAS: { tipo: string; nombre: string; valida: string; firma: boolean }[] = [
  { tipo: "Documento", nombre: "Constancia STPS · Crimpado", valida: "Líder de Línea + RRHH", firma: true },
  { tipo: "Imagen", nombre: "Foto de crimp inicial vs. patrón IPC", valida: "Inspector de Calidad", firma: true },
  { tipo: "Video", nombre: "Demostración LOTO (60 s)", valida: "Líder de Línea", firma: false },
  { tipo: "Formulario", nombre: "Checklist 5S firmado", valida: "Líder de Línea", firma: true },
];

// ── Render helpers ──────────────────────────────────────────────────────

function levelBar(level: number): string {
  return Array.from({ length: 5 }, (_, i) =>
    `<span class="inline-block h-1.5 w-3.5 rounded-sm ${i < level ? "bg-leoni-blue" : "bg-slate-200"}"></span>`
  ).join("");
}

function starRating(nivel: number): string {
  return Array.from({ length: 5 }, (_, i) =>
    i < nivel
      ? `<svg class="size-4 text-leoni-blue" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2 3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/></svg>`
      : `<svg class="size-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="m12 2 3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/></svg>`
  ).join("");
}

function tipoBadge(tipo: string): string {
  if (tipo === "Técnica") return `<span class="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">Técnica</span>`;
  if (tipo === "Blanda") return `<span class="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">Blanda</span>`;
  return `<span class="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Operativa</span>`;
}

// ── Sections ────────────────────────────────────────────────────────────

function renderHeader(): string {
  return `
  <div class="rounded-xl border border-border bg-white p-5 shadow-sm">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div class="flex flex-wrap items-center gap-2 mb-2">
          <span class="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-600">${PERFIL.codigo}</span>
          <span class="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800"><span class="size-1.5 shrink-0 rounded-full bg-blue-500" aria-hidden="true"></span>Activo</span>
          <span class="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">${PERFIL.version}</span>
          <span class="text-xs text-slate-500">Última revisión: ${PERFIL.ultimaRevision} · ${escapeHtml(PERFIL.owner)}</span>
        </div>
        <h1 class="text-xl font-bold text-text-primary sm:text-2xl">${escapeHtml(PERFIL.nombre)}</h1>
        <div class="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-600">
          <span class="flex items-center gap-1.5">
            <svg class="size-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 20V8l6 4V8l6 4V4h6v16z"/><path d="M9 17h2M14 17h2"/></svg>
            <b>${escapeHtml(PERFIL.area)}</b> · ${PERFIL.lineas}
          </span>
          <span class="flex items-center gap-1.5">
            <svg class="size-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            ${PERFIL.personas} personas vinculadas
          </span>
          <span class="flex items-center gap-1.5">
            <svg class="size-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            Antigüedad mínima: ${PERFIL.antiguedad}
          </span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button type="button" class="${BTN_SECONDARY}">Ver brechas</button>
        <button type="button" class="${BTN_PRIMARY}">Editar perfil</button>
      </div>
    </div>
    <div class="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-sm leading-relaxed text-slate-700">
      <span class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">DESCRIPCIÓN DEL PUESTO</span>
      ${escapeHtml(PERFIL.descripcion)}
    </div>
  </div>`;
}

function renderCapacidades(): string {
  const rows = CAPACIDADES.map(c => `
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-2 min-w-0">
        <span class="font-mono text-[10px] text-slate-400">${c.code}</span>
        <span class="text-sm font-medium text-text-primary truncate">${escapeHtml(c.label)}</span>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        ${levelBar(c.req)}
        <span class="ml-1 font-mono text-[10px] text-slate-400">${c.req}/5</span>
      </div>
    </div>
  `).join("");

  return `
  <div class="rounded-xl border border-border bg-white shadow-sm">
    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
      <div>
        <h2 class="text-sm font-semibold text-text-primary">Capacidades requeridas</h2>
        <p class="text-xs text-slate-500">${CAPACIDADES.length} capacidades · nivel mínimo por capacidad</p>
      </div>
      <span class="rounded-full bg-leoni-blue/10 px-2 py-0.5 font-mono text-xs font-bold text-leoni-blue">${CAPACIDADES.length}</span>
    </div>
    <div class="grid gap-3 p-5 sm:grid-cols-2">${rows}</div>
  </div>`;
}

function renderHabilidades(): string {
  const chips = HABILIDADES.map(s => `
    <span class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
      <span class="font-mono text-[10px] text-slate-400">${s.code}</span>
      <span class="text-xs font-medium text-text-primary">${escapeHtml(s.label)}</span>
      <span class="h-3 w-px bg-slate-200"></span>
      ${tipoBadge(s.tipo)}
    </span>
  `).join("");

  return `
  <div class="rounded-xl border border-border bg-white shadow-sm">
    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
      <div>
        <h2 class="text-sm font-semibold text-text-primary">Habilidades necesarias</h2>
        <p class="text-xs text-slate-500">Técnicas, blandas y operativas</p>
      </div>
      <span class="rounded-full bg-leoni-blue/10 px-2 py-0.5 font-mono text-xs font-bold text-leoni-blue">${HABILIDADES.length}</span>
    </div>
    <div class="flex flex-wrap gap-2 p-5">${chips}</div>
  </div>`;
}

function renderCursos(): string {
  const obligatorios = CURSOS.filter(c => c.tipo === "Obligatorio").length;
  const opcionales = CURSOS.filter(c => c.tipo === "Opcional").length;

  const rows = CURSOS.map(c => `
    <tr class="border-b border-slate-100 last:border-0">
      <td class="px-4 py-2.5">
        <div class="flex items-center gap-2">
          <span class="font-mono text-[10px] text-slate-400">${c.codigo}</span>
          <span class="text-sm font-medium text-text-primary">${escapeHtml(c.nombre)}</span>
        </div>
      </td>
      <td class="px-4 py-2.5 text-xs text-slate-600">${c.modalidad}</td>
      <td class="px-4 py-2.5 font-mono text-xs text-slate-600">${c.vigencia}</td>
      <td class="px-4 py-2.5">
        ${c.tipo === "Obligatorio"
          ? `<span class="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-800"><span class="size-1.5 rounded-full bg-blue-500" aria-hidden="true"></span>Obligatorio</span>`
          : `<span class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600"><span class="size-1.5 rounded-full bg-slate-400" aria-hidden="true"></span>Opcional</span>`
        }
      </td>
    </tr>
  `).join("");

  return `
  <div class="rounded-xl border border-border bg-white shadow-sm">
    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
      <div>
        <h2 class="text-sm font-semibold text-text-primary">Cursos obligatorios y opcionales</h2>
        <p class="text-xs text-slate-500">Reglas de elegibilidad y vigencia por curso</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-800">${obligatorios} oblig.</span>
        <span class="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-medium text-slate-600">${opcionales} opc.</span>
      </div>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-slate-200 bg-slate-50/60">
          <tr>
            <th class="px-4 py-2 text-xs font-semibold text-slate-500">Curso</th>
            <th class="px-4 py-2 text-xs font-semibold text-slate-500">Modalidad</th>
            <th class="px-4 py-2 text-xs font-semibold text-slate-500">Vigencia</th>
            <th class="px-4 py-2 text-xs font-semibold text-slate-500">Tipo</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

function renderCompetencias(): string {
  const rows = COMPETENCIAS.map(c => `
    <div class="flex items-center justify-between">
      <span class="text-sm text-text-primary">${escapeHtml(c.label)}</span>
      <div class="flex items-center gap-0.5">${starRating(c.nivel)}<span class="ml-1 font-mono text-[10px] text-slate-400">${c.nivel}/5</span></div>
    </div>
  `).join("");

  return `
  <div class="rounded-xl border border-border bg-white p-5 shadow-sm">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-sm font-semibold text-text-primary">Competencias del puesto</h2>
      <span class="rounded-full bg-leoni-blue/10 px-2 py-0.5 font-mono text-xs font-bold text-leoni-blue">${COMPETENCIAS.length}</span>
    </div>
    <div class="flex flex-col gap-3">${rows}</div>
  </div>`;
}

function renderOPLs(): string {
  const rows = OPLS.map((o, i) => `
    <div class="flex items-center justify-between gap-3 ${i ? "border-t border-slate-100" : ""} px-5 py-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-mono text-[10px] text-slate-400">${o.codigo}</span>
          <span class="font-mono text-[10px] text-slate-400">${o.version}</span>
        </div>
        <p class="mt-0.5 text-sm font-semibold text-text-primary truncate">${escapeHtml(o.nombre)}</p>
      </div>
      ${o.estado === "Vigente"
        ? `<span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 shrink-0"><span class="size-1.5 rounded-full bg-emerald-500" aria-hidden="true"></span>Vigente</span>`
        : `<span class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 shrink-0"><span class="size-1.5 rounded-full bg-amber-400" aria-hidden="true"></span>Reentren. pendiente</span>`
      }
    </div>
  `).join("");

  return `
  <div class="rounded-xl border border-border bg-white shadow-sm">
    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
      <div>
        <h2 class="text-sm font-semibold text-text-primary">OPLs vinculadas</h2>
        <p class="text-xs text-slate-500">Cambios activan reentrenamiento</p>
      </div>
      <span class="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-xs font-bold text-amber-700">${OPLS.length}</span>
    </div>
    <div>${rows}</div>
  </div>`;
}

function renderEvidencias(): string {
  const rows = EVIDENCIAS.map(e => `
    <div class="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-leoni-blue shadow-sm">
        <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold text-text-primary">${escapeHtml(e.nombre)}</p>
        <p class="text-xs text-slate-500">${escapeHtml(e.tipo)} · valida: ${escapeHtml(e.valida)}</p>
      </div>
      ${e.firma ? `<span class="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
        <svg class="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 17c2 0 3-1 3-3s-1-3-3-3 3 5 5 5 4-9 6-9 2 4 4 4 3-1 3-1"/><path d="M3 21h18"/></svg>
        Firma</span>` : ""}
    </div>
  `).join("");

  return `
  <div class="rounded-xl border border-border bg-white shadow-sm">
    <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
      <div>
        <h2 class="text-sm font-semibold text-text-primary">Evidencias obligatorias</h2>
        <p class="text-xs text-slate-500">Requisitos para acreditar el puesto</p>
      </div>
      <span class="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-600">${EVIDENCIAS.length}</span>
    </div>
    <div class="grid gap-2.5 p-5">${rows}</div>
  </div>`;
}

// ── Page mount ──────────────────────────────────────────────────────────

export function mountPerfilPuestoDetalle(container: HTMLElement, _id: number): void {
  mountAppShell(container, {
    pageTitle: `${PERFIL.codigo} · ${PERFIL.nombre}`,
    activeNav: "puestos",
    mainHtml: `
      <div class="flex min-h-0 flex-1 flex-col gap-4 py-5 sm:gap-5 sm:py-6">
        <!-- Breadcrumb -->
        <nav class="flex items-center gap-1.5 text-xs text-slate-500" aria-label="Breadcrumb">
          <a href="#/puestos" class="hover:text-leoni-blue transition">Perfiles de Puesto</a>
          <svg class="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
          <span class="font-medium text-text-primary">${PERFIL.codigo} · ${escapeHtml(PERFIL.nombre)}</span>
        </nav>

        ${renderHeader()}

        <!-- Two column layout -->
        <div class="grid gap-4 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <!-- Left column -->
          <div class="flex flex-col gap-4">
            ${renderCapacidades()}
            ${renderHabilidades()}
            ${renderCursos()}
          </div>
          <!-- Right column -->
          <div class="flex flex-col gap-4">
            ${renderCompetencias()}
            ${renderOPLs()}
            ${renderEvidencias()}
          </div>
        </div>
      </div>`,
  });
}

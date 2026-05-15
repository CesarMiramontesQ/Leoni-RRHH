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

export function mountCapacidades(container: HTMLElement): void {
  mountAppShell(container, {
    pageTitle: "Matriz de Capacidades",
    activeNav: "capacidades",
    mainHtml: levelUpStub("Matriz de capacidades", "Heatmap de nivel actual vs. requerido por colaborador."),
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

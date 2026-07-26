import { mountAppShell } from "../layouts/appShell.ts";
import { renderLevelUpBackBar } from "../navigation/levelUpBackLink.ts";
import {
  getPerfilesList,
  getAreasOptions,
  getResumenTarjetas,
  createPerfil,
  updatePerfil,
  deletePerfil,
  type PuestosFetchError,
  type AreaOption,
  type PerfilTarjetaItem,
} from "../api/puestos.ts";
import { getGradosPuesto } from "../api/gradosPuesto.ts";
import type { GradoPuesto } from "../dashboard/gradosPuesto/types.ts";
import {
  gradoIdsEntre,
  type GradoPerfilItem,
  type PerfilPuestoListItem,
  type PerfilPuestoCreatePayload,
  type PuestosFilterState,
} from "../dashboard/puestos/types.ts";
import { clearAuth } from "../auth/session.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import {
  BTN_DANGER,
  FIELD_INPUT,
  FIELD_FOCUS,
  MODAL_OVERLAY,
  MODAL_PANEL,
  pageHeading,
  SELECT_CHEVRON,
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_BTN_PRIMARY,
  RH_LISTADO_BTN_SECONDARY,
  RH_LISTADO_FOCUS_RING,
  RH_LISTADO_LABEL,
  RH_LISTADO_PAGE_OUTER_GRADIENT,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
  RH_TABLE_HEAD,
} from "../ui/uiTokens.ts";
import { talentoEyebrow, talentoKpiCard, talentoKpiGrid, talentoKpiSkeleton } from "../talento/pageKit.ts";

// ── Iconos ──────────────────────────────────────────────────────────────

const ICON_PLUS = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/></svg>`;
const ICON_SEARCH = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-5" aria-hidden="true"><path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd"/></svg>`;
const ICON_GRID = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"/></svg>`;
const ICON_USERS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>`;
const ICON_USERS_SM = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>`;
const ICON_CHART = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>`;
const ICON_ALERT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-6" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008z"/></svg>`;
const ICON_BUILDING = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 21h19.5m-2.25-18v18m-7.5-15v15m-7.5-12v12"/></svg>`;
const ICON_BOOK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path stroke-linecap="round" stroke-linejoin="round" d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>`;
const ICON_DOC = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-4" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>`;
const ICON_EDIT = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M5.433 13.917l1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z"/><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z"/></svg>`;
const ICON_TRASH = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 1 .7.8l-.5 6a.75.75 0 1 1-1.497-.124l.5-6a.75.75 0 0 1 .797-.676Zm3.64.8a.75.75 0 1 0-1.497-.124l-.5 6a.75.75 0 1 0 1.497.124l.5-6Z" clip-rule="evenodd"/></svg>`;

const BRECHAS_REF_MAX = 15;

// ── Helpers de negocio ────────────────────────────────────────────────────

type GradoLike = { id: number; nombre: string; orden: number };

function formatGradosLabel(grados: GradoLike[]): string {
  if (!grados.length) return "—";
  const sorted = [...grados].sort((a, b) => a.orden - b.orden);
  if (sorted.length === 1) return sorted[0].nombre;
  return `${sorted[0].nombre} – ${sorted[sorted.length - 1].nombre}`;
}

function gradosMinMaxIds(grados: GradoPerfilItem[]): { desde: string; hasta: string } {
  if (!grados.length) return { desde: "", hasta: "" };
  const sorted = [...grados].sort((a, b) => a.orden - b.orden);
  return { desde: String(sorted[0].id), hasta: String(sorted[sorted.length - 1].id) };
}

function resolveGradoRango(
  catalog: GradoPuesto[],
  desdeId: string,
  hastaId: string,
): GradoPuesto[] {
  const ids = gradoIdsEntre(catalog, Number(desdeId), Number(hastaId));
  if (!ids.length) return [];
  return catalog.filter((g) => ids.includes(g.id)).sort((a, b) => a.orden - b.orden);
}

function renderGradoRangoPreview(grados: GradoPuesto[]): string {
  if (!grados.length) {
    return `<div id="puestos-modal-grado-preview" class="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-3 text-sm text-text-muted" role="status">
      Selecciona el grado inicial y final. Deben ser consecutivos (ej. Grado 7 → 8 → 9).
    </div>`;
  }
  const chips = grados
    .map(
      (g, i) => `
      ${i > 0 ? `<span class="text-slate-300" aria-hidden="true">→</span>` : ""}
      <span class="inline-flex items-center rounded-lg border border-accent/20 bg-accent-light px-2.5 py-1 text-xs font-semibold text-accent">${escapeHtml(g.nombre)}</span>`,
    )
    .join("");
  const countLabel = grados.length === 1 ? "1 grado" : `${grados.length} grados`;
  return `<div id="puestos-modal-grado-preview" class="rounded-xl border border-accent/15 bg-accent-light/40 px-3 py-3" role="status">
    <div class="flex flex-wrap items-center gap-1.5">${chips}</div>
    <p class="mt-2 text-xs text-text-secondary"><span class="font-semibold text-text-primary">${countLabel}</span> · rango consecutivo listo para el perfil</p>
  </div>`;
}

function renderModalSection(
  step: number,
  title: string,
  bodyHtml: string,
  hint?: string,
): string {
  return `
    <section class="rounded-xl border border-slate-200/90 bg-slate-50/40 p-4">
      <div class="mb-3 flex items-start gap-3">
        <span class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-leoni-blue text-[11px] font-bold text-white" aria-hidden="true">${step}</span>
        <div class="min-w-0 pt-0.5">
          <h3 class="text-sm font-semibold text-text-primary">${escapeHtml(title)}</h3>
          ${hint ? `<p class="mt-0.5 text-xs leading-relaxed text-text-muted">${escapeHtml(hint)}</p>` : ""}
        </div>
      </div>
      ${bodyHtml}
    </section>`;
}

function filterItems(items: PerfilPuestoListItem[], filters: PuestosFilterState): PerfilPuestoListItem[] {
  let result = items;
  if (filters.q.trim()) {
    const q = filters.q.trim().toLowerCase();
    result = result.filter(
      (p) =>
        p.codigo.toLowerCase().includes(q) ||
        p.nombre_puesto.toLowerCase().includes(q) ||
        p.area.toLowerCase().includes(q),
    );
  }
  if (filters.area) result = result.filter((p) => p.area === filters.area);
  if (filters.grado_id) {
    result = result.filter((p) => p.grados.some((g) => String(g.id) === filters.grado_id));
  }
  return result;
}

function filterTarjetas(items: PerfilTarjetaItem[], filters: PuestosFilterState): PerfilTarjetaItem[] {
  let result = items;
  if (filters.q.trim()) {
    const q = filters.q.trim().toLowerCase();
    result = result.filter(
      (p) =>
        p.codigo.toLowerCase().includes(q) ||
        p.nombre.toLowerCase().includes(q) ||
        (p.area_nombre ?? "").toLowerCase().includes(q),
    );
  }
  if (filters.area) result = result.filter((p) => p.area_nombre === filters.area);
  if (filters.grado_id) {
    result = result.filter((p) => p.grados.some((g) => String(g.id) === filters.grado_id));
  }
  return result;
}

function hasActiveFilters(filters: PuestosFilterState): boolean {
  return Boolean(filters.q.trim() || filters.area || filters.grado_id);
}

// ── Métricas derivadas (mismos datos, sin nuevas consultas) ─────────────

type CardBenchmarks = {
  maxBrechas: number;
  minCumplimiento: number;
  maxPersonas: number;
};

function computeCardBenchmarks(tarjetas: PerfilTarjetaItem[]): CardBenchmarks {
  if (tarjetas.length === 0) return { maxBrechas: 0, minCumplimiento: 100, maxPersonas: 0 };
  return {
    maxBrechas: Math.max(...tarjetas.map((t) => t.brechas)),
    minCumplimiento: Math.min(...tarjetas.map((t) => t.cumplimiento_pct)),
    maxPersonas: Math.max(...tarjetas.map((t) => t.personas)),
  };
}

function cardPriorityClasses(p: PerfilTarjetaItem, bench: CardBenchmarks): string {
  const classes: string[] = [];
  if (bench.maxBrechas > 0 && p.brechas === bench.maxBrechas && p.brechas > 4) {
    classes.push("puestos-perfil-card--critico-brechas");
  }
  if (p.cumplimiento_pct === bench.minCumplimiento && p.cumplimiento_pct < 80) {
    classes.push("puestos-perfil-card--bajo-cumplimiento");
  }
  if (bench.maxPersonas > 0 && p.personas === bench.maxPersonas && p.personas >= 5) {
    classes.push("puestos-perfil-card--alto-headcount");
  }
  return classes.join(" ");
}

// ── Componentes visuales ───────────────────────────────────────────────

function cumplimientoBadge(pct: number, large = false): string {
  const size = large ? "px-2.5 py-1 text-sm" : "px-2 py-0.5 text-xs";
  if (pct >= 90) {
    return `<span class="puestos-cumpl-badge puestos-cumpl-badge--alto inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 ${size} font-bold tabular-nums text-emerald-800"><span class="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true"></span>${pct}%</span>`;
  }
  if (pct >= 80) {
    return `<span class="puestos-cumpl-badge puestos-cumpl-badge--medio inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 ${size} font-bold tabular-nums text-amber-800"><span class="size-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true"></span>${pct}%</span>`;
  }
  return `<span class="puestos-cumpl-badge puestos-cumpl-badge--bajo inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 ${size} font-bold tabular-nums text-red-800"><span class="size-1.5 shrink-0 rounded-full bg-red-400" aria-hidden="true"></span>${pct}%</span>`;
}

function brechasSeverity(brechas: number): { tone: string; label: string; bar: string } {
  if (brechas > 8) {
    return {
      tone: "puestos-brechas--critico",
      label: "Crítico",
      bar: "bg-red-500",
    };
  }
  if (brechas > 4) {
    return {
      tone: "puestos-brechas--alerta",
      label: "Atención",
      bar: "bg-amber-400",
    };
  }
  return {
    tone: "puestos-brechas--ok",
    label: "Controlado",
    bar: "bg-emerald-500",
  };
}

function renderBrechasBlock(brechas: number): string {
  const sev = brechasSeverity(brechas);
  const pct = Math.min(100, Math.round((brechas / BRECHAS_REF_MAX) * 100));
  return `
  <div class="puestos-brechas-block rounded-xl border border-slate-200/90 bg-slate-50/60 p-3 ${sev.tone}">
    <div class="flex items-start justify-between gap-2">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Brechas activas</p>
        <p class="mt-0.5 text-2xl font-bold tabular-nums leading-none text-text-primary">${brechas}</p>
      </div>
      <span class="rounded-full border border-current/20 bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">${sev.label}</span>
    </div>
    <div class="mt-3">
      <div class="mb-1 flex justify-between text-[10px] text-text-muted">
        <span>Intensidad vs. referencia (${BRECHAS_REF_MAX})</span>
        <span class="tabular-nums font-medium">${pct}%</span>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-slate-200/80" role="presentation">
        <div class="${sev.bar} h-2 rounded-full transition-[width] duration-300" style="width:${pct}%"></div>
      </div>
      <p class="mt-1.5 text-[10px] leading-snug text-text-muted">Requisitos (calificaciones y competencias) que no cumplen el mínimo del puesto y grado, o aún sin evaluar.</p>
    </div>
  </div>`;
}

function kpiSkeletonCard(): string {
  return talentoKpiSkeleton();
}

function renderKpiDashboard(tarjetas: PerfilTarjetaItem[]): string {
  const totalPersonas = tarjetas.reduce((s, p) => s + p.personas, 0);
  const totalBrechas = tarjetas.reduce((s, p) => s + p.brechas, 0);
  const avgCumplimiento =
    tarjetas.length > 0 ? Math.round(tarjetas.reduce((s, p) => s + p.cumplimiento_pct, 0) / tarjetas.length) : 0;
  const areas = new Set(tarjetas.map((p) => p.area_nombre).filter(Boolean));
  const brechasCritico = totalBrechas > 20;

  return talentoKpiGrid(
    [
      talentoKpiCard({
        label: "Perfiles activos",
        value: String(tarjetas.length),
        sub: `En ${areas.size} área${areas.size !== 1 ? "s" : ""}`,
        icon: ICON_GRID,
        accent: "blue",
      }),
      talentoKpiCard({
        label: "Personas vinculadas",
        value: String(totalPersonas),
        sub: "Colaboradores asignados",
        icon: ICON_USERS,
        accent: "sky",
      }),
      talentoKpiCard({
        label: "Cumplimiento promedio",
        value: `${avgCumplimiento}%`,
        sub: "Requisitos que cumplen el mínimo",
        icon: ICON_CHART,
        accent: "violet",
        valueClass: avgCumplimiento < 80 ? "text-red-700" : avgCumplimiento < 90 ? "text-amber-800" : "",
      }),
      talentoKpiCard({
        label: "Brechas totales",
        value: String(totalBrechas),
        sub: "No cumplen el mínimo o sin evaluar",
        icon: ICON_ALERT,
        accent: brechasCritico ? "red" : "amber",
        valueClass: brechasCritico ? "text-red-700" : "",
        cardClass: brechasCritico ? "border-red-200/80 bg-gradient-to-br from-red-50/40 via-white to-white" : "",
      }),
    ].join(""),
    { ariaLabel: "Indicadores de perfiles" },
  );
}

function renderViewToggle(active: "tabla" | "tarjetas"): string {
  const btn = (mode: "tarjetas" | "tabla", label: string, action: string) => {
    const isActive = active === mode;
    return `<button
      type="button"
      data-action="${action}"
      aria-pressed="${isActive}"
      class="puestos-view-toggle__btn ${isActive ? "puestos-view-toggle__btn--active" : ""}"
    >${label}</button>`;
  };
  return `
  <div class="puestos-view-toggle" role="group" aria-label="Modo de vista">
    ${btn("tarjetas", "Tarjetas", "view-tarjetas")}
    ${btn("tabla", "Tabla", "view-tabla")}
  </div>`;
}

function renderFilterActiveChips(filters: PuestosFilterState, gradosCatalog: GradoPuesto[]): string {
  const chips: string[] = [];
  if (filters.q.trim()) chips.push(`Búsqueda: “${escapeHtml(filters.q.trim())}”`);
  if (filters.area) chips.push(`Área: ${escapeHtml(filters.area)}`);
  if (filters.grado_id) {
    const label = gradosCatalog.find((g) => String(g.id) === filters.grado_id)?.nombre ?? filters.grado_id;
    chips.push(`Grado: ${escapeHtml(label)}`);
  }
  if (chips.length === 0) return "";
  return `<div class="puestos-filter-chips flex flex-wrap items-center gap-2 border-t border-slate-100/90 pt-3">
    <span class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Filtros activos</span>
    ${chips
      .map(
        (c) =>
          `<span class="inline-flex items-center rounded-full border border-blue-200/80 bg-blue-50/80 px-2.5 py-1 text-xs font-medium text-blue-900">${c}</span>`,
      )
      .join("")}
    <button type="button" data-action="puestos-clear-filters" class="${RH_LISTADO_BTN_GHOST} ml-auto text-xs">Limpiar filtros</button>
  </div>`;
}

function renderFilterBar(
  filters: PuestosFilterState,
  areas: AreaOption[],
  gradosCatalog: GradoPuesto[],
  visibleCount: number,
  totalCount: number,
): string {
  const areaOpts = areas
    .map(
      (a) =>
        `<option value="${escapeHtml(a.label)}" ${filters.area === a.label ? "selected" : ""}>${escapeHtml(a.label)}</option>`,
    )
    .join("");
  const gradoOpts = gradosCatalog
    .map(
      (g) =>
        `<option value="${g.id}" ${filters.grado_id === String(g.id) ? "selected" : ""}>${escapeHtml(g.nombre)}</option>`,
    )
    .join("");
  const hasActive = hasActiveFilters(filters);
  const resultsLine = hasActive
    ? `Mostrando <strong class="font-semibold text-text-primary tabular-nums">${visibleCount}</strong> de <strong class="tabular-nums">${totalCount}</strong> perfiles`
    : `${totalCount} perfil${totalCount !== 1 ? "es" : ""} en catálogo`;

  return `
  <section class="${RH_LISTADO_SURFACE} puestos-filters p-4 sm:p-5" aria-label="Filtros de perfiles">
    <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="text-sm font-semibold text-text-primary">Buscar y filtrar</h2>
        <p class="mt-0.5 text-xs text-text-muted">Localiza perfiles por código, nombre, área o grado.</p>
      </div>
      <p class="text-xs text-text-muted" aria-live="polite">${resultsLine}</p>
    </div>
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(10rem,1fr)_minmax(10rem,1fr)] lg:items-end">
      <div class="min-w-0">
        <label for="puestos-search" class="${RH_LISTADO_LABEL}">Buscar</label>
        <div class="relative">
          <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">${ICON_SEARCH}</span>
          <input
            id="puestos-search"
            data-action="search"
            type="search"
            autocomplete="off"
            placeholder="Código, nombre o área…"
            value="${escapeHtml(filters.q)}"
            class="block w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-text-primary shadow-sm placeholder:text-text-muted ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}"
          />
        </div>
      </div>
      <div class="min-w-0">
        <label for="puestos-filter-area" class="${RH_LISTADO_LABEL}">Área</label>
        <div class="grid grid-cols-1">
          <select id="puestos-filter-area" data-action="filter-area" class="${RH_LISTADO_SELECT} col-start-1 row-start-1 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}">
            <option value="" ${filters.area === "" ? "selected" : ""}>Todas las áreas</option>
            ${areaOpts}
          </select>
          ${SELECT_CHEVRON}
        </div>
      </div>
      <div class="min-w-0">
        <label for="puestos-filter-grado" class="${RH_LISTADO_LABEL}">Grado</label>
        <div class="grid grid-cols-1">
          <select id="puestos-filter-grado" data-action="filter-grado" class="${RH_LISTADO_SELECT} col-start-1 row-start-1 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}">
            <option value="" ${filters.grado_id === "" ? "selected" : ""}>Todos los grados</option>
            ${gradoOpts}
          </select>
          ${SELECT_CHEVRON}
        </div>
      </div>
    </div>
    ${hasActive ? `<span class="mt-3 inline-flex size-2 rounded-full bg-leoni-blue" aria-hidden="true" title="Hay filtros activos"></span>` : ""}
    ${renderFilterActiveChips(filters, gradosCatalog)}
  </section>`;
}

function renderEmptyCatalogo(showCreate: boolean): string {
  return `
  <div class="puestos-empty-state flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-slate-50/90 via-white to-blue-50/20 px-6 py-14 text-center">
    <span class="flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">${ICON_GRID}</span>
    <p class="mt-4 text-sm font-semibold text-text-primary">Sin perfiles de puesto</p>
    <p class="mt-2 max-w-md text-sm leading-relaxed text-text-muted">
      Crea el primer perfil para estructurar competencias, cursos y evidencias por posición organizacional.
    </p>
    ${
      showCreate
        ? `<button type="button" data-action="create" class="${RH_LISTADO_BTN_PRIMARY} mt-6">${ICON_PLUS} Nuevo perfil</button>`
        : ""
    }
  </div>`;
}

function renderNoResults(): string {
  return `
  <div class="puestos-empty-state flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-slate-200/90 bg-slate-50/50 px-6 py-12 text-center">
    <span class="flex size-12 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200/80">${ICON_SEARCH}</span>
    <p class="mt-4 text-sm font-semibold text-text-primary">Sin coincidencias</p>
    <p class="mt-1.5 max-w-sm text-sm leading-relaxed text-text-muted">No hay perfiles que coincidan con los filtros actuales. Prueba otro criterio o limpia los filtros.</p>
    <button type="button" data-action="puestos-clear-filters" class="${RH_LISTADO_BTN_GHOST} mt-5">Limpiar filtros</button>
  </div>`;
}

function renderCardGrid(tarjetas: PerfilTarjetaItem[], totalSource: number): string {
  if (totalSource === 0) return renderEmptyCatalogo(true);
  if (tarjetas.length === 0) return renderNoResults();

  const bench = computeCardBenchmarks(tarjetas);

  const cards = tarjetas
    .map((p) => {
      const priority = cardPriorityClasses(p, bench);
      const cumplLabel = p.cumplimiento_pct >= 90 ? "Alto" : p.cumplimiento_pct >= 80 ? "Aceptable" : "Bajo";
      return `
    <article class="puestos-perfil-card flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)] ${priority}">
      <header class="flex items-start justify-between gap-3 border-b border-slate-100/90 pb-3">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-600">${escapeHtml(p.codigo)}</span>
            ${
              p.grados.length
                ? `<span class="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700"><span class="text-[9px] font-semibold uppercase tracking-wide text-blue-500">Grado</span>${escapeHtml(formatGradosLabel(p.grados))}</span>`
                : ""
            }
          </div>
          <h3 class="mt-2 text-base font-semibold leading-snug text-text-primary">${escapeHtml(p.nombre)}</h3>
          <p class="mt-1 flex items-center gap-1.5 text-xs text-text-muted">
            <span class="text-slate-400">${ICON_BUILDING}</span>
            <span class="truncate">${escapeHtml(p.area_nombre ?? "Sin área")}</span>
          </p>
        </div>
        <div class="flex shrink-0 flex-col items-end gap-1">
          <span class="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Cumplimiento</span>
          ${cumplimientoBadge(p.cumplimiento_pct, true)}
          <span class="text-[10px] text-text-muted">${cumplLabel}</span>
        </div>
      </header>

      <div class="grid grid-cols-3 gap-2">
        <div class="puestos-metric-pill rounded-lg border border-slate-100 bg-slate-50/50 px-2 py-2 text-center">
          <span class="mx-auto flex justify-center text-slate-400">${ICON_USERS_SM}</span>
          <p class="mt-1 text-lg font-bold tabular-nums text-text-primary">${p.personas}</p>
          <p class="text-[10px] font-medium text-text-muted">Personas</p>
        </div>
        <div class="puestos-metric-pill rounded-lg border border-slate-100 bg-slate-50/50 px-2 py-2 text-center">
          <span class="mx-auto flex justify-center text-slate-400">${ICON_BOOK}</span>
          <p class="mt-1 text-lg font-bold tabular-nums text-text-primary">${p.cursos}</p>
          <p class="text-[10px] font-medium text-text-muted">Cursos</p>
        </div>
        <div class="puestos-metric-pill rounded-lg border border-slate-100 bg-slate-50/50 px-2 py-2 text-center">
          <span class="mx-auto flex justify-center text-slate-400">${ICON_DOC}</span>
          <p class="mt-1 text-lg font-bold tabular-nums text-text-primary">${p.evidencias}</p>
          <p class="text-[10px] font-medium text-text-muted">Evidencias</p>
        </div>
      </div>

      ${renderBrechasBlock(p.brechas)}

      <footer class="mt-auto flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row">
        <a href="#/puestos/${p.id}" class="puestos-card-btn puestos-card-btn--primary flex-1">Ver puesto</a>
        <a href="#/puestos/${p.id}/empleados" class="puestos-card-btn puestos-card-btn--secondary flex-1">Ver empleados</a>
      </footer>
    </article>`;
    })
    .join("");

  return `<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">${cards}</div>`;
}

function renderTable(items: PerfilPuestoListItem[], totalSource: number): string {
  if (totalSource === 0) return renderEmptyCatalogo(true);
  if (items.length === 0) return renderNoResults();

  const rows = items
    .map(
      (p) => `
    <tr class="puestos-table-row">
      <td class="whitespace-nowrap px-4 py-3.5 text-sm font-semibold tabular-nums text-text-primary">${escapeHtml(p.codigo)}</td>
      <td class="px-4 py-3.5 text-sm font-medium text-text-primary">${escapeHtml(p.nombre_puesto)}</td>
      <td class="px-4 py-3.5 text-sm text-text-secondary">${escapeHtml(p.area)}</td>
      <td class="px-4 py-3.5 text-sm text-text-secondary">${escapeHtml(formatGradosLabel(p.grados))}</td>
      <td class="whitespace-nowrap px-4 py-3.5 text-sm tabular-nums text-text-muted">${escapeHtml(p.version)}</td>
      <td class="px-3 py-3 align-middle">
        <div class="flex items-center justify-end gap-1">
          <button type="button" data-action="edit" data-id="${p.id}" class="puestos-row-action" title="Editar perfil" aria-label="Editar ${escapeHtml(p.nombre_puesto)}">${ICON_EDIT}</button>
          <button type="button" data-action="delete" data-id="${p.id}" class="puestos-row-action puestos-row-action--danger" title="Eliminar perfil" aria-label="Eliminar ${escapeHtml(p.nombre_puesto)}">${ICON_TRASH}</button>
        </div>
      </td>
    </tr>`,
    )
    .join("");

  return `
  <section class="${RH_LISTADO_SURFACE} overflow-hidden p-0" aria-label="Tabla de perfiles de puesto">
    <div class="puestos-table-scroll overflow-x-auto overflow-y-auto">
      <table class="puestos-table min-w-[700px] w-full border-collapse text-left">
        <thead class="${RH_TABLE_HEAD}">
          <tr>
            <th scope="col" class="px-4 py-3.5 text-left">Código</th>
            <th scope="col" class="px-4 py-3.5 text-left">Nombre</th>
            <th scope="col" class="px-4 py-3.5 text-left">Área</th>
            <th scope="col" class="px-4 py-3.5 text-left">Grados</th>
            <th scope="col" class="px-4 py-3.5 text-left">Versión</th>
            <th scope="col" class="px-3 py-3.5 text-right"><span class="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100/90">${rows}</tbody>
      </table>
    </div>
  </section>`;
}

function renderModal(
  mode: "create" | "edit",
  values: {
    codigo: string;
    nombre_puesto: string;
    area: string;
    grado_desde_id: string;
    grado_hasta_id: string;
  },
  saving: boolean,
  areas: AreaOption[] = [],
  gradosCatalog: GradoPuesto[] = [],
): string {
  const title = mode === "create" ? "Nuevo perfil de puesto" : "Editar perfil de puesto";
  const subtitle =
    mode === "create"
      ? "Crea la ficha base: identidad, área y rango de grados."
      : "Actualiza los datos base del perfil. Los grados en uso no se pueden quitar.";
  const submitLabel = saving ? "Guardando…" : mode === "create" ? "Crear perfil" : "Guardar cambios";
  const rangoPreview = resolveGradoRango(gradosCatalog, values.grado_desde_id, values.grado_hasta_id);
  const gradoOptsPlain = (selectedId: string) =>
    gradosCatalog
      .map(
        (g) =>
          `<option value="${g.id}" ${selectedId === String(g.id) ? "selected" : ""}>${escapeHtml(g.nombre)}</option>`,
      )
      .join("");
  const sinGrados = gradosCatalog.length === 0;

  return `
  <div data-action="modal-backdrop" class="puestos-modal-backdrop ${MODAL_OVERLAY}">
    <div class="puestos-modal-panel ${MODAL_PANEL} max-w-2xl max-h-[92vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="puestos-modal-title">
      <div class="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-6 py-5 backdrop-blur-sm">
        <div class="flex items-start gap-3">
          <span class="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-light text-accent" aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="currentColor" class="size-5"><path fill-rule="evenodd" d="M4.25 2A2.25 2.25 0 0 0 2 4.25v11.5A2.25 2.25 0 0 0 4.25 18h11.5A2.25 2.25 0 0 0 18 15.75V4.25A2.25 2.25 0 0 0 15.75 2H4.25ZM6 6.75A.75.75 0 0 1 6.75 6h6.5a.75.75 0 0 1 0 1.5h-6.5A.75.75 0 0 1 6 6.75ZM6.75 9a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5ZM6 12.75a.75.75 0 0 1 .75-.75h3.5a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1-.75-.75Z" clip-rule="evenodd"/></svg>
          </span>
          <div class="min-w-0">
            <h2 id="puestos-modal-title" class="text-lg font-semibold tracking-tight text-text-primary">${title}</h2>
            <p class="mt-1 text-sm leading-relaxed text-text-muted">${subtitle}</p>
          </div>
        </div>
      </div>
      <form data-action="modal-form" class="flex flex-col gap-4 px-6 py-5">
        ${renderModalSection(
          1,
          "Identidad del puesto",
          `<div class="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,10rem)_1fr]">
            <div>
              <label for="puestos-modal-codigo" class="${RH_LISTADO_LABEL}">Código <span class="text-red-600" aria-hidden="true">*</span></label>
              <input id="puestos-modal-codigo" name="codigo" type="text" required placeholder="OP-PROD-01" maxlength="20" value="${escapeHtml(values.codigo)}"
                data-action="modal-codigo-input" autocomplete="off" spellcheck="false" class="${FIELD_INPUT} font-mono text-sm uppercase tracking-wide" />
              <p class="mt-1 text-[11px] text-text-muted">Se guarda en mayúsculas.</p>
            </div>
            <div>
              <label for="puestos-modal-nombre" class="${RH_LISTADO_LABEL}">Nombre del puesto <span class="text-red-600" aria-hidden="true">*</span></label>
              <input id="puestos-modal-nombre" name="nombre_puesto" type="text" required placeholder="Ej. Ingeniero de Mantenimiento" value="${escapeHtml(values.nombre_puesto)}"
                class="${FIELD_INPUT}" />
              <p class="mt-1 text-[11px] text-text-muted">Debe ser único dentro del área.</p>
            </div>
          </div>`,
          "Cómo se identifica este perfil en el catálogo.",
        )}

        ${renderModalSection(
          2,
          "Organización",
          `<div>
            <label for="puestos-modal-area" class="${RH_LISTADO_LABEL}">Área <span class="text-red-600" aria-hidden="true">*</span></label>
            <div class="grid grid-cols-1">
              <select id="puestos-modal-area" name="area" required class="${RH_LISTADO_SELECT} col-start-1 row-start-1 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}">
                <option value="">Seleccionar área…</option>
                ${areas.map((a) => `<option value="${a.id}" ${values.area === a.label ? "selected" : ""}>${escapeHtml(a.label)}</option>`).join("")}
              </select>
              ${SELECT_CHEVRON}
            </div>
          </div>`,
          "Área organizacional a la que pertenece el perfil.",
        )}

        ${renderModalSection(
          3,
          "Rango de grados",
          sinGrados
            ? `<div class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900" role="alert">
                No hay grados configurados. Créalos primero en <a href="#/puestos/ajustes" class="font-semibold text-accent underline">Ajustes de puesto</a>.
              </div>`
            : `<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label for="puestos-modal-grado-desde" class="${RH_LISTADO_LABEL}">Desde <span class="text-red-600" aria-hidden="true">*</span></label>
                  <div class="grid grid-cols-1">
                    <select id="puestos-modal-grado-desde" name="grado_desde_id" data-action="modal-grado-change" required class="${RH_LISTADO_SELECT} col-start-1 row-start-1 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}">
                      <option value="" disabled ${!values.grado_desde_id ? "selected" : ""}>Grado inicial…</option>
                      ${gradoOptsPlain(values.grado_desde_id)}
                    </select>
                    ${SELECT_CHEVRON}
                  </div>
                </div>
                <div>
                  <label for="puestos-modal-grado-hasta" class="${RH_LISTADO_LABEL}">Hasta <span class="text-red-600" aria-hidden="true">*</span></label>
                  <div class="grid grid-cols-1">
                    <select id="puestos-modal-grado-hasta" name="grado_hasta_id" data-action="modal-grado-change" required class="${RH_LISTADO_SELECT} col-start-1 row-start-1 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}">
                      <option value="" disabled ${!values.grado_hasta_id ? "selected" : ""}>Grado final…</option>
                      ${gradoOptsPlain(values.grado_hasta_id)}
                    </select>
                    ${SELECT_CHEVRON}
                  </div>
                </div>
              </div>
              <div class="mt-3">${renderGradoRangoPreview(rangoPreview)}</div>
              <p class="mt-2 text-xs leading-relaxed text-text-muted">El rango debe ser consecutivo. Un grado no puede repetirse en otro perfil de la misma área.</p>`,
          "Progresión consecutiva que cubre este perfil.",
        )}

        <div class="sticky bottom-0 -mx-6 mt-1 flex flex-col-reverse gap-2 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur-sm sm:flex-row sm:justify-end">
          <button type="button" data-action="modal-cancel" class="${RH_LISTADO_BTN_SECONDARY} w-full sm:w-auto">Cancelar</button>
          <button type="submit" class="${RH_LISTADO_BTN_PRIMARY} w-full sm:w-auto" ${saving || sinGrados ? "disabled" : ""}>${submitLabel}</button>
        </div>
      </form>
    </div>
  </div>`;
}

function renderDeleteConfirm(nombre: string, saving: boolean): string {
  return `
  <div data-action="modal-backdrop" class="puestos-modal-backdrop ${MODAL_OVERLAY}">
    <div class="puestos-modal-panel ${MODAL_PANEL} max-w-sm" role="alertdialog" aria-modal="true" aria-labelledby="puestos-delete-title">
      <div class="border-b border-slate-100 px-6 py-5">
        <h2 id="puestos-delete-title" class="text-lg font-semibold text-text-primary">Eliminar perfil</h2>
      </div>
      <div class="px-6 py-4">
        <p class="text-sm leading-relaxed text-text-secondary">
          Esta acción eliminará permanentemente el perfil <strong class="text-text-primary">${escapeHtml(nombre)}</strong>. No se puede deshacer.
        </p>
      </div>
      <div class="flex flex-col-reverse gap-2 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-end">
        <button type="button" data-action="modal-cancel" class="${RH_LISTADO_BTN_SECONDARY} w-full sm:w-auto">Cancelar</button>
        <button type="button" data-action="confirm-delete" class="${BTN_DANGER} w-full sm:w-auto" ${saving ? "disabled" : ""}>
          ${saving ? "Eliminando…" : "Eliminar"}
        </button>
      </div>
    </div>
  </div>`;
}

function renderLoading(): string {
  return `
  <div class="${RH_LISTADO_PAGE_OUTER_GRADIENT}" aria-busy="true">
    ${renderLevelUpBackBar()}
    <div class="h-16 w-full max-w-2xl animate-pulse rounded-xl bg-slate-100/90"></div>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">${kpiSkeletonCard()}${kpiSkeletonCard()}${kpiSkeletonCard()}${kpiSkeletonCard()}</div>
    <div class="h-32 animate-pulse rounded-2xl bg-white"></div>
    <div class="h-64 animate-pulse rounded-2xl bg-white"></div>
  </div>`;
}

function renderError(message: string): string {
  return `
  <div class="${RH_LISTADO_PAGE_OUTER_GRADIENT}">
    ${renderLevelUpBackBar()}
    <div class="flex min-h-[280px] items-center justify-center rounded-2xl border border-red-200/80 bg-gradient-to-br from-red-50/80 via-white to-white px-6 py-14 text-center" role="alert">
      <div class="max-w-md">
        <p class="text-base font-semibold text-text-primary">Error al cargar perfiles</p>
        <p class="mt-2 text-sm text-text-secondary">${escapeHtml(message)}</p>
        <button data-action="retry" type="button" class="${RH_LISTADO_BTN_SECONDARY} mt-4">Reintentar</button>
      </div>
    </div>
  </div>`;
}

function renderPageHeader(): string {
  const actions = `
    <a href="#/puestos/ajustes" class="${RH_LISTADO_BTN_SECONDARY} w-full sm:w-auto text-center">Ajustes</a>
    <button type="button" data-action="create" class="${RH_LISTADO_BTN_PRIMARY} puestos-btn-nuevo w-full sm:w-auto">${ICON_PLUS} Nuevo perfil</button>`;
  return `${talentoEyebrow()}
  ${pageHeading(
    "Perfiles de Puesto",
    "Vista ejecutiva del catálogo de posiciones: cumplimiento, brechas y colaboradores vinculados por perfil.",
    actions,
  )}`;
}

// ── Page mount ───────────────────────────────────────────────────────────

export function mountPuestos(container: HTMLElement, signal: AbortSignal): void {
  let allItems: PerfilPuestoListItem[] = [];
  let tarjetasData: PerfilTarjetaItem[] = [];
  let areasOptions: AreaOption[] = [];
  let gradosCatalog: GradoPuesto[] = [];
  let status: "loading" | "ready" | "error" = "loading";
  let errorMessage = "";
  const filters: PuestosFilterState = { q: "", area: "", grado_id: "" };
  let viewMode: "tabla" | "tarjetas" = "tarjetas";

  let modalMode: "create" | "edit" | "delete" | null = null;
  let modalSaving = false;
  let modalFocusOnPaint = false;
  let editingId: number | null = null;
  let editingValues = {
    codigo: "",
    nombre_puesto: "",
    area: "",
    grado_desde_id: "",
    grado_hasta_id: "",
  };
  let deletingItem: PerfilPuestoListItem | null = null;

  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  mountAppShell(container, {
    pageTitle: "Perfiles de Puesto",
    activeNav: "puestos",
    mainClass: "py-5 sm:py-6",
    mainHtml: `
      <div id="puestos-page-root" class="flex min-h-0 flex-1 flex-col">
        <div id="puestos-inner"></div>
        <div id="puestos-modal-host"></div>
      </div>`,
  });

  const pageRoot = container.querySelector("#puestos-page-root") as HTMLElement | null;
  const innerEl = (): HTMLElement | null => container.querySelector("#puestos-inner");
  const modalHost = (): HTMLElement | null => container.querySelector("#puestos-modal-host");

  function clearFilters(): void {
    filters.q = "";
    filters.area = "";
    filters.grado_id = "";
    paint();
  }

  function paint(): void {
    const inner = innerEl();
    if (!inner) return;

    if (status === "loading") {
      inner.innerHTML = renderLoading();
      return;
    }
    if (status === "error") {
      inner.innerHTML = renderError(errorMessage);
      return;
    }

    const isTarjetas = viewMode === "tarjetas";
    const sourceTotal = isTarjetas ? tarjetasData.length : allItems.length;
    const filteredTarjetas = filterTarjetas(tarjetasData, filters);
    const filteredItems = filterItems(allItems, filters);
    const filtered = isTarjetas ? filteredTarjetas : filteredItems;

    const mainContent = isTarjetas
      ? `
        ${renderKpiDashboard(filteredTarjetas)}
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          ${renderViewToggle(viewMode)}
        </div>
        ${renderCardGrid(filteredTarjetas, sourceTotal)}`
      : `
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          ${renderViewToggle(viewMode)}
        </div>
        ${renderTable(filteredItems, sourceTotal)}`;

    inner.innerHTML = `
      <div id="puestos-root" class="${RH_LISTADO_PAGE_OUTER_GRADIENT}">
        ${renderLevelUpBackBar()}
        ${renderPageHeader()}
        ${renderFilterBar(filters, areasOptions, gradosCatalog, filtered.length, sourceTotal)}
        <div class="flex flex-col gap-4 sm:gap-5">${mainContent}</div>
      </div>`;
  }

  function paintModal(): void {
    const host = modalHost();
    if (!host) return;
    if (modalMode === "create" || modalMode === "edit") {
      host.innerHTML = renderModal(modalMode, editingValues, modalSaving, areasOptions, gradosCatalog);
      if (modalFocusOnPaint) {
        modalFocusOnPaint = false;
        queueMicrotask(() => {
          const focusId =
            modalMode === "create" && !editingValues.nombre_puesto
              ? "#puestos-modal-nombre"
              : "#puestos-modal-codigo";
          host.querySelector<HTMLInputElement>(focusId)?.focus();
        });
      }
    } else if (modalMode === "delete" && deletingItem) {
      host.innerHTML = renderDeleteConfirm(deletingItem.nombre_puesto, modalSaving);
    } else {
      host.innerHTML = "";
    }
  }

  function defaultGradoIds(): { desde: string; hasta: string } {
    if (!gradosCatalog.length) return { desde: "", hasta: "" };
    const first = String(gradosCatalog[0].id);
    return { desde: first, hasta: first };
  }

  function syncGradoPreviewFromForm(form: HTMLFormElement): void {
    const desde = String(new FormData(form).get("grado_desde_id") ?? "");
    const hasta = String(new FormData(form).get("grado_hasta_id") ?? "");
    editingValues.grado_desde_id = desde;
    editingValues.grado_hasta_id = hasta;
    const preview = form.querySelector("#puestos-modal-grado-preview");
    if (preview) {
      preview.outerHTML = renderGradoRangoPreview(resolveGradoRango(gradosCatalog, desde, hasta));
    }
  }

  function closeModal(): void {
    modalMode = null;
    modalSaving = false;
    editingId = null;
    deletingItem = null;
    editingValues = {
      codigo: "",
      nombre_puesto: "",
      area: "",
      grado_desde_id: "",
      grado_hasta_id: "",
    };
    paintModal();
  }

  async function loadData(): Promise<void> {
    status = "loading";
    paint();
    try {
      const [items, areas, tarjetas, grados] = await Promise.all([
        getPerfilesList(),
        getAreasOptions(),
        getResumenTarjetas(),
        getGradosPuesto({ page_size: 200 }),
      ]);
      allItems = items;
      areasOptions = areas;
      tarjetasData = tarjetas;
      gradosCatalog = grados;
      status = "ready";
      paint();
    } catch (e: unknown) {
      const err = e as PuestosFetchError;
      if (err.status === 401) {
        clearAuth();
        void import("../shellRouter.ts").then(({ abortAuthenticatedShell }) => {
          abortAuthenticatedShell();
          void import("./login.ts").then(({ mountLogin }) => mountLogin(container));
        });
        return;
      }
      status = "error";
      errorMessage = err.detail || "Error de conexion.";
      paint();
    }
  }

  if (pageRoot) {
    pageRoot.addEventListener(
      "click",
      (e) => {
        const t = e.target as HTMLElement;
        const actionEl = t.closest<HTMLElement>("[data-action]");
        if (!actionEl) return;
        const action = actionEl.getAttribute("data-action");

        switch (action) {
          case "create": {
            modalMode = "create";
            editingId = null;
            const defaults = defaultGradoIds();
            editingValues = {
              codigo: "",
              nombre_puesto: "",
              area: "",
              grado_desde_id: defaults.desde,
              grado_hasta_id: defaults.hasta,
            };
            modalFocusOnPaint = true;
            paintModal();
            break;
          }
          case "puestos-clear-filters":
            clearFilters();
            break;
          case "edit": {
            const id = Number.parseInt(actionEl.getAttribute("data-id") ?? "", 10);
            if (Number.isNaN(id)) return;
            const item = allItems.find((p) => p.id === id);
            if (!item) return;
            modalMode = "edit";
            editingId = id;
            {
              const rango = gradosMinMaxIds(item.grados);
              editingValues = {
                codigo: item.codigo,
                nombre_puesto: item.nombre_puesto,
                area: item.area,
                grado_desde_id: rango.desde,
                grado_hasta_id: rango.hasta,
              };
            }
            modalFocusOnPaint = true;
            paintModal();
            break;
          }
          case "delete": {
            const id = Number.parseInt(actionEl.getAttribute("data-id") ?? "", 10);
            if (Number.isNaN(id)) return;
            const item = allItems.find((p) => p.id === id);
            if (!item) return;
            modalMode = "delete";
            deletingItem = item;
            paintModal();
            break;
          }
          case "modal-cancel":
            closeModal();
            break;
          case "modal-backdrop":
            if (t === actionEl) closeModal();
            break;
          case "confirm-delete":
            if (!deletingItem || modalSaving) return;
            void handleDelete();
            break;
          case "view-tarjetas":
            viewMode = "tarjetas";
            paint();
            break;
          case "view-tabla":
            viewMode = "tabla";
            paint();
            break;
          case "retry":
            void loadData();
            break;
        }
      },
      { signal },
    );

    pageRoot.addEventListener(
      "submit",
      (e) => {
        const form = (e.target as HTMLElement).closest<HTMLFormElement>("[data-action='modal-form']");
        if (!form) return;
        e.preventDefault();
        if (modalSaving) return;
        void handleSave(form);
      },
      { signal },
    );

    pageRoot.addEventListener(
      "change",
      (e) => {
        const t = e.target as HTMLElement;
        const action = t.getAttribute("data-action");
        if (action === "filter-area") {
          filters.area = (t as HTMLSelectElement).value;
          paint();
        } else if (action === "filter-grado") {
          filters.grado_id = (t as HTMLSelectElement).value;
          paint();
        } else if (action === "modal-grado-change") {
          const form = t.closest<HTMLFormElement>("[data-action='modal-form']");
          if (!form) return;
          const desdeEl = form.querySelector<HTMLSelectElement>("#puestos-modal-grado-desde");
          const hastaEl = form.querySelector<HTMLSelectElement>("#puestos-modal-grado-hasta");
          if (!desdeEl || !hastaEl) return;
          // Si eligen solo "desde", alinear "hasta" automáticamente.
          if (t.id === "puestos-modal-grado-desde" && (!hastaEl.value || hastaEl.value === "")) {
            hastaEl.value = desdeEl.value;
          }
          // Si "hasta" queda antes que "desde" por orden, igualar.
          const desdeG = gradosCatalog.find((g) => String(g.id) === desdeEl.value);
          const hastaG = gradosCatalog.find((g) => String(g.id) === hastaEl.value);
          if (desdeG && hastaG && hastaG.orden < desdeG.orden) {
            if (t.id === "puestos-modal-grado-desde") hastaEl.value = desdeEl.value;
            else desdeEl.value = hastaEl.value;
          }
          syncGradoPreviewFromForm(form);
        }
      },
      { signal },
    );

    pageRoot.addEventListener(
      "input",
      (e) => {
        const t = e.target as HTMLElement;
        if (t.getAttribute("data-action") === "modal-codigo-input" && t instanceof HTMLInputElement) {
          const start = t.selectionStart;
          const end = t.selectionEnd;
          t.value = t.value.toUpperCase();
          if (start != null && end != null) t.setSelectionRange(start, end);
          editingValues.codigo = t.value;
          return;
        }
        if (t.getAttribute("data-action") !== "search") return;
        clearTimeout(searchTimer);
        searchTimer = window.setTimeout(() => {
          filters.q = (t as HTMLInputElement).value;
          paint();
        }, 250);
      },
      { signal },
    );

    pageRoot.addEventListener(
      "keydown",
      (e) => {
        if ((e as KeyboardEvent).key === "Escape" && modalMode) closeModal();
      },
      { signal },
    );
  }

  function showModalError(message: string): void {
    const panel = container.querySelector(".puestos-modal-panel");
    if (!panel) return;
    panel.querySelector("[data-modal-error]")?.remove();
    const header = panel.querySelector(".sticky, .border-b");
    const anchor = header ?? panel.firstElementChild;
    if (!anchor) return;
    anchor.insertAdjacentHTML(
      "afterend",
      `<p data-modal-error class="mx-6 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">${escapeHtml(message)}</p>`,
    );
  }

  async function handleSave(form: HTMLFormElement): Promise<void> {
    const data = new FormData(form);
    const areaValue = (data.get("area") as string).trim();
    const areaId = areaValue ? Number(areaValue) : NaN;
    const areaLabel = areasOptions.find((a) => a.id === areaId)?.label ?? "";
    const desdeRaw = (data.get("grado_desde_id") as string).trim();
    const hastaRaw = (data.get("grado_hasta_id") as string).trim();
    const desdeId = Number(desdeRaw);
    const hastaId = Number(hastaRaw);
    const grado_ids = gradoIdsEntre(gradosCatalog, desdeId, hastaId);

    // Persistir valores actuales por si re-pintamos el modal.
    editingValues = {
      codigo: String(data.get("codigo") ?? "").trim(),
      nombre_puesto: String(data.get("nombre_puesto") ?? "").trim(),
      area: areaLabel,
      grado_desde_id: desdeRaw,
      grado_hasta_id: hastaRaw,
    };

    if (!editingValues.codigo || !editingValues.nombre_puesto) {
      showModalError("Completa el código y el nombre del puesto.");
      return;
    }
    if (Number.isNaN(areaId) || !areaLabel) {
      showModalError("Selecciona un área.");
      return;
    }
    if (!desdeRaw || !hastaRaw || Number.isNaN(desdeId) || Number.isNaN(hastaId) || grado_ids.length === 0) {
      showModalError("Selecciona un rango de grados válido (desde / hasta).");
      return;
    }

    const payload: PerfilPuestoCreatePayload = {
      codigo: editingValues.codigo.toUpperCase(),
      nombre_puesto: editingValues.nombre_puesto,
      area: areaLabel,
      area_id: areaId,
      grado_ids,
    };

    modalSaving = true;
    paintModal();

    try {
      if (modalMode === "create") {
        await createPerfil(payload);
      } else if (modalMode === "edit" && editingId != null) {
        await updatePerfil(editingId, payload);
      }
      closeModal();
      await loadData();
    } catch (e: unknown) {
      const err = e as PuestosFetchError;
      modalSaving = false;
      paintModal();
      showModalError(err.detail || "Error al guardar");
    }
  }

  async function handleDelete(): Promise<void> {
    if (!deletingItem) return;
    modalSaving = true;
    paintModal();
    try {
      await deletePerfil(deletingItem.id);
      closeModal();
      await loadData();
    } catch (e: unknown) {
      const err = e as PuestosFetchError;
      modalSaving = false;
      paintModal();
      const titleEl = container.querySelector("#puestos-delete-title");
      if (titleEl) {
        titleEl.closest(".puestos-modal-panel")?.querySelector("[data-modal-error]")?.remove();
        titleEl.parentElement?.insertAdjacentHTML(
          "afterend",
          `<p data-modal-error class="mx-6 -mt-2 mb-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">${escapeHtml(err.detail || "Error al eliminar")}</p>`,
        );
      }
    }
  }

  signal.addEventListener("abort", () => {
    clearTimeout(searchTimer);
  });

  void loadData();
}

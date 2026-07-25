/**
 * Página del módulo Operaciones (`#/operaciones`): analítica de cobertura y
 * polivalencia por área. Solo lectura, gestión RH/jefatura. Reúsa los datos de
 * las evaluaciones de competencia (la misma fuente que la Matriz de
 * multihabilidades). Patrón de diseño de `pages/metas.ts`: mountAppShell,
 * pageHeading, skeletonBlock/errorState, per-mount AbortController, event
 * delegation. Solo tokens de `ui/uiTokens.ts`.
 */
import { mountAppShell } from "../layouts/appShell.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import {
  badgeApproved,
  badgeCancelled,
  badgePending,
  badgeRejected,
  BTN_SECONDARY,
  errorState,
  FORM_LABEL,
  FORM_SELECT,
  pageHeading,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_SURFACE,
  RH_TABLE_HEAD,
  SELECT_CHEVRON,
  skeletonBlock,
} from "../ui/uiTokens.ts";
import {
  descargarCoberturaAreaExcel,
  getAreas,
  getCoberturaArea,
  type AreaResumen,
  type CoberturaArea,
  type CompetenciaCobertura,
  type Critica,
  type Semaforo,
  type Severidad,
} from "../api/operaciones.ts";

let mountAbort: AbortController | null = null;

interface OperacionesState {
  areas: AreaResumen[];
  areaId: number | null;
  cobertura: CoberturaArea | null;
  loadingAreas: boolean;
  loadingCobertura: boolean;
  error: string | null;
  exporting: boolean;
}

/** Reutilizado por `pages/dashboardTalento.ts` (mismo semáforo conceptual: verde/ámbar/rojo). */
export function semaforoBadge(sem: Semaforo, label: string): string {
  if (sem === "verde") return badgeApproved(label);
  if (sem === "ambar") return badgePending(label);
  return badgeRejected(label);
}

function severidadChip(sev: Severidad): string {
  if (sev === "hueco") return badgeRejected("Hueco total");
  if (sev === "punto_unico") return badgePending("Punto único");
  return badgeCancelled("OK");
}

const barTone: Record<Semaforo, string> = {
  verde: "bg-emerald-500",
  ambar: "bg-amber-400",
  rojo: "bg-red-400",
};

function coberturaBar(c: CompetenciaCobertura): string {
  const pct = Math.max(0, Math.min(100, c.cobertura_pct));
  return `<div class="flex items-center gap-2">
    <div class="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-slate-100">
      <div class="h-full ${barTone[c.semaforo]}" style="width:${pct}%"></div>
    </div>
    <span class="tabular-nums text-xs font-semibold text-text-secondary">${pct.toFixed(0)}%</span>
  </div>`;
}

function statCard(label: string, value: string, hint?: string): string {
  return `<div class="rounded-lg border border-border ${RH_LISTADO_SURFACE} p-4">
    <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">${escapeHtml(label)}</p>
    <p class="mt-1 text-2xl font-bold tabular-nums text-text-primary">${escapeHtml(value)}</p>
    ${hint ? `<p class="mt-0.5 text-xs text-text-muted">${escapeHtml(hint)}</p>` : ""}
  </div>`;
}

export function mountOperaciones(container: HTMLElement, signal?: AbortSignal): void {
  mountAbort?.abort();
  mountAbort = new AbortController();
  const mountSignal = mountAbort.signal;
  if (signal) {
    signal.addEventListener("abort", () => mountAbort?.abort(), { once: true, signal: mountSignal });
  }

  const state: OperacionesState = {
    areas: [],
    areaId: null,
    cobertura: null,
    loadingAreas: true,
    loadingCobertura: false,
    error: null,
    exporting: false,
  };

  function renderAreaSelector(): string {
    if (state.loadingAreas) return skeletonBlock({ label: "Cargando áreas…" });
    if (!state.areas.length) {
      return `<p class="text-sm text-text-muted">No hay áreas con competencias requeridas en tu alcance.</p>`;
    }
    const opts = state.areas
      .map(
        (a) =>
          `<option value="${a.area_id}"${a.area_id === state.areaId ? " selected" : ""}>${escapeHtml(
            a.area_nombre,
          )}${a.n_criticas > 0 ? ` — ${a.n_criticas} crítica(s)` : ""}</option>`,
      )
      .join("");
    return `<div class="max-w-md">
      <label class="${FORM_LABEL}" for="op-area">Área</label>
      <div class="${SELECT_CHEVRON}">
        <select id="op-area" data-action="op-area" class="${FORM_SELECT}">${opts}</select>
      </div>
    </div>`;
  }

  function renderResumen(cob: CoberturaArea): string {
    const r = cob.resumen;
    return `<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      ${statCard(
        "Polivalencia",
        r.pol_area_pct === null ? "n/d" : `${r.pol_area_pct.toFixed(0)}%`,
        r.pol_area_pct === null ? "Sin requisitos evaluables" : "Promedio del personal",
      )}
      ${statCard("Resiliencia", `${r.resiliencia_pct.toFixed(0)}%`, "Sin punto único de falla")}
      ${statCard("Críticas", String(r.n_criticas), "Huecos + puntos únicos")}
      ${statCard("Empleados", String(r.n_empleados), "En tu alcance")}
    </div>`;
  }

  function renderCompetenciaRow(c: CompetenciaCobertura): string {
    return `<tr class="border-t border-border">
      <td class="px-3 py-2.5">
        <p class="text-sm font-medium text-text-primary">${escapeHtml(c.competencia_nombre)}</p>
        ${c.tipo_nombre ? `<p class="text-xs text-text-muted">${escapeHtml(c.tipo_nombre)}</p>` : ""}
      </td>
      <td class="px-3 py-2.5 text-center tabular-nums text-sm text-text-secondary">${c.cubren}/${c.requieren}</td>
      <td class="px-3 py-2.5 text-center tabular-nums text-sm text-text-secondary">${c.en_entrenamiento}</td>
      <td class="px-3 py-2.5">${coberturaBar(c)}</td>
      <td class="px-3 py-2.5">${c.severidad === "ok" ? semaforoBadge(c.semaforo, "OK") : severidadChip(c.severidad)}</td>
    </tr>`;
  }

  function renderCoberturaTabla(cob: CoberturaArea): string {
    if (!cob.competencias.length) {
      return `<p class="text-sm text-text-muted">Esta área no tiene competencias requeridas registradas.</p>`;
    }
    const filas = cob.competencias.map(renderCompetenciaRow).join("");
    return `<div class="overflow-x-auto rounded-lg border border-border ${RH_LISTADO_SURFACE}">
      <table class="w-full min-w-[640px] text-left">
        <thead class="${RH_TABLE_HEAD}">
          <tr>
            <th class="px-3 py-2 text-xs font-semibold">Competencia</th>
            <th class="px-3 py-2 text-center text-xs font-semibold">Cubren/Requieren</th>
            <th class="px-3 py-2 text-center text-xs font-semibold">En entrenamiento</th>
            <th class="px-3 py-2 text-xs font-semibold">Cobertura</th>
            <th class="px-3 py-2 text-xs font-semibold">Estado</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
  }

  function renderCritica(crit: Critica): string {
    const cands = crit.candidatos.length
      ? crit.candidatos
          .map(
            (cand) =>
              `<li class="flex items-center justify-between gap-3 py-1 text-sm">
                <span class="min-w-0 truncate text-text-secondary">${escapeHtml(cand.nombre)} <span class="text-text-muted">(${escapeHtml(String(cand.no_empleado))})</span></span>
                <span class="shrink-0 tabular-nums text-xs text-text-muted">Nivel ${cand.nivel_actual} → ${cand.nivel_requerido}</span>
              </li>`,
          )
          .join("")
      : `<li class="py-1 text-sm text-text-muted">Sin candidatos cercanos al requisito.</li>`;
    return `<div class="rounded-lg border border-border ${RH_LISTADO_SURFACE} p-4">
      <div class="flex items-center justify-between gap-3">
        <p class="min-w-0 truncate text-sm font-semibold text-text-primary">${escapeHtml(crit.competencia_nombre)}</p>
        ${severidadChip(crit.severidad)}
      </div>
      <p class="mt-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Candidatos a cross-training</p>
      <ul class="mt-1 divide-y divide-border">${cands}</ul>
    </div>`;
  }

  function renderCriticas(cob: CoberturaArea): string {
    if (!cob.criticas.length) {
      return `<div class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Sin competencias críticas: todas las requeridas tienen al menos 2 personas certificadas.</div>`;
    }
    return `<div class="grid grid-cols-1 gap-3 lg:grid-cols-2">${cob.criticas.map(renderCritica).join("")}</div>`;
  }

  function renderPuestos(cob: CoberturaArea): string {
    const conDatos = cob.puestos.filter((p) => p.competencias.length);
    if (!conDatos.length) return "";
    const bloques = conDatos
      .map((p) => {
        const filas = p.competencias
          .map(
            (c) =>
              `<tr class="border-t border-border">
                <td class="px-3 py-2 text-sm text-text-secondary">${escapeHtml(c.competencia_nombre)}</td>
                <td class="px-3 py-2 text-center tabular-nums text-sm text-text-secondary">${c.cubren}/${c.requieren}</td>
                <td class="px-3 py-2">${coberturaBar(c)}</td>
              </tr>`,
          )
          .join("");
        return `<details class="rounded-lg border border-border ${RH_LISTADO_SURFACE}">
          <summary class="cursor-pointer px-3 py-2.5 text-sm font-semibold text-text-primary">${escapeHtml(p.puesto_nombre)}</summary>
          <div class="overflow-x-auto border-t border-border">
            <table class="w-full min-w-[480px] text-left">
              <tbody>${filas}</tbody>
            </table>
          </div>
        </details>`;
      })
      .join("");
    return `<section class="flex flex-col gap-2">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-text-muted">Desglose por puesto</h2>
      ${bloques}
    </section>`;
  }

  function renderCoberturaBlock(): string {
    if (state.areaId == null) {
      return `<p class="text-sm text-text-muted">Elige un área para ver su cobertura.</p>`;
    }
    if (state.loadingCobertura) return skeletonBlock({ label: "Cargando cobertura…" });
    if (!state.cobertura) return "";
    const cob = state.cobertura;
    const exportLabel = state.exporting ? "Exportando…" : "Exportar Excel";
    return `<div class="flex flex-col gap-5">
      <div class="flex items-center justify-between gap-3">
        <p class="text-xs text-text-muted">Según las evaluaciones de competencia registradas.</p>
        <button type="button" data-action="op-export" class="${BTN_SECONDARY} !text-xs"${state.exporting ? " disabled" : ""}>${exportLabel}</button>
      </div>
      ${renderResumen(cob)}
      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-text-muted">Cobertura por competencia</h2>
        ${renderCoberturaTabla(cob)}
      </section>
      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-text-muted">Operaciones críticas</h2>
        ${renderCriticas(cob)}
      </section>
      ${renderPuestos(cob)}
    </div>`;
  }

  function pageContent(): string {
    const body = state.error
      ? errorState({ message: state.error, actionLabel: "Reintentar", actionAttrs: 'data-action="op-retry"' })
      : `<div class="flex flex-col gap-6">
          ${renderAreaSelector()}
          ${renderCoberturaBlock()}
        </div>`;
    return `<div class="${RH_LISTADO_PAGE_OUTER}">
      ${pageHeading("Cobertura y polivalencia", "Índice de polivalencia, cobertura por competencia y operaciones críticas por área.")}
      <div class="mt-6">${body}</div>
    </div>`;
  }

  function render(): void {
    mountAppShell(container, {
      pageTitle: "Cobertura y polivalencia",
      activeNav: "operaciones",
      mainClass: "py-5 sm:py-6",
      mainHtml: pageContent(),
    });
  }

  async function loadAreas(): Promise<void> {
    state.loadingAreas = true;
    state.error = null;
    render();
    try {
      const areas = await getAreas();
      if (mountSignal.aborted) return;
      state.areas = areas;
      state.loadingAreas = false;
      state.areaId = areas.length ? areas[0].area_id : null;
      render();
      if (state.areaId != null) await loadCobertura(state.areaId);
    } catch (e) {
      if (mountSignal.aborted) return;
      state.loadingAreas = false;
      state.error = e instanceof Error ? e.message : "No se pudieron cargar las áreas";
      render();
    }
  }

  async function loadCobertura(areaId: number): Promise<void> {
    state.loadingCobertura = true;
    state.cobertura = null;
    render();
    try {
      const cob = await getCoberturaArea(areaId);
      if (mountSignal.aborted || state.areaId !== areaId) return;
      state.cobertura = cob;
      state.loadingCobertura = false;
      render();
    } catch (e) {
      if (mountSignal.aborted) return;
      state.loadingCobertura = false;
      state.error = e instanceof Error ? e.message : "No se pudo cargar la cobertura del área";
      render();
    }
  }

  async function exportarActual(): Promise<void> {
    if (state.areaId == null || state.exporting) return;
    state.exporting = true;
    render();
    try {
      await descargarCoberturaAreaExcel(state.areaId, `cobertura_area_${state.areaId}.xlsx`);
    } finally {
      if (!mountSignal.aborted) {
        state.exporting = false;
        render();
      }
    }
  }

  container.addEventListener(
    "change",
    (ev) => {
      const target = ev.target as HTMLElement;
      if (target instanceof HTMLSelectElement && target.dataset.action === "op-area") {
        const id = Number(target.value);
        state.areaId = Number.isNaN(id) ? null : id;
        if (state.areaId != null) void loadCobertura(state.areaId);
      }
    },
    { signal: mountSignal },
  );

  container.addEventListener(
    "click",
    (ev) => {
      const action = (ev.target as HTMLElement).closest<HTMLElement>("[data-action]")?.dataset.action;
      if (action === "op-export") void exportarActual();
      else if (action === "op-retry") void loadAreas();
    },
    { signal: mountSignal },
  );

  void loadAreas();
}

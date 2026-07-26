/**
 * Página del módulo Operaciones (`#/operaciones`): analítica de cobertura y
 * polivalencia por área. Solo lectura, gestión RH/jefatura. Reúsa los datos de
 * las evaluaciones de competencia (la misma fuente que la Matriz de
 * multihabilidades). Narrativa orientada a preguntas de negocio para RH.
 */
import { mountAppShell } from "../layouts/appShell.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import { hashParamNumero } from "../utils/hashQuery.ts";
import {
  badgeApproved,
  badgeCancelled,
  badgePending,
  badgeRejected,
  BTN_PRIMARY,
  BTN_SECONDARY,
  errorState,
  FORM_LABEL,
  FORM_SELECT,
  pageHeading,
  RH_LISTADO_SURFACE,
  RH_TABLE_HEAD,
  SELECT_CHEVRON,
  skeletonBlock,
} from "../ui/uiTokens.ts";
import {
  TALENTO_KPI_ICONS,
  talentoEyebrow,
  talentoKpiCard,
  talentoKpiGrid,
  talentoKpiSkeleton,
  talentoPageRoot,
} from "../talento/pageKit.ts";
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

const TH =
  "px-4 py-3.5 text-left text-[13px] font-semibold tracking-tight text-slate-600";
const TH_CENTER =
  "px-4 py-3.5 text-center text-[13px] font-semibold tracking-tight text-slate-600";

/** Reutilizado por `pages/dashboardTalento.ts` (mismo semáforo conceptual: verde/ámbar/rojo). */
export function semaforoBadge(sem: Semaforo, label: string): string {
  if (sem === "verde") return badgeApproved(label);
  if (sem === "ambar") return badgePending(label);
  return badgeRejected(label);
}

function severidadChip(sev: Severidad): string {
  if (sev === "hueco") return badgeRejected("Nadie la cubre");
  if (sev === "punto_unico") return badgePending("Solo 1 persona");
  return badgeCancelled("OK");
}

const barTone: Record<Semaforo, string> = {
  verde: "bg-emerald-500",
  ambar: "bg-amber-400",
  rojo: "bg-red-400",
};

function coberturaBar(c: CompetenciaCobertura): string {
  const pct = Math.max(0, Math.min(100, c.cobertura_pct));
  return `<div class="flex min-w-[7.5rem] items-center gap-2.5">
    <div class="h-2 w-28 shrink-0 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
      <div class="h-full rounded-full ${barTone[c.semaforo]} transition-[width] duration-300" style="width:${pct}%"></div>
    </div>
    <span class="tabular-nums text-xs font-semibold text-text-secondary">${pct.toFixed(0)}%</span>
  </div>`;
}

function sectionTitle(title: string, subtitle?: string): string {
  return `<div class="flex flex-col gap-0.5">
    <h2 class="text-sm font-semibold tracking-tight text-text-primary">${escapeHtml(title)}</h2>
    ${subtitle ? `<p class="text-xs text-text-muted">${escapeHtml(subtitle)}</p>` : ""}
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
    if (state.loadingAreas) {
      return `<div class="${RH_LISTADO_SURFACE} p-4 sm:p-5">
        ${skeletonBlock({ className: "h-16 rounded-xl", label: "Cargando áreas…" })}
      </div>`;
    }
    if (!state.areas.length) {
      return `<div class="${RH_LISTADO_SURFACE} px-5 py-6 text-center text-sm text-text-muted">
        No hay áreas con competencias requeridas en tu alcance.
      </div>`;
    }
    const opts = state.areas
      .map(
        (a) =>
          `<option value="${a.area_id}"${a.area_id === state.areaId ? " selected" : ""}>${escapeHtml(
            a.area_nombre,
          )}${a.n_criticas > 0 ? ` — ${a.n_criticas} crítica(s)` : ""}</option>`,
      )
      .join("");
    return `<section class="${RH_LISTADO_SURFACE} p-4 sm:p-5" aria-label="Filtro por área">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div class="w-full max-w-md">
          <label class="${FORM_LABEL}" for="op-area">Área</label>
          <div class="grid">
            <select id="op-area" data-action="op-area" class="${FORM_SELECT}">${opts}</select>
            ${SELECT_CHEVRON}
          </div>
        </div>
        <p class="text-xs leading-relaxed text-text-muted sm:max-w-xs sm:text-right">
          Basado en las evaluaciones de habilidades ya registradas en el área.
        </p>
      </div>
    </section>`;
  }

  function resumenNarrativo(cob: CoberturaArea): string {
    const r = cob.resumen;
    const areaNombre = escapeHtml(r.area_nombre);
    if (r.n_criticas === 0) {
      return `<div class="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3.5 text-sm text-emerald-900" role="status">
        <p class="font-semibold">Sin riesgos críticos en ${areaNombre}</p>
        <p class="mt-0.5 text-emerald-800/90">Todas las habilidades requeridas tienen al menos 2 personas listas.</p>
      </div>`;
    }
    const huecos = cob.criticas.filter((c) => c.severidad === "hueco").length;
    const puntos = cob.criticas.filter((c) => c.severidad === "punto_unico").length;
    const detalle =
      huecos > 0 && puntos > 0
        ? `${huecos} sin cobertura y ${puntos} con una sola persona.`
        : huecos > 0
          ? `${huecos} sin nadie certificado.`
          : `${puntos} dependen de una sola persona.`;
    return `<div class="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3.5 text-sm text-amber-950" role="status">
      <p class="font-semibold">Hay ${r.n_criticas} habilidad${r.n_criticas === 1 ? "" : "es"} en riesgo en ${areaNombre}</p>
      <p class="mt-0.5 text-amber-900/90">${escapeHtml(detalle)} Revisa la sección de abajo para ver a quién conviene capacitar.</p>
    </div>`;
  }

  function renderResumen(cob: CoberturaArea): string {
    const r = cob.resumen;
    const criticasAlto = r.n_criticas > 0;
    return `<section class="flex flex-col gap-3" aria-label="Cómo está el área">
      ${sectionTitle("¿Cómo está el área?", "Lectura rápida con el área seleccionada.")}
      ${resumenNarrativo(cob)}
      ${talentoKpiGrid(
        [
          talentoKpiCard({
            label: "Versatilidad del equipo",
            value: r.pol_area_pct === null ? "n/d" : `${r.pol_area_pct.toFixed(0)}%`,
            sub:
              r.pol_area_pct === null
                ? "Sin requisitos evaluables"
                : "% promedio de habilidades que el personal ya cubre",
            icon: TALENTO_KPI_ICONS.users,
            accent: "sky",
          }),
          talentoKpiCard({
            label: "Sin riesgo de una sola persona",
            value: `${r.resiliencia_pct.toFixed(0)}%`,
            sub: "% de habilidades con al menos 2 personas listas",
            icon: TALENTO_KPI_ICONS.chart,
            accent: "violet",
          }),
          talentoKpiCard({
            label: "Habilidades en riesgo",
            value: String(r.n_criticas),
            sub: "Sin cobertura o solo 1 persona lista",
            icon: TALENTO_KPI_ICONS.alert,
            accent: criticasAlto ? "red" : "amber",
            valueClass: criticasAlto ? "text-red-700" : "",
            cardClass: criticasAlto
              ? "border-red-200/80 bg-gradient-to-br from-red-50/40 via-white to-white"
              : "",
          }),
          talentoKpiCard({
            label: "Personas en el área",
            value: String(r.n_empleados),
            sub: "En tu alcance",
            icon: TALENTO_KPI_ICONS.grid,
            accent: "blue",
          }),
        ].join(""),
        { ariaLabel: "Indicadores de cobertura del área" },
      )}
    </section>`;
  }

  function renderResumenSkeleton(): string {
    return talentoKpiGrid(
      [talentoKpiSkeleton(), talentoKpiSkeleton(), talentoKpiSkeleton(), talentoKpiSkeleton()].join(""),
      { ariaLabel: "Cargando indicadores" },
    );
  }

  function renderCompetenciaRow(c: CompetenciaCobertura): string {
    return `<tr class="hover:bg-active-tint/70">
      <td class="px-4 py-3.5">
        <p class="text-sm font-medium text-text-primary">${escapeHtml(c.competencia_nombre)}</p>
        ${c.tipo_nombre ? `<p class="mt-0.5 text-xs text-text-muted">${escapeHtml(c.tipo_nombre)}</p>` : ""}
      </td>
      <td class="px-4 py-3.5 text-center tabular-nums text-sm text-text-secondary">${c.cubren}/${c.requieren}</td>
      <td class="px-4 py-3.5 text-center tabular-nums text-sm text-text-secondary">${c.en_entrenamiento}</td>
      <td class="px-4 py-3.5">${coberturaBar(c)}</td>
      <td class="px-4 py-3.5">${c.severidad === "ok" ? semaforoBadge(c.semaforo, "OK") : severidadChip(c.severidad)}</td>
    </tr>`;
  }

  function renderCoberturaTabla(cob: CoberturaArea): string {
    if (!cob.competencias.length) {
      return `<section class="${RH_LISTADO_SURFACE} px-5 py-8 text-center text-sm text-text-muted">
        Esta área no tiene competencias requeridas registradas.
      </section>`;
    }
    const filas = cob.competencias.map(renderCompetenciaRow).join("");
    return `<section class="${RH_LISTADO_SURFACE} overflow-hidden p-0" aria-label="Cobertura por competencia">
      <div class="overflow-x-auto">
        <table class="min-w-[700px] w-full border-collapse text-left">
          <thead class="${RH_TABLE_HEAD}">
            <tr>
              <th scope="col" class="${TH}">Habilidad</th>
              <th scope="col" class="${TH_CENTER}">Listas / Necesarias</th>
              <th scope="col" class="${TH_CENTER}">En entrenamiento</th>
              <th scope="col" class="${TH}">Cobertura</th>
              <th scope="col" class="${TH}">Estado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100/90 bg-white">${filas}</tbody>
        </table>
      </div>
    </section>`;
  }

  function renderCritica(crit: Critica): string {
    const areaId = state.areaId;
    const cands = crit.candidatos.length
      ? crit.candidatos
          .map((cand) => {
            const pdiQs = new URLSearchParams({
              wizard: "1",
              empleado_id: String(cand.empleado_id),
              empleado_nombre: cand.nombre,
              competencia_id: String(crit.competencia_id),
              prioridad: "alta",
              accion: `Desarrollar: ${crit.competencia_nombre}`,
            });
            if (areaId != null) pdiQs.set("area_id", String(areaId));
            return `<li class="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div class="min-w-0">
                <p class="truncate text-sm text-text-secondary">${escapeHtml(cand.nombre)} <span class="text-text-muted">(${escapeHtml(String(cand.no_empleado))})</span></p>
                <p class="text-xs tabular-nums text-text-muted">Nivel ${cand.nivel_actual} → ${cand.nivel_requerido}</p>
              </div>
              <div class="flex shrink-0 flex-wrap gap-2">
                <a href="#/pdi-gestion?${pdiQs.toString()}" class="${BTN_PRIMARY} text-xs">Asignar PDI</a>
                <a href="#/evaluaciones/empleado/${cand.empleado_id}" class="${BTN_SECONDARY} text-xs">Ver evaluación</a>
              </div>
            </li>`;
          })
          .join("")
      : `<li class="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-sm text-text-muted">Sin candidatos cercanos al requisito.</p>
          ${
            areaId != null
              ? `<a href="#/pdi-gestion?area_id=${areaId}" class="${BTN_SECONDARY} text-xs">Abrir Gestión PDI del área</a>`
              : ""
          }
        </li>`;
    return `<article class="${RH_LISTADO_SURFACE} p-4 sm:p-5">
      <div class="flex items-start justify-between gap-3">
        <p class="min-w-0 text-sm font-semibold text-text-primary">${escapeHtml(crit.competencia_nombre)}</p>
        ${severidadChip(crit.severidad)}
      </div>
      <p class="mt-3 text-xs font-semibold uppercase tracking-wide text-text-muted">A quién conviene capacitar</p>
      <ul class="mt-1 divide-y divide-slate-100/90">${cands}</ul>
    </article>`;
  }

  function renderCriticas(cob: CoberturaArea): string {
    if (!cob.criticas.length) {
      return `<p class="text-sm text-text-muted">No hay habilidades en riesgo para este área.</p>`;
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
              `<tr class="hover:bg-active-tint/60">
                <td class="px-4 py-3 text-sm text-text-secondary">${escapeHtml(c.competencia_nombre)}</td>
                <td class="px-4 py-3 text-center tabular-nums text-sm text-text-secondary">${c.cubren}/${c.requieren}</td>
                <td class="px-4 py-3">${coberturaBar(c)}</td>
              </tr>`,
          )
          .join("");
        return `<details class="${RH_LISTADO_SURFACE} overflow-hidden">
          <summary class="cursor-pointer px-4 py-3.5 text-sm font-semibold text-text-primary hover:bg-active-tint/40">
            ${escapeHtml(p.puesto_nombre)}
          </summary>
          <div class="overflow-x-auto border-t border-slate-100">
            <table class="min-w-[480px] w-full border-collapse text-left">
              <thead class="${RH_TABLE_HEAD}">
                <tr>
                  <th scope="col" class="${TH}">Habilidad</th>
                  <th scope="col" class="${TH_CENTER}">Listas / Necesarias</th>
                  <th scope="col" class="${TH}">Cobertura</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100/90 bg-white">${filas}</tbody>
            </table>
          </div>
        </details>`;
      })
      .join("");
    return `<section class="flex flex-col gap-3">
      ${sectionTitle("Por puesto", "Detalle de cobertura dentro de cada perfil del área.")}
      <div class="flex flex-col gap-2">${bloques}</div>
    </section>`;
  }

  function renderCoberturaBlock(): string {
    if (state.areaId == null) {
      return `<section class="${RH_LISTADO_SURFACE} px-5 py-10 text-center text-sm text-text-muted">
        Elige un área para ver si está bien cubierta y dónde hay riesgo.
      </section>`;
    }
    if (state.loadingCobertura) {
      return `<div class="flex flex-col gap-5">
        ${renderResumenSkeleton()}
        ${skeletonBlock({ className: `${RH_LISTADO_SURFACE} h-64`, label: "Cargando cobertura…" })}
      </div>`;
    }
    if (!state.cobertura) return "";
    const cob = state.cobertura;
    return `<div class="flex flex-col gap-6">
      ${renderResumen(cob)}
      <section class="flex flex-col gap-3">
        ${sectionTitle("¿Dónde hay riesgo?", "Habilidades sin cobertura o con una sola persona lista.")}
        ${renderCriticas(cob)}
      </section>
      <section class="flex flex-col gap-3">
        ${sectionTitle("Detalle por habilidad", "Cuántas personas ya cumplen el requisito del puesto.")}
        ${renderCoberturaTabla(cob)}
      </section>
      ${renderPuestos(cob)}
    </div>`;
  }

  function headerActions(): string {
    const exportLabel = state.exporting ? "Exportando…" : "Exportar Excel";
    const canExport = state.areaId != null && state.cobertura != null && !state.loadingCobertura;
    return `<button type="button" data-action="op-export" class="${BTN_SECONDARY}"${!canExport || state.exporting ? " disabled" : ""}>${exportLabel}</button>`;
  }

  function pageContent(): string {
    const body = state.error
      ? errorState({ message: state.error, actionLabel: "Reintentar", actionAttrs: 'data-action="op-retry"' })
      : `<div class="flex flex-col gap-5">
          ${renderAreaSelector()}
          ${renderCoberturaBlock()}
        </div>`;
    return talentoPageRoot(
      `${talentoEyebrow()}
      ${pageHeading(
        "Cobertura de habilidades del área",
        "¿Tenemos gente suficiente para operar? ¿Dónde hay riesgo si alguien falta?",
        headerActions(),
      )}
      ${body}`,
      { dashboard: true, rootId: "operaciones-root" },
    );
  }

  function render(): void {
    mountAppShell(container, {
      pageTitle: "Cobertura de habilidades",
      activeNav: "operaciones",
      mainClass: "py-0",
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
      // Deep-link `#/operaciones?area_id=N` (enlaces cruzados del Dashboard de
      // Talento). Solo se respeta si el área está en el alcance del usuario;
      // si no, se cae al comportamiento normal (la primera).
      const pedida = hashParamNumero("area_id");
      const enAlcance = pedida !== null && areas.some((a) => a.area_id === pedida);
      state.areaId = enAlcance ? pedida : areas.length ? areas[0]!.area_id : null;
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

/**
 * Vista de equipo (ranking) del módulo Historial Objetivo
 * (`#/cumplimiento/historial-objetivo`): índice 0-100 + semáforo por
 * empleado, combinando actas, faltas/retardos e incidencias. Mismo patrón
 * de diseño y estructura que `pages/metas.ts` (pageHeading, RH_LISTADO_*,
 * skeletonBlock/errorState, per-mount AbortController, event delegation).
 *
 * Role-adaptive: RH-operativo/director/gerente con el módulo otorgado ven
 * el universo acotado ("top offenders"); un jefe (supervisor/gerente
 * nativo) ve el ranking de su propio equipo. El scoping lo resuelve
 * `HistorialObjetivoService` en el backend — esta página solo pide
 * `GET /equipo` con el rango de fechas vigente y pinta lo que reciba.
 */
import { mountAppShell } from "../layouts/appShell.ts";
import { escapeHtml } from "../ui/uiUtils.ts";
import {
  alertError,
  alertWarning,
  badgeApproved,
  badgeCancelled,
  badgePending,
  badgeRejected,
  BTN_GHOST,
  BTN_PRIMARY,
  BTN_SECONDARY,
  errorState,
  FIELD_INPUT,
  FORM_LABEL,
  pageHeading,
  RH_DASHBOARD_PAGE_SHELL,
  RH_LISTADO_PAGE_OUTER_GRADIENT,
  RH_LISTADO_SURFACE,
  RH_TABLE_HEAD,
  skeletonBlock,
} from "../ui/uiTokens.ts";
import { canAccessRhAssignedModule } from "../auth/jwt.ts";
import {
  descargarHistorialEquipoExcel,
  getHistorialEquipo,
  type HistorialObjetivoEquipoApi,
  type HistorialObjetivoEquipoItemApi,
} from "../api/historialObjetivo.ts";

/** Mismo mapeo que el panel de la ficha 360 (`pages/empleadoVista360.ts`). */
const HO_FUENTE_LABELS: Record<string, string> = {
  actas: "Actas",
  faltas: "Faltas y retardos",
  incidencias: "Incidencias",
  progresivo: "Progresivo (bono)",
};

interface State {
  /** RH-operativo/director/gerente con el módulo otorgado (universo) vs. jefe con scope de equipo. */
  esGestionRh: boolean;
  fechaInicio: string;
  fechaFin: string;
  loading: boolean;
  error: string | null;
  data: HistorialObjetivoEquipoApi | null;
  exporting: boolean;
  exportError: string | null;
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function hoFmt(n: number): string {
  return Number(n).toFixed(1);
}

function hoSemaforoBadge(semaforo: string): string {
  if (semaforo === "verde") return badgeApproved("Verde");
  if (semaforo === "amarillo") return badgePending("Amarillo");
  if (semaforo === "rojo") return badgeRejected("Rojo");
  return badgeCancelled("Sin datos");
}

function renderDesgloseResumen(item: HistorialObjetivoEquipoItemApi): string {
  const partes = item.resultado.desglose
    .filter((f) => f.penalizacion > 0)
    .map((f) => `${escapeHtml(HO_FUENTE_LABELS[f.fuente] ?? f.fuente)} -${hoFmt(f.penalizacion)}`);
  if (partes.length === 0) return `<span class="text-text-muted">Sin penalizaciones</span>`;
  return `<span class="text-text-secondary">${partes.join(" · ")}</span>`;
}

function renderEmptyState(opts: { title: string; subtitle?: string }): string {
  return `
  <div class="${RH_LISTADO_SURFACE} flex flex-col items-center justify-center px-6 py-16 text-center">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-12 text-slate-300" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
    <p class="mt-4 text-base font-semibold text-text-primary">${escapeHtml(opts.title)}</p>
    ${opts.subtitle ? `<p class="mt-1 max-w-sm text-sm text-text-muted">${escapeHtml(opts.subtitle)}</p>` : ""}
  </div>`;
}

function renderRankingRow(item: HistorialObjetivoEquipoItemApi): string {
  const nombre = item.nombre ?? `Empleado #${item.empleado_id}`;
  const subtitulo = item.no_empleado ? `#${item.no_empleado}` : `ID ${item.empleado_id}`;
  return `
  <tr class="border-b border-slate-100 last:border-b-0">
    <td class="px-3 py-3 align-middle">
      <p class="font-semibold text-text-primary">${escapeHtml(nombre)}</p>
      <p class="text-xs text-text-muted">${escapeHtml(subtitulo)}</p>
    </td>
    <td class="px-3 py-3 align-middle text-sm font-semibold tabular-nums text-slate-700">${hoFmt(item.resultado.indice)}</td>
    <td class="px-3 py-3 align-middle">${hoSemaforoBadge(item.resultado.semaforo)}</td>
    <td class="px-3 py-3 align-middle text-sm tabular-nums text-slate-700">-${hoFmt(item.resultado.penalizacion_total)}</td>
    <td class="px-3 py-3 align-middle text-sm">${renderDesgloseResumen(item)}</td>
    <td class="px-3 py-3 align-middle">
      <a href="#/empleados/${item.empleado_id}?tab=historial_objetivo" class="${BTN_GHOST}">Ver ficha</a>
    </td>
  </tr>`;
}

function renderFiltros(state: State): string {
  return `
  <div class="flex flex-wrap items-end gap-3">
    <div>
      <label class="${FORM_LABEL}" for="ho-fecha-inicio">Desde</label>
      <input id="ho-fecha-inicio" data-field="fecha-inicio" type="date" value="${escapeHtml(state.fechaInicio)}" class="${FIELD_INPUT}" />
    </div>
    <div>
      <label class="${FORM_LABEL}" for="ho-fecha-fin">Hasta</label>
      <input id="ho-fecha-fin" data-field="fecha-fin" type="date" value="${escapeHtml(state.fechaFin)}" class="${FIELD_INPUT}" />
    </div>
    <button type="button" data-action="aplicar-filtro" class="${BTN_SECONDARY}">Aplicar</button>
    <button type="button" data-action="exportar" class="${BTN_PRIMARY}" ${state.exporting ? "disabled" : ""}>
      ${state.exporting ? "Exportando…" : "Exportar Excel"}
    </button>
  </div>`;
}

function renderBody(state: State): string {
  if (state.loading) {
    return skeletonBlock({ className: `${RH_LISTADO_SURFACE} px-6 py-16`, label: "Cargando ranking del equipo…" });
  }
  if (state.error) {
    return errorState({ message: state.error, actionLabel: "Reintentar", actionAttrs: 'data-action="reload"' });
  }
  const data = state.data;
  if (!data || data.items.length === 0) {
    return renderEmptyState({
      title: "Sin datos en este rango",
      subtitle: "Ajusta el rango de fechas para ver el ranking del equipo.",
    });
  }
  return `
  <div class="flex flex-col gap-4">
    ${!data.bono_disponible ? alertWarning("Los datos de faltas/retardos e incidencias (Bono) no están disponibles en este momento; el índice se calculó solo con actas.") : ""}
    ${state.exportError ? alertError(state.exportError) : ""}
    <section class="${RH_LISTADO_SURFACE} overflow-x-auto">
      <table class="min-w-[860px] w-full text-left">
        <thead class="${RH_TABLE_HEAD}">
          <tr>
            <th class="px-3 py-2.5">Empleado</th>
            <th class="px-3 py-2.5">Índice</th>
            <th class="px-3 py-2.5">Semáforo</th>
            <th class="px-3 py-2.5">Penalización</th>
            <th class="px-3 py-2.5">Desglose</th>
            <th class="px-3 py-2.5">Acciones</th>
          </tr>
        </thead>
        <tbody>${data.items.map(renderRankingRow).join("")}</tbody>
      </table>
    </section>
  </div>`;
}

let mountAbort: AbortController | null = null;

export function mountHistorialObjetivo(container: HTMLElement, signal?: AbortSignal): void {
  mountAbort?.abort();
  mountAbort = new AbortController();
  const mountSignal = mountAbort.signal;
  if (signal) {
    signal.addEventListener("abort", () => mountAbort?.abort(), { once: true, signal: mountSignal });
  }

  /**
   * Criterio alineado con el backend (`role_checker(["operativo", "gerente",
   * "supervisor", "director"])` en `app/api/v1/historial_objetivo/router.py`):
   * un RH inscrito no-admin necesita el módulo `historial-objetivo`
   * (prefix `/api/v1/historial-objetivo`). Cualquier otro rol que llegue
   * aquí (supervisor/gerente nativo, o admin/RH-legacy en Modo
   * líder/gerente) cae en la vista de jefe: ve el ranking de su propio
   * equipo, scope ya aplicado por el backend.
   */
  const esGestionRh = canAccessRhAssignedModule("historial-objetivo", {
    blockGestorTeam: true,
    blockEmpleado: true,
    blockDirector: true,
  });

  const state: State = {
    esGestionRh,
    fechaInicio: isoDateDaysAgo(365),
    fechaFin: isoToday(),
    loading: true,
    error: null,
    data: null,
    exporting: false,
    exportError: null,
  };

  function pageContent(): string {
    return `
    <div class="${RH_DASHBOARD_PAGE_SHELL}">
    <div class="${RH_LISTADO_PAGE_OUTER_GRADIENT}">
      <div class="flex flex-col gap-2">
        <p class="text-xs font-medium text-text-muted">${state.esGestionRh ? "Cumplimiento" : "Cumplimiento · Mi equipo"}</p>
        ${pageHeading(
          state.esGestionRh ? "Historial Objetivo" : "Historial Objetivo de mi equipo",
          "Ranking del índice objetivo (0-100) por empleado, combinando actas, faltas/retardos e incidencias en el rango seleccionado.",
        )}
      </div>
      ${renderFiltros(state)}
      ${renderBody(state)}
    </div>
    </div>`;
  }

  function render(): void {
    mountAppShell(container, {
      pageTitle: "Historial Objetivo",
      activeNav: "historial-objetivo",
      mainClass: "py-0",
      mainHtml: pageContent(),
    });
  }

  async function load(): Promise<void> {
    state.loading = true;
    state.error = null;
    render();
    const data = await getHistorialEquipo({ fecha_inicio: state.fechaInicio, fecha_fin: state.fechaFin });
    if (mountSignal.aborted) return;
    state.loading = false;
    if (!data) {
      state.error = "No se pudo cargar el ranking del equipo.";
    } else {
      state.data = data;
    }
    render();
  }

  async function onExportar(): Promise<void> {
    if (state.exporting) return;
    state.exporting = true;
    state.exportError = null;
    render();
    const ok = await descargarHistorialEquipoExcel(
      { fecha_inicio: state.fechaInicio, fecha_fin: state.fechaFin },
      `historial_objetivo_equipo_${state.fechaInicio}_${state.fechaFin}.xlsx`,
    );
    if (mountSignal.aborted) return;
    state.exporting = false;
    if (!ok) state.exportError = "No se pudo exportar el ranking a Excel.";
    render();
  }

  function readFiltrosFromDom(): void {
    const inicioInput = container.querySelector<HTMLInputElement>('[data-field="fecha-inicio"]');
    const finInput = container.querySelector<HTMLInputElement>('[data-field="fecha-fin"]');
    if (inicioInput?.value) state.fechaInicio = inicioInput.value;
    if (finInput?.value) state.fechaFin = finInput.value;
  }

  function handleClick(e: Event): void {
    const t = e.target as HTMLElement;
    const actionEl = t.closest<HTMLElement>("[data-action]");
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    if (action === "reload") {
      void load();
      return;
    }
    if (action === "aplicar-filtro") {
      readFiltrosFromDom();
      void load();
      return;
    }
    if (action === "exportar") {
      readFiltrosFromDom();
      void onExportar();
      return;
    }
  }

  function handleChange(e: Event): void {
    const t = e.target as HTMLElement;
    if (!(t instanceof HTMLInputElement)) return;
    if (t.dataset.field === "fecha-inicio") state.fechaInicio = t.value;
    else if (t.dataset.field === "fecha-fin") state.fechaFin = t.value;
  }

  render();
  container.addEventListener("click", handleClick, { signal: mountSignal });
  container.addEventListener("change", handleChange, { signal: mountSignal });

  void load();
}

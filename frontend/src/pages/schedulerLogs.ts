/**
 * Logs del scheduler (`#/ajustes/scheduler-logs`) — solo admin, oculta.
 *
 * No tiene entrada en el sidebar ni en el menú de usuario: se llega escribiendo la URL.
 * Solo lectura; relanzar un job es por CLI.
 */
import {
  fetchSchedulerJobIds,
  fetchSchedulerLogDetalle,
  fetchSchedulerLogs,
  type SchedulerLogDetalle,
  type SchedulerLogItem,
} from "../api/schedulerLogs.ts";
import { canAccessRhPermisosAdmin } from "../auth/rhModulePermissions.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import {
  FILTER_FIELD_WRAP,
  RH_LISTADO_BTN_GHOST,
  RH_LISTADO_FOCUS_RING,
  RH_LISTADO_LABEL,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
  SELECT_CHEVRON,
  alertError,
  badgeApproved,
  badgeCancelled,
  badgeOpen,
  badgePending,
  badgeRejected,
  htmlAccessDenied,
} from "../ui/uiTokens.ts";
import { escapeHtml } from "../ui/uiUtils.ts";

const PAGE_SIZE = 20;

const ETIQUETA_RESULTADO: Record<string, string> = {
  en_curso: "En curso",
  ok: "Correcto",
  advertencia: "Advertencia",
  error: "Error",
};

export function formatearDuracion(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60000).toFixed(1)} min`;
}

function formatearFecha(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("es-MX");
}

/** Mapeo a píldoras del sistema: ok=aprobado (emerald), error=rechazado (red),
 * en_curso=abierto (blue, "en curso activo" — se distingue a simple vista de una
 * advertencia), advertencia=pendiente (amber); un resultado desconocido usa el
 * neutro, nunca el verde. */
/** Debe coincidir con MAX_INTENTOS del backend (app/integrations/scheduler_job_log.py). */
const MAX_INTENTOS = 4;

/** Marca visible solo en reintentos: el primer intento es el caso normal. */
function etiquetaIntento(intento: number): string {
  if (!intento || intento <= 1) return "";
  return `<span class="ml-2 text-xs text-[color:var(--color-text-secondary)]">Intento ${intento}/${MAX_INTENTOS}</span>`;
}

function badge(resultado: string): string {
  const texto = ETIQUETA_RESULTADO[resultado] ?? resultado;
  if (resultado === "ok") return badgeApproved(texto);
  if (resultado === "error") return badgeRejected(texto);
  if (resultado === "en_curso") return badgeOpen(texto);
  if (resultado === "advertencia") return badgePending(texto);
  return badgeCancelled(texto);
}

export function renderTablaCorridas(items: SchedulerLogItem[]): string {
  if (items.length === 0) {
    return `<p class="px-4 py-8 text-center text-sm text-[color:var(--color-text-secondary)]">Sin corridas registradas.</p>`;
  }
  const filas = items
    .map(
      (item) => `
      <tr class="cursor-pointer border-t border-[rgba(148,163,184,0.28)] hover:bg-slate-50" data-scheduler-log-id="${escapeHtml(item.id)}">
        <td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.job_id)}</td>
        <td class="px-3 py-2 text-xs">${escapeHtml(formatearFecha(item.inicio_at))}</td>
        <td class="px-3 py-2 text-xs">${escapeHtml(formatearDuracion(item.duracion_ms))}</td>
        <td class="px-3 py-2">${badge(item.resultado)}${etiquetaIntento(item.intento)}</td>
        <td class="px-3 py-2 text-xs text-[color:var(--color-text-secondary)]">${escapeHtml(item.resumen ?? "")}</td>
      </tr>`,
    )
    .join("");
  return `
    <table class="w-full border-collapse text-left">
      <thead>
        <tr class="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
          <th class="px-3 py-2">Job</th>
          <th class="px-3 py-2">Inicio</th>
          <th class="px-3 py-2">Duración</th>
          <th class="px-3 py-2">Resultado</th>
          <th class="px-3 py-2">Resumen</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>`;
}

export function renderDetalle(detalle: SchedulerLogDetalle): string {
  const error = detalle.error
    ? `<div class="px-3 pt-3">${alertError(detalle.error)}</div>`
    : "";
  const lineas = detalle.lineas
    .map(
      (linea) =>
        `<div class="border-b border-[rgba(148,163,184,0.2)] px-3 py-1 font-mono text-xs"><span class="mr-2 font-semibold">${escapeHtml(linea.nivel)}</span>${escapeHtml(linea.mensaje)}</div>`,
    )
    .join("");
  const recortadas =
    detalle.lineas_descartadas > 0
      ? `<p class="px-3 py-2 text-xs text-[color:var(--color-text-muted)]">${escapeHtml(detalle.lineas_descartadas)} líneas más no se guardaron.</p>`
      : "";
  return `
    <div class="${RH_LISTADO_SURFACE} mt-4">
      <h2 class="px-3 py-2 text-sm font-bold">${escapeHtml(detalle.job_id)} · ${escapeHtml(formatearFecha(detalle.inicio_at))}${etiquetaIntento(detalle.intento)}</h2>
      ${error}
      ${lineas || `<p class="px-3 py-2 text-xs">Sin líneas.</p>`}
      ${recortadas}
    </div>`;
}

export function mountSchedulerLogs(container: HTMLElement, signal?: AbortSignal): void {
  if (!canAccessRhPermisosAdmin()) {
    mountAppShell(container, {
      pageTitle: "Logs del scheduler",
      activeNav: "dashboard",
      mainHtml: htmlAccessDenied({
        title: "Acceso no autorizado",
        description: "Esta pantalla es solo para administradores.",
      }),
    });
    return;
  }

  let page = 1;
  let filtroJob = "";
  let filtroResultado = "";
  let filtroDesde = "";
  let filtroHasta = "";

  mountAppShell(container, {
    pageTitle: "Logs del scheduler",
    activeNav: "dashboard",
    mainHtml: `<div id="scheduler-logs-page" class="${RH_LISTADO_PAGE_OUTER}">
      <div id="scheduler-logs-filtros" class="mb-4 flex flex-wrap gap-3"></div>
      <div id="scheduler-logs-tabla" class="${RH_LISTADO_SURFACE}"></div>
      <div id="scheduler-logs-paginacion" class="mt-3 flex items-center gap-2 text-sm"></div>
      <div id="scheduler-logs-detalle"></div>
    </div>`,
  });

  const root = container.querySelector("#scheduler-logs-page");
  const tabla = container.querySelector("#scheduler-logs-tabla");
  const paginacion = container.querySelector("#scheduler-logs-paginacion");
  const detalleHost = container.querySelector("#scheduler-logs-detalle");
  const filtros = container.querySelector("#scheduler-logs-filtros");

  async function pintarFiltros(): Promise<void> {
    if (!filtros) return;
    let jobs: string[] = [];
    try {
      jobs = await fetchSchedulerJobIds(signal);
    } catch {
      jobs = [];
    }
    const opciones = jobs
      .map((j) => `<option value="${escapeHtml(j)}">${escapeHtml(j)}</option>`)
      .join("");
    filtros.innerHTML = `
      <div class="${FILTER_FIELD_WRAP}">
        <label for="scheduler-logs-filtro-job" class="${RH_LISTADO_LABEL}">Job</label>
        <div class="relative grid w-full grid-cols-1 grid-rows-1">
          <select id="scheduler-logs-filtro-job" class="${RH_LISTADO_SELECT} ${RH_LISTADO_FOCUS_RING}"><option value="">Todos</option>${opciones}</select>
          ${SELECT_CHEVRON}
        </div>
      </div>
      <div class="${FILTER_FIELD_WRAP}">
        <label for="scheduler-logs-filtro-resultado" class="${RH_LISTADO_LABEL}">Resultado</label>
        <div class="relative grid w-full grid-cols-1 grid-rows-1">
          <select id="scheduler-logs-filtro-resultado" class="${RH_LISTADO_SELECT} ${RH_LISTADO_FOCUS_RING}">
            <option value="">Todos</option>
            <option value="ok">Correcto</option>
            <option value="advertencia">Advertencia</option>
            <option value="error">Error</option>
            <option value="en_curso">En curso</option>
          </select>
          ${SELECT_CHEVRON}
        </div>
      </div>
      <div class="${FILTER_FIELD_WRAP}">
        <label for="scheduler-logs-filtro-desde" class="${RH_LISTADO_LABEL}">Desde</label>
        <input id="scheduler-logs-filtro-desde" type="date" value="${escapeHtml(filtroDesde)}"
          class="min-h-[42px] w-full rounded-[12px] border border-[rgba(148,163,184,0.35)] bg-white px-3 py-2 text-sm text-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-slate-400 hover:border-[rgba(100,116,139,0.45)] hover:bg-[#fafbfc] ${RH_LISTADO_FOCUS_RING}"/>
      </div>
      <div class="${FILTER_FIELD_WRAP}">
        <label for="scheduler-logs-filtro-hasta" class="${RH_LISTADO_LABEL}">Hasta</label>
        <input id="scheduler-logs-filtro-hasta" type="date" value="${escapeHtml(filtroHasta)}"
          class="min-h-[42px] w-full rounded-[12px] border border-[rgba(148,163,184,0.35)] bg-white px-3 py-2 text-sm text-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-slate-400 hover:border-[rgba(100,116,139,0.45)] hover:bg-[#fafbfc] ${RH_LISTADO_FOCUS_RING}"/>
      </div>`;
  }

  let loadSeq = 0;

  async function cargar(): Promise<void> {
    if (!tabla) return;
    const seq = ++loadSeq;
    const isStale = (): boolean => seq !== loadSeq;
    tabla.innerHTML = `<p class="px-4 py-8 text-center text-sm">Cargando…</p>`;
    try {
      const data = await fetchSchedulerLogs(
        {
          job_id: filtroJob || undefined,
          resultado: filtroResultado || undefined,
          desde: filtroDesde || undefined,
          hasta: filtroHasta || undefined,
          page,
          page_size: PAGE_SIZE,
        },
        signal,
      );
      if (isStale()) return;
      tabla.innerHTML = renderTablaCorridas(data.items);
      if (paginacion) {
        const paginas = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
        paginacion.innerHTML = `
          <button type="button" data-scheduler-logs-prev class="${RH_LISTADO_BTN_GHOST}" ${page <= 1 ? "disabled" : ""}>Anterior</button>
          <span>Página ${escapeHtml(page)} de ${escapeHtml(paginas)} · ${escapeHtml(data.total)} corridas</span>
          <button type="button" data-scheduler-logs-next class="${RH_LISTADO_BTN_GHOST}" ${page >= paginas ? "disabled" : ""}>Siguiente</button>`;
      }
    } catch (error: unknown) {
      if (isStale()) return;
      const err = error as { detail?: string };
      tabla.innerHTML = `<p class="px-4 py-8 text-center text-sm text-red-600">${escapeHtml(err?.detail ?? "No se pudieron cargar las corridas.")}</p>`;
    }
  }

  root?.addEventListener(
    "click",
    (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("[data-scheduler-logs-prev]") && page > 1) {
        page -= 1;
        void cargar();
        return;
      }
      if (t.closest("[data-scheduler-logs-next]")) {
        page += 1;
        void cargar();
        return;
      }
      const fila = t.closest<HTMLElement>("[data-scheduler-log-id]");
      if (fila && detalleHost) {
        const id = Number.parseInt(fila.dataset.schedulerLogId ?? "", 10);
        if (Number.isFinite(id)) {
          void fetchSchedulerLogDetalle(id, signal)
            .then((detalle) => {
              detalleHost.innerHTML = renderDetalle(detalle);
            })
            .catch(() => {
              detalleHost.innerHTML = `<p class="mt-4 text-sm text-red-600">No se pudo cargar el detalle.</p>`;
            });
        }
      }
    },
    { signal },
  );

  root?.addEventListener(
    "change",
    (e) => {
      const t = e.target as HTMLElement;
      if (t.id === "scheduler-logs-filtro-job") {
        filtroJob = (t as HTMLSelectElement).value;
        page = 1;
        void cargar();
      }
      if (t.id === "scheduler-logs-filtro-resultado") {
        filtroResultado = (t as HTMLSelectElement).value;
        page = 1;
        void cargar();
      }
      if (t.id === "scheduler-logs-filtro-desde") {
        filtroDesde = (t as HTMLInputElement).value;
        page = 1;
        void cargar();
      }
      if (t.id === "scheduler-logs-filtro-hasta") {
        filtroHasta = (t as HTMLInputElement).value;
        page = 1;
        void cargar();
      }
    },
    { signal },
  );

  void pintarFiltros();
  void cargar();
}

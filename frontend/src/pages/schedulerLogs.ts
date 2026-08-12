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
  RH_LISTADO_LABEL,
  RH_LISTADO_PAGE_OUTER,
  RH_LISTADO_SURFACE,
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

const CLASE_RESULTADO: Record<string, string> = {
  en_curso: "bg-blue-50 text-blue-700 ring-blue-600/20",
  ok: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  advertencia: "bg-amber-50 text-amber-700 ring-amber-600/20",
  error: "bg-red-50 text-red-700 ring-red-600/20",
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

function badge(resultado: string): string {
  const clase = CLASE_RESULTADO[resultado] ?? CLASE_RESULTADO.ok;
  const texto = ETIQUETA_RESULTADO[resultado] ?? resultado;
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${clase}">${escapeHtml(texto)}</span>`;
}

export function renderTablaCorridas(items: SchedulerLogItem[]): string {
  if (items.length === 0) {
    return `<p class="px-4 py-8 text-center text-sm text-[color:var(--color-text-secondary)]">Sin corridas registradas.</p>`;
  }
  const filas = items
    .map(
      (item) => `
      <tr class="cursor-pointer border-t border-[rgba(148,163,184,0.28)] hover:bg-slate-50" data-scheduler-log-id="${item.id}">
        <td class="px-3 py-2 font-mono text-xs">${escapeHtml(item.job_id)}</td>
        <td class="px-3 py-2 text-xs">${escapeHtml(formatearFecha(item.inicio_at))}</td>
        <td class="px-3 py-2 text-xs">${escapeHtml(formatearDuracion(item.duracion_ms))}</td>
        <td class="px-3 py-2">${badge(item.resultado)}</td>
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

function renderDetalle(detalle: SchedulerLogDetalle): string {
  const lineas = detalle.lineas
    .map(
      (linea) =>
        `<div class="border-b border-[rgba(148,163,184,0.2)] px-3 py-1 font-mono text-xs"><span class="mr-2 font-semibold">${escapeHtml(linea.nivel)}</span>${escapeHtml(linea.mensaje)}</div>`,
    )
    .join("");
  const recortadas =
    detalle.lineas_descartadas > 0
      ? `<p class="px-3 py-2 text-xs text-[color:var(--color-text-muted)]">${detalle.lineas_descartadas} líneas más no se guardaron.</p>`
      : "";
  return `
    <div class="${RH_LISTADO_SURFACE} mt-4">
      <h2 class="px-3 py-2 text-sm font-bold">${escapeHtml(detalle.job_id)} · ${escapeHtml(formatearFecha(detalle.inicio_at))}</h2>
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
      jobs = await fetchSchedulerJobIds();
    } catch {
      jobs = [];
    }
    const opciones = jobs
      .map((j) => `<option value="${escapeHtml(j)}">${escapeHtml(j)}</option>`)
      .join("");
    filtros.innerHTML = `
      <label class="block"><span class="${RH_LISTADO_LABEL}">Job</span>
        <select id="scheduler-logs-filtro-job" class="rounded border px-2 py-1 text-sm"><option value="">Todos</option>${opciones}</select>
      </label>
      <label class="block"><span class="${RH_LISTADO_LABEL}">Resultado</span>
        <select id="scheduler-logs-filtro-resultado" class="rounded border px-2 py-1 text-sm">
          <option value="">Todos</option>
          <option value="ok">Correcto</option>
          <option value="advertencia">Advertencia</option>
          <option value="error">Error</option>
          <option value="en_curso">En curso</option>
        </select>
      </label>`;
  }

  async function cargar(): Promise<void> {
    if (!tabla) return;
    tabla.innerHTML = `<p class="px-4 py-8 text-center text-sm">Cargando…</p>`;
    try {
      const data = await fetchSchedulerLogs({
        job_id: filtroJob || undefined,
        resultado: filtroResultado || undefined,
        page,
        page_size: PAGE_SIZE,
      });
      tabla.innerHTML = renderTablaCorridas(data.items);
      if (paginacion) {
        const paginas = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
        paginacion.innerHTML = `
          <button data-scheduler-logs-prev class="rounded border px-2 py-1" ${page <= 1 ? "disabled" : ""}>Anterior</button>
          <span>Página ${page} de ${paginas} · ${data.total} corridas</span>
          <button data-scheduler-logs-next class="rounded border px-2 py-1" ${page >= paginas ? "disabled" : ""}>Siguiente</button>`;
      }
    } catch (error: unknown) {
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
          void fetchSchedulerLogDetalle(id)
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
    },
    { signal },
  );

  void pintarFiltros();
  void cargar();
}

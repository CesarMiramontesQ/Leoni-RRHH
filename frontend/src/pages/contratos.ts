/**
 * Contratos (`#/contratos`): vencimientos del personal activo, leídos de la caché en Bono
 * que llena el sync de las 04:10 (`levelup_empleados_tress`). Layout B de design.md:
 * tarjetas stat-filter + barra de filtros + tabla + paginación.
 *
 * La barra de filtros se pinta una sola vez y vive fuera de las regiones que se
 * repintan (`#ctr-kpis`, `#ctr-tabla`): repintarla desmontaría el buscador mientras el
 * usuario escribe.
 */

import {
  ESTATUS_CONTRATO,
  VENTANA_DIAS_DEFAULT,
  VENTANA_DIAS_OPCIONES,
  contratosErrorMessage,
  descargarContratosCsv,
  diasRestantesTexto,
  estatusContratoBadge,
  estatusContratoMeta,
  getContratos,
  getContratosAreas,
  getContratosKpis,
  type ContratoAreaOption,
  type ContratoEmpleadoItem,
  type ContratosFiltros,
  type ContratosKpisResponse,
  type EstatusContrato,
} from "../api/contratos.ts";
import { canAccessContratosPage } from "../auth/jwt.ts";
import { showEmpleadosToast } from "../components/empleados/toast.ts";
import { mountAppShell } from "../layouts/appShell.ts";
import { renderLaboralesBackBar } from "../navigation/laboralesBackLink.ts";
import {
  FIELD_FOCUS,
  FILTER_FIELD_WRAP,
  RH_DASHBOARD_PAGE_SHELL,
  RH_LISTADO_BTN_SECONDARY,
  RH_LISTADO_FOCUS_RING,
  RH_LISTADO_LABEL,
  RH_LISTADO_PAGE_OUTER_GRADIENT,
  RH_LISTADO_SELECT,
  RH_LISTADO_SURFACE,
  RH_TABLE_HEAD,
  SELECT_CHEVRON,
  htmlAccessDenied,
  pageHeading,
} from "../ui/uiTokens.ts";
import { escapeHtml, fmtFechaLargaEsMx, paginationRange } from "../ui/uiUtils.ts";

const SHELL_OPTS = {
  pageTitle: "Contratos",
  activeNav: "contratos" as const,
  mainClass: "pt-0 pb-5 sm:pb-6",
};

const PAGE_SIZE_OPCIONES = [20, 50, 100] as const;
const DEBOUNCE_MS = 300;

type Panel = "loading" | "ready" | "error";

type State = {
  filtros: ContratosFiltros;
  page: number;
  pageSize: number;
  areas: ContratoAreaOption[];
  kpis: ContratosKpisResponse | null;
  kpisPanel: Panel;
  items: ContratoEmpleadoItem[];
  total: number;
  tablaPanel: Panel;
  errorMessage: string | null;
  exportando: boolean;
};

const ICON_DOWNLOAD = `<svg viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true"><path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" /><path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" /></svg>`;
const ICON_SEARCH = `<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"><path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clip-rule="evenodd" /></svg>`;

const TD = "px-3 py-2.5 align-middle";

// ---------------------------------------------------------------- render: KPIs

type KpiSegmento = { value: EstatusContrato | ""; label: string; dot: string; count: (k: ContratosKpisResponse) => number };

function kpiSegmentos(ventana: number): KpiSegmento[] {
  const m = (e: EstatusContrato) => estatusContratoMeta(e);
  return [
    { value: "", label: "Total", dot: "bg-leoni-blue", count: (k) => k.total },
    { value: "vencido", label: m("vencido").label + "s", dot: m("vencido").dot, count: (k) => k.vencidos },
    { value: "por_vencer", label: `Vencen en ${ventana} d`, dot: m("por_vencer").dot, count: (k) => k.por_vencer },
    { value: "vigente", label: "Vigentes", dot: m("vigente").dot, count: (k) => k.vigentes },
    { value: "indefinido", label: "Indefinidos", dot: m("indefinido").dot, count: (k) => k.indefinidos },
    { value: "sin_dato", label: "Sin dato", dot: m("sin_dato").dot, count: (k) => k.sin_dato },
  ];
}

function renderKpis(state: State): string {
  const segs = kpiSegmentos(state.filtros.ventana_dias);
  const cards = segs
    .map((s) => {
      const activo = state.filtros.estatus === s.value;
      const cls = activo
        ? "border-leoni-blue bg-[rgba(219,234,254,0.45)] shadow-[0_6px_18px_rgba(30,64,175,0.12)]"
        : "border-[rgba(148,163,184,0.24)] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:border-leoni-blue/40 hover:bg-slate-50/70";
      const valor =
        state.kpisPanel === "ready" && state.kpis
          ? `<span class="text-2xl font-bold tabular-nums text-text-primary">${s.count(state.kpis)}</span>`
          : state.kpisPanel === "error"
            ? `<span class="text-sm font-semibold text-slate-400">—</span>`
            : `<span class="inline-block h-7 w-12 animate-pulse rounded bg-slate-200" aria-hidden="true"></span>`;
      return `<button type="button" data-ctr-kpi="${s.value}" aria-pressed="${activo ? "true" : "false"}"
        class="group flex flex-col gap-2 rounded-[14px] border p-4 text-left transition ${cls} focus:outline-none focus-visible:ring-2 focus-visible:ring-leoni-blue/40 focus-visible:ring-offset-2">
        <span class="flex items-center gap-2">
          <span class="size-2 shrink-0 rounded-full ${s.dot}" aria-hidden="true"></span>
          <span class="text-xs font-semibold uppercase tracking-wide text-text-muted">${escapeHtml(s.label)}</span>
        </span>
        ${valor}
      </button>`;
    })
    .join("");
  return `<section class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" role="group" aria-label="Filtrar por estatus de contrato">${cards}</section>`;
}

// ------------------------------------------------------------- render: filtros

function renderFiltros(state: State): string {
  const f = state.filtros;
  const areaOptions = [
    `<option value="">Todas las áreas</option>`,
    ...state.areas.map(
      (a) => `<option value="${a.area_id}" ${f.area_id === a.area_id ? "selected" : ""}>${escapeHtml(a.descripcion)}</option>`,
    ),
  ].join("");
  const ventanaOptions = VENTANA_DIAS_OPCIONES.map(
    (n) => `<option value="${n}" ${n === f.ventana_dias ? "selected" : ""}>${n} días</option>`,
  ).join("");
  const estatusOptions = [
    `<option value="">Todos</option>`,
    ...ESTATUS_CONTRATO.map(
      (e) => `<option value="${e}" ${f.estatus === e ? "selected" : ""}>${escapeHtml(estatusContratoMeta(e).label)}</option>`,
    ),
  ].join("");
  return `
  <section class="${RH_LISTADO_SURFACE} p-3 sm:p-4" aria-label="Filtros de contratos">
    <div class="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-2 sm:gap-x-3 xl:flex-nowrap">
      <div class="${FILTER_FIELD_WRAP} lg:min-w-[14rem]">
        <label for="ctr-q" class="${RH_LISTADO_LABEL}">Buscar</label>
        <div class="relative">
          ${ICON_SEARCH}
          <input id="ctr-q" type="search" data-ctr-q value="${escapeHtml(f.q)}" placeholder="Nombre o número…"
            class="block w-full rounded-[10px] border border-[#e5e7eb] bg-white py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 ${FIELD_FOCUS} ${RH_LISTADO_FOCUS_RING}" />
        </div>
      </div>
      <div class="${FILTER_FIELD_WRAP}">
        <label for="ctr-area" class="${RH_LISTADO_LABEL}">Área</label>
        <div class="grid grid-cols-1"><select id="ctr-area" data-ctr-area class="${RH_LISTADO_SELECT} ${RH_LISTADO_FOCUS_RING}">${areaOptions}</select>${SELECT_CHEVRON}</div>
      </div>
      <div class="${FILTER_FIELD_WRAP}">
        <label for="ctr-estatus" class="${RH_LISTADO_LABEL}">Estatus</label>
        <div class="grid grid-cols-1"><select id="ctr-estatus" data-ctr-estatus class="${RH_LISTADO_SELECT} ${RH_LISTADO_FOCUS_RING}">${estatusOptions}</select>${SELECT_CHEVRON}</div>
      </div>
      <div class="${FILTER_FIELD_WRAP}">
        <label for="ctr-ventana" class="${RH_LISTADO_LABEL}">Ventana «por vencer»</label>
        <div class="grid grid-cols-1"><select id="ctr-ventana" data-ctr-ventana class="${RH_LISTADO_SELECT} ${RH_LISTADO_FOCUS_RING}">${ventanaOptions}</select>${SELECT_CHEVRON}</div>
      </div>
      <div class="shrink-0">
        <button type="button" data-ctr-limpiar class="${RH_LISTADO_BTN_SECONDARY}">Limpiar</button>
      </div>
    </div>
  </section>`;
}

// --------------------------------------------------------------- render: tabla

function fechaCorta(iso: string | null): string {
  return iso ? fmtFechaLargaEsMx(iso) : "—";
}

function renderFila(i: ContratoEmpleadoItem): string {
  const dias = diasRestantesTexto(i.dias_restantes);
  const diasCls =
    i.estatus === "vencido" ? "text-red-700" : i.estatus === "por_vencer" ? "text-amber-700" : "text-text-secondary";
  return `
    <tr class="hover:bg-slate-50/70" data-ctr-empleado="${i.empleado_id}">
      <td class="${TD}">
        <a href="#/empleados/${i.empleado_id}" class="block text-sm font-semibold text-text-primary hover:text-leoni-blue">${escapeHtml(i.nombre)}</a>
        <span class="block text-xs tabular-nums text-text-muted">#${i.no_empleado}</span>
      </td>
      <td class="${TD} text-sm text-text-secondary">
        <span class="block">${escapeHtml(i.area ?? "—")}</span>
        <span class="block text-xs text-text-muted">${escapeHtml(i.puesto ?? "—")}</span>
      </td>
      <td class="${TD} text-sm text-text-secondary">${escapeHtml(i.supervisor ?? "—")}</td>
      <td class="${TD} text-sm text-text-secondary">
        <span class="block">${escapeHtml(i.contrato_descripcion ?? (i.contrato_codigo ? "Sin catálogo" : "—"))}</span>
        ${i.contrato_codigo ? `<span class="block text-xs tabular-nums text-text-muted">${escapeHtml(i.contrato_codigo)}${i.contrato_dias ? ` · ${i.contrato_dias} d` : ""}</span>` : ""}
      </td>
      <td class="${TD} whitespace-nowrap text-sm text-text-secondary">${escapeHtml(fechaCorta(i.fecha_contrato))}</td>
      <td class="${TD} whitespace-nowrap text-sm text-text-secondary">${escapeHtml(fechaCorta(i.fecha_vencimiento))}</td>
      <td class="${TD} whitespace-nowrap text-sm font-semibold tabular-nums ${diasCls}">${escapeHtml(dias || "—")}</td>
      <td class="${TD}">${estatusContratoBadge(i.estatus)}</td>
    </tr>`;
}

function renderPaginacion(state: State): string {
  const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
  const from = state.total === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
  const to = Math.min(state.page * state.pageSize, state.total);
  const sizeOptions = PAGE_SIZE_OPCIONES.map(
    (n) => `<option value="${n}" ${n === state.pageSize ? "selected" : ""}>${n}</option>`,
  ).join("");
  const botones =
    totalPages <= 1
      ? ""
      : paginationRange(totalPages, state.page)
          .map((x) => {
            if (x === "ellipsis") return `<span class="flex min-h-8 items-center px-1.5 text-xs text-slate-500" aria-hidden="true">…</span>`;
            const activo = x === state.page;
            const cls = activo
              ? "bg-primary text-white"
              : "text-slate-600 hover:bg-slate-100 hover:text-accent";
            return `<button type="button" data-ctr-page="${x}" aria-current="${activo ? "page" : "false"}" class="min-h-8 min-w-8 rounded-lg px-2 text-xs font-semibold sm:text-sm ${cls}">${x}</button>`;
          })
          .join("");
  return `<footer class="flex flex-col gap-2 border-t border-slate-100 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
    <div class="flex flex-wrap items-center gap-3">
      <p class="text-xs font-medium text-slate-600 sm:text-sm">Mostrando <span class="tabular-nums text-slate-900">${from}</span>–<span class="tabular-nums text-slate-900">${to}</span> de <span class="tabular-nums text-slate-900">${state.total}</span></p>
      <label class="flex items-center gap-1.5 text-xs text-slate-600">
        <span>Por página</span>
        <select data-ctr-page-size aria-label="Registros por página" class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 ${FIELD_FOCUS}">${sizeOptions}</select>
      </label>
    </div>
    ${totalPages > 1 ? `<nav class="flex flex-wrap items-center justify-center gap-0.5 sm:justify-end" aria-label="Paginación de contratos">${botones}</nav>` : ""}
  </footer>`;
}

function renderTabla(state: State): string {
  if (state.tablaPanel === "loading") {
    return `<section class="${RH_LISTADO_SURFACE} px-6 py-14 text-center text-sm text-text-muted">Cargando contratos…</section>`;
  }
  if (state.tablaPanel === "error") {
    return `<section class="${RH_LISTADO_SURFACE} px-6 py-12 text-center">
      <p class="text-sm font-semibold text-text-primary">No se pudieron cargar los contratos</p>
      <p class="mt-1.5 text-xs text-text-muted">${escapeHtml(state.errorMessage ?? "Error desconocido")}</p>
      <button type="button" data-ctr-reintentar class="${RH_LISTADO_BTN_SECONDARY} mx-auto mt-4">Reintentar</button>
    </section>`;
  }
  const head = ["Empleado", "Área / Puesto", "Supervisor", "Contrato", "Inicio", "Vence", "Restan", "Estatus"]
    .map((h) => `<th scope="col" class="px-3 py-2.5 text-left font-semibold">${h}</th>`)
    .join("");
  const body =
    state.items.length === 0
      ? `<tr><td colspan="8" class="px-3 py-12 text-center text-sm text-slate-500">${
          state.total === 0 && !state.filtros.q && !state.filtros.estatus && state.filtros.area_id == null
            ? "Todavía no hay contratos sincronizados desde nómina. La caché se llena con el sync diario de las 04:10."
            : "Ningún contrato coincide con los filtros."
        }</td></tr>`
      : state.items.map(renderFila).join("");
  return `<section class="${RH_LISTADO_SURFACE} overflow-hidden p-0" aria-label="Listado de contratos">
    <div class="overflow-x-auto">
      <table class="min-w-[1040px] w-full border-collapse text-left">
        <thead class="${RH_TABLE_HEAD}"><tr>${head}</tr></thead>
        <tbody class="divide-y divide-slate-100/90">${body}</tbody>
      </table>
    </div>
    ${renderPaginacion(state)}
  </section>`;
}

function renderPage(state: State): string {
  const sync = state.items[0]?.sincronizado_en ?? null;
  const acciones = `<button type="button" data-ctr-exportar class="${RH_LISTADO_BTN_SECONDARY} inline-flex items-center gap-2" ${state.exportando ? "disabled" : ""}>${ICON_DOWNLOAD}<span>Exportar CSV</span></button>`;
  return `
    <div class="${RH_DASHBOARD_PAGE_SHELL}">
      <div class="${RH_LISTADO_PAGE_OUTER_GRADIENT}">
        ${renderLaboralesBackBar()}
        ${pageHeading(
          "Contratos",
          "Vencimientos del personal activo según el contrato registrado en nómina. Se actualiza cada madrugada.",
          acciones,
        )}
        <div id="ctr-kpis">${renderKpis(state)}</div>
        <div id="ctr-filtros">${renderFiltros(state)}</div>
        <div id="ctr-tabla">${renderTabla(state)}</div>
        <p id="ctr-sync" class="text-xs text-text-muted">${sync ? `Última sincronización con nómina: ${escapeHtml(new Date(sync).toLocaleString("es-MX"))}` : ""}</p>
      </div>
    </div>`;
}

// --------------------------------------------------------------------- mount

export function mountContratos(container: HTMLElement, signal: AbortSignal): void {
  if (!canAccessContratosPage()) {
    mountAppShell(container, {
      ...SHELL_OPTS,
      mainHtml: `<div class="${RH_DASHBOARD_PAGE_SHELL}"><div class="${RH_LISTADO_PAGE_OUTER_GRADIENT}">${htmlAccessDenied({
        title: "Acceso restringido",
        description: "Contratos es exclusivo de RH con el módulo «Contratos» asignado en Permisos RH.",
        linkHref: "#/laborales",
        linkLabel: "Volver a Laborales",
      })}</div></div>`,
    });
    return;
  }

  const state: State = {
    filtros: { ventana_dias: VENTANA_DIAS_DEFAULT, estatus: "por_vencer", area_id: null, q: "" },
    page: 1,
    pageSize: 20,
    areas: [],
    kpis: null,
    kpisPanel: "loading",
    items: [],
    total: 0,
    tablaPanel: "loading",
    errorMessage: null,
    exportando: false,
  };

  mountAppShell(container, { ...SHELL_OPTS, mainHtml: renderPage(state) });
  const main = container.querySelector<HTMLElement>("main") ?? container;
  const region = (id: string) => main.querySelector<HTMLElement>(`#${id}`);

  function paintKpis(): void {
    const r = region("ctr-kpis");
    if (r) r.innerHTML = renderKpis(state);
  }
  function paintTabla(): void {
    const r = region("ctr-tabla");
    if (r) r.innerHTML = renderTabla(state);
    const s = region("ctr-sync");
    const sync = state.items[0]?.sincronizado_en ?? null;
    if (s) s.textContent = sync ? `Última sincronización con nómina: ${new Date(sync).toLocaleString("es-MX")}` : "";
  }
  /** Solo el combo de áreas: el resto de la barra conserva lo que el usuario escribió. */
  function paintAreas(): void {
    const sel = main.querySelector<HTMLSelectElement>("[data-ctr-area]");
    if (!sel) return;
    const actual = sel.value;
    sel.innerHTML = [
      `<option value="">Todas las áreas</option>`,
      ...state.areas.map((a) => `<option value="${a.area_id}">${escapeHtml(a.descripcion)}</option>`),
    ].join("");
    sel.value = actual;
  }
  function syncControlesFiltros(): void {
    const est = main.querySelector<HTMLSelectElement>("[data-ctr-estatus]");
    if (est) est.value = state.filtros.estatus;
    const area = main.querySelector<HTMLSelectElement>("[data-ctr-area]");
    if (area) area.value = state.filtros.area_id == null ? "" : String(state.filtros.area_id);
    const ven = main.querySelector<HTMLSelectElement>("[data-ctr-ventana]");
    if (ven) ven.value = String(state.filtros.ventana_dias);
    const q = main.querySelector<HTMLInputElement>("[data-ctr-q]");
    if (q && q.value !== state.filtros.q) q.value = state.filtros.q;
  }

  let ultimaCargaTabla = 0;
  async function cargarTabla(): Promise<void> {
    const token = ++ultimaCargaTabla;
    state.tablaPanel = "loading";
    paintTabla();
    try {
      const res = await getContratos(state.filtros, state.page, state.pageSize);
      if (signal.aborted || token !== ultimaCargaTabla) return;
      state.items = res.items;
      state.total = res.total;
      state.tablaPanel = "ready";
    } catch (error) {
      if (signal.aborted || token !== ultimaCargaTabla) return;
      state.tablaPanel = "error";
      state.errorMessage = contratosErrorMessage(error, "Error al cargar los contratos.");
    }
    paintTabla();
  }

  let ultimaCargaKpis = 0;
  async function cargarKpis(): Promise<void> {
    const token = ++ultimaCargaKpis;
    state.kpisPanel = "loading";
    paintKpis();
    try {
      state.kpis = await getContratosKpis(state.filtros);
      if (signal.aborted || token !== ultimaCargaKpis) return;
      state.kpisPanel = "ready";
    } catch {
      if (signal.aborted || token !== ultimaCargaKpis) return;
      state.kpisPanel = "error";
    }
    paintKpis();
  }

  async function cargarAreas(): Promise<void> {
    try {
      state.areas = await getContratosAreas();
      if (signal.aborted) return;
      paintAreas();
    } catch {
      /* el combo se queda en «Todas»; el listado sigue funcionando */
    }
  }

  /** Cambio de filtro: vuelve a la página 1. Los KPIs no dependen del estatus. */
  function aplicarFiltros(opts: { kpis: boolean }): void {
    state.page = 1;
    void cargarTabla();
    if (opts.kpis) void cargarKpis();
    else paintKpis();
  }

  async function exportar(): Promise<void> {
    if (state.exportando) return;
    state.exportando = true;
    const btn = main.querySelector<HTMLButtonElement>("[data-ctr-exportar]");
    if (btn) btn.disabled = true;
    try {
      const blob = await descargarContratosCsv(state.filtros);
      if (signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contratos-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      if (!signal.aborted) showEmpleadosToast(main, contratosErrorMessage(error, "No se pudo exportar."), "error");
    } finally {
      state.exportando = false;
      if (btn) btn.disabled = false;
    }
  }

  let debounce: number | null = null;

  main.addEventListener(
    "click",
    (ev) => {
      const t = ev.target as HTMLElement | null;
      if (!t) return;
      const kpi = t.closest<HTMLElement>("[data-ctr-kpi]");
      if (kpi) {
        const v = (kpi.getAttribute("data-ctr-kpi") ?? "") as EstatusContrato | "";
        state.filtros.estatus = state.filtros.estatus === v ? "" : v;
        syncControlesFiltros();
        aplicarFiltros({ kpis: false });
        return;
      }
      const pg = t.closest<HTMLElement>("[data-ctr-page]");
      if (pg) {
        const n = Number.parseInt(pg.getAttribute("data-ctr-page") ?? "", 10);
        if (Number.isInteger(n) && n !== state.page) {
          state.page = n;
          void cargarTabla();
        }
        return;
      }
      if (t.closest("[data-ctr-reintentar]")) return void cargarTabla();
      if (t.closest("[data-ctr-exportar]")) return void exportar();
      if (t.closest("[data-ctr-limpiar]")) {
        state.filtros = { ventana_dias: VENTANA_DIAS_DEFAULT, estatus: "", area_id: null, q: "" };
        syncControlesFiltros();
        aplicarFiltros({ kpis: true });
      }
    },
    { signal },
  );

  main.addEventListener(
    "change",
    (ev) => {
      const t = ev.target as HTMLElement | null;
      if (!t) return;
      if (t.matches("[data-ctr-estatus]")) {
        state.filtros.estatus = (t as HTMLSelectElement).value as EstatusContrato | "";
        aplicarFiltros({ kpis: false });
      } else if (t.matches("[data-ctr-area]")) {
        const v = (t as HTMLSelectElement).value;
        state.filtros.area_id = v ? Number(v) : null;
        aplicarFiltros({ kpis: true });
      } else if (t.matches("[data-ctr-ventana]")) {
        state.filtros.ventana_dias = Number((t as HTMLSelectElement).value) || VENTANA_DIAS_DEFAULT;
        aplicarFiltros({ kpis: true });
      } else if (t.matches("[data-ctr-page-size]")) {
        state.pageSize = Number((t as HTMLSelectElement).value) || 20;
        state.page = 1;
        void cargarTabla();
      }
    },
    { signal },
  );

  main.addEventListener(
    "input",
    (ev) => {
      const t = ev.target as HTMLElement | null;
      if (!t?.matches("[data-ctr-q]")) return;
      state.filtros.q = (t as HTMLInputElement).value;
      if (debounce != null) window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        debounce = null;
        if (!signal.aborted) aplicarFiltros({ kpis: true });
      }, DEBOUNCE_MS);
    },
    { signal },
  );

  signal.addEventListener("abort", () => {
    if (debounce != null) window.clearTimeout(debounce);
  });

  void cargarAreas();
  void cargarKpis();
  void cargarTabla();
}
